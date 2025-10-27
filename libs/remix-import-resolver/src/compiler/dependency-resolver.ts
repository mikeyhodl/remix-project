'use strict'

import type { Plugin } from '@remixproject/engine'
import { ImportResolver } from './import-resolver'
import type { IOAdapter } from './adapters/io-adapter'
import { RemixPluginAdapter } from './adapters/remix-plugin-adapter'
import { resolveRelativeImport, applyRemappings, extractImports, extractUrlContext, extractPackageContext } from './utils/dependency-helpers'

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
    await this.processFile(entryFile, null)
    this.log(`[DependencyResolver] ✅ Built source bundle with ${this.sourceFiles.size} files`)
    return this.sourceFiles
  }

  private isLocalFile(path: string): boolean {
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('npm:')) return false
    return path.endsWith('.sol') && !path.includes('@') && !path.includes('node_modules') && !path.startsWith('../') && !path.startsWith('./')
  }

  // moved to utils/dependency-helpers

  private async processFile(importPath: string, requestingFile: string | null, packageContext?: string): Promise<void> {
    if (!importPath.endsWith('.sol')) {
      this.log(`[DependencyResolver] ❌ Invalid import: "${importPath}" does not end with .sol extension`)
      return
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
    }

    this.processedFiles.add(importPath)

    try {
      let content: string
      if (this.isLocalFile(importPath)) {
        this.log(`[DependencyResolver]   📁 Local file detected, reading directly`, importPath)
        content = await this.io.readFile(importPath)
      } else {
        content = await this.resolver.resolveAndSave(importPath, undefined, false)
      }

      if (!content) {
        this.log(`[DependencyResolver] ⚠️  Failed to resolve: ${importPath}`)
        return
      }

      const resolvedPath = this.isLocalFile(importPath) ? importPath : this.getResolvedPath(importPath)
      this.sourceFiles.set(importPath, content)

      if (!this.isLocalFile(importPath) && importPath.includes('@') && importPath.match(/@[^/]+@\d+\.\d+\.\d+\//)) {
        const unversionedPath = importPath.replace(/@([^@/]+(?:\/[^@/]+)?)@\d+\.\d+\.\d+\//, '@$1/')
        this.sourceFiles.set(unversionedPath, content)
        this.log(`[DependencyResolver]   🔄 Also stored under unversioned path: ${unversionedPath}`)
      }

      if (!this.isLocalFile(importPath)) {
        const filePackageContext = extractPackageContext(importPath) || extractUrlContext(importPath, (msg, ...args) => this.log(msg, ...args))
        if (filePackageContext) {
          this.fileToPackageContext.set(resolvedPath, filePackageContext)
          this.resolver.setPackageContext(filePackageContext)
          this.log(`[DependencyResolver]   📦 File belongs to: ${filePackageContext}`)
        }
      }

      const imports = extractImports(content, (msg, ...args) => this.log(msg, ...args))
      if (imports.length > 0) {
        this.log(`[DependencyResolver]   🔗 Found ${imports.length} imports`)
        const resolvedImports = new Set<string>()
        const currentFilePackageContext = this.isLocalFile(importPath)
          ? null
          : (extractPackageContext(importPath) || extractUrlContext(importPath, (msg, ...args) => this.log(msg, ...args)))

        for (const importedPath of imports) {
          this.log(`[DependencyResolver]   ➡️  Processing import: "${importedPath}"`)
          let resolvedImportPath = importedPath
          if (importedPath.startsWith('./') || importedPath.startsWith('../')) {
            resolvedImportPath = resolveRelativeImport(importPath, importedPath, (msg, ...args) => this.log(msg, ...args))
            this.log(`[DependencyResolver]   🔗 Resolved relative: "${importedPath}" → "${resolvedImportPath}"`)
          }
          resolvedImportPath = applyRemappings(resolvedImportPath, this.remappings, (msg, ...args) => this.log(msg, ...args))
          resolvedImports.add(resolvedImportPath)
          await this.processFile(resolvedImportPath, resolvedPath, currentFilePackageContext || undefined)
        }
        this.importGraph.set(resolvedPath, resolvedImports)
      }
    } catch (err) {
      this.log(`[DependencyResolver] ❌ Error processing ${importPath}:`, err)
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
    await (this.resolver as any).saveResolutionsToIndex()
  }
}
