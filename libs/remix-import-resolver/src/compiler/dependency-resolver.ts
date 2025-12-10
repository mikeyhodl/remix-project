'use strict'

import type { Plugin } from '@remixproject/engine'
import { ImportResolver } from './import-resolver'
import type { IOAdapter } from './adapters/io-adapter'
import { RemixPluginAdapter } from './adapters/remix-plugin-adapter'
import { ResolutionIndex } from './resolution-index'
import { FileResolutionIndex } from './file-resolution-index'
import { resolveRelativeImport, applyRemappings, extractImports, extractUrlContext, extractPackageContext } from './utils/dependency-helpers'
import { Logger } from './utils/logger'
import { WarningSystem } from './utils/warning-system'

/**
 * Pre-compilation dependency tree builder (Node-focused)
 *
 * Walks the Solidity import graph BEFORE compilation, tracking which file requests which import.
 * Context-aware resolution enables correct handling of multiple package versions.
 */
export class DependencyResolver {
  private pluginApi: Plugin | null
  private io: IOAdapter
  private resolver: ImportResolver
  private sourceFiles: Map<string, string> = new Map()
  private processedFiles: Set<string> = new Set()
  private importGraph: Map<string, Set<string>> = new Map()
  private fileToPackageContext: Map<string, string> = new Map()
  private debug: boolean = false
  private remappings: Array<{ from: string; to: string }> = []
  private resolutionIndex: ResolutionIndex | null = null
  private resolutionIndexInitialized: boolean = false
  private logger: Logger
  private warnings: WarningSystem

  /**
   * Create a DependencyResolver
   *
   * Inputs:
   * - pluginApi or io: Remix plugin API or IOAdapter implementation
   * - targetFile: path used for resolution index scoping
   * - debug: enable verbose logs
   */
  constructor(pluginApi: Plugin, targetFile: string, debug?: boolean)
  constructor(io: IOAdapter, targetFile: string, debug?: boolean)
  constructor(pluginOrIo: Plugin | IOAdapter, targetFile: string, debug: boolean = false) {
    const isPlugin = typeof (pluginOrIo as any)?.call === 'function'
    this.pluginApi = isPlugin ? (pluginOrIo as Plugin) : null
    this.io = isPlugin ? new RemixPluginAdapter(this.pluginApi as any) : (pluginOrIo as IOAdapter)
    this.debug = debug
    this.logger = new Logger(this.pluginApi || undefined, debug)
    this.warnings = new WarningSystem(this.logger, { verbose: !!debug })
    if (isPlugin) {
      this.resolver = new ImportResolver(this.pluginApi as any, targetFile, debug)
    } else {
      this.resolver = new ImportResolver(this.io, targetFile, debug)
    }
  }

  /**
   * Set import remappings, e.g. [ { from: 'oz/', to: '@openzeppelin/contracts@5.4.0/' } ]
   */
  public setRemappings(remaps: Array<{ from: string; to: string }>) {
    this.remappings = remaps || []
  }

  /** Enable or disable caching for this resolver session. */
  public setCacheEnabled(enabled: boolean): void {
    if ((this.resolver as any).setCacheEnabled) {
      ; (this.resolver as any).setCacheEnabled(enabled)
    }
  }

  private log(message: string, ...args: any[]): void {
    if (this.debug) console.log(message, ...args)
  }

  /**
   * Build the dependency tree starting from an entry file and return a bundle of sources
   * Output: Map<originalImportPath, content>
   */
  public async buildDependencyTree(entryFile: string): Promise<Map<string, string>> {
    this.log(`[DependencyResolver] 🌳 Building dependency tree from: ${entryFile}`)
    this.sourceFiles.clear()
    this.processedFiles.clear()
    this.importGraph.clear()
    this.fileToPackageContext.clear()
    // Ensure resolution index is loaded so we can record per-file mappings
    if (!this.resolutionIndex) {
      this.resolutionIndex = this.pluginApi
        ? new ResolutionIndex(this.pluginApi as any, this.debug)
        : (new FileResolutionIndex(this.io, this.debug) as unknown as ResolutionIndex)
    }
    if (!this.resolutionIndexInitialized) {
      await this.resolutionIndex.load()
      this.resolutionIndexInitialized = true
    }
    try {
      await this.processFile(entryFile, null)
      this.log(`[DependencyResolver] ✅ Built source bundle with ${this.sourceFiles.size} files`)
      return this.sourceFiles
    } catch (err) {
      this.log(`[DependencyResolver] ❌ Failed to build dependency tree from ${entryFile}:`, err)
      throw err
    }
  }

