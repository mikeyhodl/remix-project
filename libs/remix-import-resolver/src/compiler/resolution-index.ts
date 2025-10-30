'use strict'

import { Plugin } from '@remixproject/engine'

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

  constructor(private pluginApi: Plugin, private debug: boolean = false) {
    this.debug = true
  }

  private log(message: string, ...args: any[]): void { if (this.debug) console.log(message, ...args) }

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
    if (!this.index[sourceFile]) this.index[sourceFile] = {}
    const local = this.toLocalPath(resolvedPath)
    if (this.index[sourceFile][originalImport] !== local) {
      this.index[sourceFile][originalImport] = local
      this.isDirty = true
      this.log(`[ResolutionIndex] 📝 Recorded: ${sourceFile} | ${originalImport} → ${local}`)
    }
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
    return `.deps/npm/${resolved}`
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

  /** Remove all recorded mappings for a given source file. */
  clearFileResolutions(sourceFile: string): void {
    if (this.index[sourceFile]) {
      delete this.index[sourceFile]
      this.isDirty = true
      this.log(`[ResolutionIndex] 🗑️  Cleared resolutions for: ${sourceFile}`)
    }
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
