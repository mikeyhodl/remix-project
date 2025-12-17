'use strict'

import { Plugin } from '@remixproject/engine'
import { Logger } from './utils/logger'

/**
 * ResolutionIndex (Remix Plugin)
 *
 * Browser/Plugin implementation of the resolution index that persists mappings via
 * the Remix fileManager API under .deps/npm/.resolution-index.json.
 */
export class ResolutionIndex {
  private indexPath: string = '.deps/npm/.resolution-index.json'
  private index: Record<string, Record<string, string>> = {}
  private isDirty: boolean = false
  private loadPromise: Promise<void> | null = null
  private isLoaded: boolean = false
  private logger: Logger

  constructor(private pluginApi: Plugin, private debug: boolean = false) {
    this.debug = true
    this.logger = new Logger(pluginApi, debug)
  }

  private log(message: string, ...args: any[]): void { 
    this.logger.logIf('resolutionIndex', message, ...args)
  }

  /** Load index from the workspace once per session (idempotent). */
  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise
    if (this.isLoaded) return Promise.resolve()
    this.loadPromise = (async () => {
      try {
        const exists = await this.pluginApi.call('fileManager', 'exists', this.indexPath)
        if (exists) {
          const content = await this.pluginApi.call('fileManager', 'readFile', this.indexPath)
          this.index = JSON.parse(content)
          this.log(`[ResolutionIndex] 📖 Loaded index with ${Object.keys(this.index).length} source files`)
        } else {
          this.log(`[ResolutionIndex] 📝 No existing index found, starting fresh`)
          this.index = {}
        }
        this.isLoaded = true
      } catch (err) {
        this.log(`[ResolutionIndex] ⚠️  Failed to load index:`, err)
        this.index = {}
        this.isLoaded = true
      }
    })()
    return this.loadPromise
  }

  /** Ensure the index is loaded before reading or writing. */
  async ensureLoaded(): Promise<void> { if (!this.isLoaded) await this.load() }

  /** Drop cached state and reload from storage. */
  async reload(): Promise<void> {
    this.log(`[ResolutionIndex] 🔄 Reloading index (workspace changed)`)
    this.index = {}
    this.isDirty = false
    this.isLoaded = false
    this.loadPromise = null
    await this.load()
  }

  /** Record a mapping for a source file if it changed since last write. */
  recordResolution(sourceFile: string, originalImport: string, resolvedPath: string): void {
    // Normalize sourceFile to strip .deps prefixes for consistent keys
    const normalizedSource = this.normalizeSourceFile(sourceFile)
    this.log(`[ResolutionIndex] ➡️  Recording resolution: ${normalizedSource} | ${originalImport} → ${resolvedPath}`)
    if (!this.index[normalizedSource]) this.index[normalizedSource] = {}
    const local = this.toLocalPath(resolvedPath)
    if (this.index[normalizedSource][originalImport] !== local) {
      this.index[normalizedSource][originalImport] = local
      this.isDirty = true
      this.log(`[ResolutionIndex] 📝 Recorded: ${normalizedSource} | ${originalImport} → ${local}`)
    }
  }

  /** Normalize a path by stripping .deps prefixes for consistent index keys */
  private normalizeSourceFile(path: string): string {
    if (!path) return path
    // Strip .deps/npm/, .deps/github/, .deps/http/ prefixes to get canonical package path
    if (path.startsWith('.deps/npm/')) return path.substring('.deps/npm/'.length)
    if (path.startsWith('.deps/github/')) return path.substring('.deps/github/'.length)
    if (path.startsWith('.deps/http/')) {
      // For HTTP paths, keep them as http URLs would be stored
      return path
    }
    return path
  }

  /** Translate a resolved path into a deterministic local path under .deps. */
  private toLocalPath(resolved: string): string {
    if (!resolved) return resolved
    if (resolved.startsWith('.deps/')) return resolved
    const isHttp = resolved.startsWith('http://') || resolved.startsWith('https://')
    if (isHttp) {
      try {
        const u = new URL(resolved)
        const cleanPath = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname
        return `.deps/http/${u.hostname}/${cleanPath}`
      } catch {
        const safe = resolved.replace(/^[a-zA-Z]+:\/\//, '').replace(/[^-a-zA-Z0-9._/]/g, '_')
        return `.deps/http/${safe}`
      }
    }
    if (resolved.startsWith('github/') || resolved.startsWith('ipfs/') || resolved.startsWith('swarm/')) {
      return `.deps/${resolved}`
    }
    // For npm packages (must contain @ to be a package), add .deps/npm/ prefix
    // This catches both scoped packages (@org/pkg) and versioned packages (pkg@1.0.0)
    // but excludes local workspace files (security/Pausable.sol)
    if (resolved.includes('@') && resolved.match(/^@?[a-zA-Z0-9-~][a-zA-Z0-9._-]*[@\/]/) && !resolved.startsWith('.deps/npm/')) {
      return `.deps/npm/${resolved}`
    }
    return `${resolved}`
  }

  /** Lookup a mapping scoped to a source file. */
  lookup(sourceFile: string, importPath: string): string | null {
    if (this.index[sourceFile] && this.index[sourceFile][importPath]) return this.index[sourceFile][importPath]
    return null
  }

  /** Lookup a mapping across all source files (first hit wins). */
  lookupAny(importPath: string): string | null {
    for (const sourceFile in this.index) {
      if (this.index[sourceFile][importPath]) return this.index[sourceFile][importPath]
    }
    return null
  }

  /** Return all recorded mappings for a given source file. */
  getResolutionsForFile(sourceFile: string): Record<string, string> | null { return this.index[sourceFile] || null }

  /**
   * Resolve the actual filesystem path for a requested file within a compiled contract's context.
   * This uses the __sources__ bundle and .raw_paths.json to find the exact file that was used.
   * 
   * @param originContract - The main contract that was compiled (entry point)
   * @param requestedPath - The path being requested (e.g., from debugger sources)
   * @returns The actual filesystem path where the file is located, or null if not found
   */
  async resolveActualPath(originContract: string, requestedPath: string): Promise<string | null> {
    try {
      // Normalize origin contract path (strip .deps/npm/ prefix if present)
      const normalizedOrigin = this.normalizeSourceFile(originContract)
      
      if (!this.index[normalizedOrigin] || !this.index[normalizedOrigin]['__sources__']) {
        this.log(`[ResolutionIndex] No __sources__ found for: ${normalizedOrigin}`)
        return null
      }
      
      const sources = this.index[normalizedOrigin]['__sources__'] as any
      
      // Find matching source in __sources__
      let resolvedPath: string | null = null
      if (sources[requestedPath] && sources[requestedPath].file) {
        resolvedPath = sources[requestedPath].file
      }
      
      if (!resolvedPath) {
        this.log(`[ResolutionIndex] No match in __sources__ for: ${requestedPath}`)
        return null
      }
      
      // If it's an external dependency, look up actual FS path in .raw_paths.json
      if (resolvedPath.startsWith('.deps/')) {
        try {
          const rawPathsContent = await this.pluginApi.call('fileManager', 'readFile', '.deps/.raw_paths.json')
          const rawPaths = JSON.parse(rawPathsContent)
          
          // Find matching entry in raw paths
          for (const [url, fsPath] of Object.entries(rawPaths)) {
            if (fsPath === resolvedPath) {
              this.log(`[ResolutionIndex] Resolved via .raw_paths.json: ${requestedPath} → ${fsPath}`)
              return fsPath as string
            }
          }
          // If not found in raw paths, return the resolved path as-is
          this.log(`[ResolutionIndex] Using resolved path (not in .raw_paths.json): ${resolvedPath}`)
        } catch (e) {
          // .raw_paths.json might not exist, use resolvedPath as-is
          this.log(`[ResolutionIndex] .raw_paths.json not available, using: ${resolvedPath}`)
        }
      }
      
      return resolvedPath
    } catch (e) {
      this.log(`[ResolutionIndex] resolveActualPath error:`, e)
      return null
    }
  }

  /** Remove all recorded mappings for a given source file. */
  clearFileResolutions(sourceFile: string): void {
    if (this.index[sourceFile]) {
      delete this.index[sourceFile]
      this.isDirty = true
      this.log(`[ResolutionIndex] 🗑️  Cleared resolutions for: ${sourceFile}`)
    }
  }

  /** Record the complete source bundle for a compiled file. */
  recordSources(sourceFile: string, sources: Record<string, { content: string; file?: string }>): void {
    const normalizedSource = this.normalizeSourceFile(sourceFile)
    this.log(`[ResolutionIndex] 📦 Recording sources for: ${normalizedSource}`)
    if (!this.index[normalizedSource]) this.index[normalizedSource] = {}
    this.index[normalizedSource]['__sources__'] = sources as any
    this.isDirty = true
    this.log(`[ResolutionIndex] 📝 Recorded ${Object.keys(sources).length} source files for: ${normalizedSource}`)
  }

  /** Persist index to workspace storage if it changed. */
  async save(): Promise<void> {
    //if (!this.isDirty) { this.log(`[ResolutionIndex] ⏭️  Index unchanged, skipping save`); return }
    try {
      const directory = '.deps/npm'
      try {
        const exists = await this.pluginApi.call('fileManager', 'exists', directory)
        if (!exists) {
          await this.pluginApi.call('fileManager', 'mkdir', directory)
          this.log(`[ResolutionIndex] 📁 Created directory: ${directory}`)
        }
      } catch (dirErr) { this.log(`[ResolutionIndex] ⚠️  Could not ensure directory exists:`, dirErr) }
      const content = JSON.stringify(this.index, null, 2)
      await this.pluginApi.call('fileManager', 'writeFile', this.indexPath, content)
      this.isDirty = false
      this.log(`[ResolutionIndex] 💾 Saved index with ${Object.keys(this.index).length} source files to: ${this.indexPath}`)
    } catch (err) { this.log(`[ResolutionIndex] ❌ Failed to save index:`, err) }
  }
}