  private isLocalFile(path: string): boolean {
    // External schemes are never local
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('npm:')) return false
    // Treat on-disk cached deps as local (they are already materialized in workspace)
    if (path.startsWith('.deps/')) return path.endsWith('.sol')
    // Special case: hardhat/console.sol is an npm import, not a local file
    if (path === 'hardhat/console.sol') return false
    // Everything else that is a .sol path in the workspace (including relative paths) is local
    return path.endsWith('.sol') && !path.includes('@') && !path.includes('node_modules')
  }

  // moved to utils/dependency-helpers

  private async processFile(importPath: string, requestingFile: string | null, packageContext?: string): Promise<void> {
    if (!importPath.endsWith('.sol')) {
      this.log(`[DependencyResolver] ❌ Invalid import: "${importPath}" does not end with .sol extension`)
      try { await this.warnings.emitInvalidSolidityImport(importPath) } catch { }
      throw new Error(`Invalid import: "${importPath}" does not end with .sol extension`)
    }
    if (this.processedFiles.has(importPath)) {
      this.log(`[DependencyResolver]   ⏭️  Already processed: ${importPath}`)
      return
    }

    this.log(`[DependencyResolver] 📄 Processing: ${importPath}`)
    this.log(`[DependencyResolver]   📍 Requested by: ${requestingFile || 'entry point'}`)

    if (packageContext) {
      this.log(`[DependencyResolver]   📦 Package context: ${packageContext}`)
      this.fileToPackageContext.set(importPath, packageContext)
      this.resolver.setPackageContext(packageContext)
      // Ensure the parent's package.json is loaded so its declared deps influence child resolution
      if ((this.resolver as any).ensurePackageContextLoaded) {
        await (this.resolver as any).ensurePackageContextLoaded(packageContext)
      }
    }

    this.processedFiles.add(importPath)

    try {
      let content: string
      if (this.isLocalFile(importPath)) {
        this.log(`[DependencyResolver]   📁 Local file detected, reading directly`, importPath)
        try {
          content = await this.io.readFile(importPath)
        } catch (err) {
          // Local absolute/relative file missing. Try handler system ONLY (e.g., remix_tests.sol), do not externalize.
          this.log(`[DependencyResolver]   🔄 Local file not found, trying handler system...`)
          try {
            const handler = (this.resolver as any).getHandlerRegistry?.()
            if (handler?.tryHandle) {
              const ctx = { importPath, targetFile: (this.resolver as any).getTargetFile?.(), targetPath: undefined }
              const res = await handler.tryHandle(ctx)
              if (res?.handled && typeof res.content === 'string') {
                content = res.content
              } else {
                throw new Error(`Local file not found and no handler matched: ${importPath}`)
              }
            } else {
              throw new Error(`Local file not found and handler registry unavailable: ${importPath}`)
            }
          } catch (e) {
            // Emit warning and throw error to propagate to compiler
            this.log(`[DependencyResolver]   ⚠️  Local resolution failed for ${importPath}:`, e)
            try { await this.warnings.emitFailedToResolve(importPath) } catch { }
            throw new Error(`File not found: ${importPath}`)
          }
        }
      } else {
        content = await this.resolver.resolveAndSave(importPath, undefined, false)
      }

      if (!content) {
        if (content === '') return
        this.log(`[DependencyResolver] ⚠️  Failed to resolve: ${importPath}`)
        try { await this.warnings.emitFailedToResolve(importPath) } catch { }
        throw new Error(`File not found: ${importPath}`)
      }

      const resolvedPath = this.isLocalFile(importPath) ? importPath : this.getResolvedPath(importPath)
      // Store content under the resolvedPath so bundle lookups during flatten match graph keys
      this.sourceFiles.set(resolvedPath, content)
      // Also store under the original importPath as a convenience alias
      if (resolvedPath !== importPath) this.sourceFiles.set(importPath, content)

      if (!this.isLocalFile(resolvedPath) && resolvedPath.includes('@') && resolvedPath.match(/@[^/]+@\d+\.\d+\.\d+\//)) {
        const unversionedPath = resolvedPath.replace(/@([^@/]+(?:\/[^@/]+)?)@\d+\.\d+\.\d+\//, '@$1/')
        this.sourceFiles.set(unversionedPath, content)
        this.log(`[DependencyResolver]   🔄 Also stored under unversioned path: ${unversionedPath}`)
      }

      // Derive package context from path, regardless of local vs external.
      {
        const filePackageContext = extractPackageContext(importPath) || (!this.isLocalFile(importPath) ? extractUrlContext(importPath, (msg, ...args) => this.log(msg, ...args)) : null)
        if (filePackageContext) {
          this.fileToPackageContext.set(resolvedPath, filePackageContext)
          this.resolver.setPackageContext(filePackageContext)
          if ((this.resolver as any).ensurePackageContextLoaded) {
            await (this.resolver as any).ensurePackageContextLoaded(filePackageContext)
          }
          this.log(`[DependencyResolver]   📦 File belongs to: ${filePackageContext}`)
        }
      }

      // Before scanning imports, clear any prior index entries for this file so we write fresh mappings
      if (this.resolutionIndex) {
        try { this.resolutionIndex.clearFileResolutions(resolvedPath) } catch { }
      }

      const imports = extractImports(content, (msg, ...args) => this.log(msg, ...args))
      if (imports.length > 0) {
        this.log(`[DependencyResolver]   🔗 Found ${imports.length} imports`)
        const resolvedImports = new Set<string>()
        const currentFilePackageContext = extractPackageContext(importPath) || (!this.isLocalFile(importPath) ? extractUrlContext(importPath, (msg, ...args) => this.log(msg, ...args)) : null)

        for (const importedPath of imports) {
          this.log(`[DependencyResolver]   ➡️  Processing import: "${importedPath}"`)
          // Start with the raw path as written in the file
          let nextPath = importedPath
          // Resolve relative paths using the CURRENT FILE PATH as base (original importPath)
          if (importedPath.startsWith('./') || importedPath.startsWith('../')) {
            nextPath = resolveRelativeImport(importPath, importedPath, (msg, ...args) => this.log(msg, ...args))
            this.log(`[DependencyResolver]   🔗 Resolved relative: "${importedPath}" → "${nextPath}"`)
          }
          // Apply any remappings (e.g., oz/ → @openzeppelin/contracts@X/)
          nextPath = applyRemappings(nextPath, this.remappings, (msg, ...args) => this.log(msg, ...args))

          // Recursively process the child first so that resolver mappings are populated
          await this.processFile(nextPath, resolvedPath, currentFilePackageContext || undefined)

          // Normalize the graph edge to the canonical resolved path used as keys in graph/bundle
          const childGraphKey = this.isLocalFile(nextPath) ? nextPath : this.getResolvedPath(nextPath)
          resolvedImports.add(childGraphKey)

          // Record per-file resolution for Go-to-Definition: original spec as written → resolved path
          // Always record, even for relative (local) imports inside external packages, so navigation works everywhere.
          if (this.resolutionIndex) {
            try { this.resolutionIndex.recordResolution(resolvedPath, importedPath, childGraphKey) } catch { }
          }
        }
        this.importGraph.set(resolvedPath, resolvedImports)
      }
    } catch (err) {
      this.log(`[DependencyResolver] ❌ Error processing ${importPath}:`, err)
      try { await this.warnings.emitProcessingError(importPath, err) } catch { }
      console.error(err)
      throw err
    }
  }

  // moved to utils/dependency-helpers

  // moved to utils/dependency-helpers

  // moved to utils/dependency-helpers

  private getResolvedPath(importPath: string): string {
    const resolved = this.resolver.getResolution(importPath)
    return resolved || importPath
  }

  /** Return the collected source bundle after buildDependencyTree. */
  public getSourceBundle(): Map<string, string> {
    return this.sourceFiles
  }

  /** Return the import graph (file -> set of direct imports). */
  public getImportGraph(): Map<string, Set<string>> {
    return this.importGraph
  }

  /** Retrieve the package context associated with a resolved file. */
  public getPackageContext(filePath: string): string | null {
    return this.fileToPackageContext.get(filePath) || null
  }

  /** Convert the bundle to Solidity compiler input shape. */
  public toCompilerInput(): { [fileName: string]: { content: string } } {
    const sources: { [fileName: string]: { content: string } } = {}
    for (const [path, content] of this.sourceFiles.entries()) sources[path] = { content }
    return sources
  }

  /** Persist the resolution index for this session. */
  public async saveResolutionIndex(): Promise<void> {
    this.log(`[DependencyResolver] 💾 Saving resolution index...`)
    if (this.resolutionIndex) {
      try { await this.resolutionIndex.save() } catch { }
    }
  }
}
