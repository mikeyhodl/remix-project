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
 * Solidity compiler input format
 */
export type CompilerInput = {
  [fileName: string]: {
    content: string
  }
}

/**
 * Special npm imports that don't follow standard scoped package patterns.
 * Maps import path patterns to their source key formats.
 */
const SPECIAL_NPM_IMPORTS: Array<{
  pattern: RegExp
  isNpmImport: (path: string) => boolean
  getSourceKey: (path: string) => string
  getUnversionedKey: (path: string) => string
}> = [
  {
    // hardhat/console.sol → hardhat@X.Y.Z/console.sol (versioned) + hardhat/console.sol (unversioned)
    pattern: /^hardhat\//,
    isNpmImport: (path: string) => path.startsWith('hardhat/'),
    getSourceKey: (path: string) => path, // Store under unversioned key (hardhat/console.sol)
    getUnversionedKey: (path: string) => path // Already unversioned
  }
]

/**
 * Debug configuration options for DependencyResolver
 */
export interface DependencyResolverDebugConfig {
  enabled?: boolean          // Master switch - if false, all logging disabled
  tree?: boolean            // Dependency tree building logs
  fileProcessing?: boolean  // Individual file processing logs
  imports?: boolean         // Import extraction and resolution logs
  storage?: boolean         // Source file storage logs (keys, aliases)
  localhost?: boolean       // Localhost/remixd resolution logs
  packageContext?: boolean  // Package context tracking logs
  resolutionIndex?: boolean // Resolution index operations logs
}

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
  // Map aliases (resolved/versioned/actual FS paths) → original import spec keys
  private aliasToSpec: Map<string, string> = new Map()
  private processedFiles: Set<string> = new Set()
  private importGraph: Map<string, Set<string>> = new Map()
  private fileToPackageContext: Map<string, string> = new Map()
  private debugConfig: DependencyResolverDebugConfig
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
   * - debug: enable verbose logs (boolean for backwards compat, or object for granular control)
   */
  constructor(pluginApi: Plugin, targetFile: string, debug?: boolean | DependencyResolverDebugConfig)
  constructor(io: IOAdapter, targetFile: string, debug?: boolean | DependencyResolverDebugConfig)
  constructor(pluginOrIo: Plugin | IOAdapter, targetFile: string, debug: boolean | DependencyResolverDebugConfig = false) {
    const isPlugin = typeof (pluginOrIo as any)?.call === 'function'
    this.pluginApi = isPlugin ? (pluginOrIo as Plugin) : null
    this.io = isPlugin ? new RemixPluginAdapter(this.pluginApi as any) : (pluginOrIo as IOAdapter)
    
    // Handle both boolean (backwards compat) and object debug config
    if (typeof debug === 'boolean') {
      this.debugConfig = {
        enabled: debug,
        tree: debug,
        fileProcessing: debug,
        imports: debug,
        storage: debug,
        localhost: debug,
        packageContext: debug,
        resolutionIndex: debug
      }
    } else {
      this.debugConfig = {
        enabled: debug.enabled ?? true,
        tree: debug.tree ?? debug.enabled ?? false,
        fileProcessing: debug.fileProcessing ?? debug.enabled ?? true,
        imports: debug.imports ?? debug.enabled ?? true,
        storage: debug.storage ?? debug.enabled ?? false,
        localhost: debug.localhost ?? debug.enabled ?? true,
        packageContext: debug.packageContext ?? debug.enabled ?? false,
        resolutionIndex: debug.resolutionIndex ?? debug.enabled ?? false
      }
    }
    
    const legacyDebug = this.debugConfig.enabled || false
    console.log(`[DependencyResolver] 🧠 Created with debug=`, this.debugConfig)
    this.logger = new Logger(this.pluginApi || undefined, legacyDebug)
    this.warnings = new WarningSystem(this.logger, { verbose: !!legacyDebug })
    if (isPlugin) {
      this.resolver = new ImportResolver(this.pluginApi as any, targetFile, legacyDebug)
    } else {
      this.resolver = new ImportResolver(this.io, targetFile, legacyDebug)
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
    if (!this.debugConfig.enabled) return
    console.log(message, ...args)
  }

  private logIf(category: keyof DependencyResolverDebugConfig, message: string, ...args: any[]): void {
    if (!this.debugConfig.enabled) return
    if (this.debugConfig[category]) console.log(message, ...args)
  }

  /**
   * Build the dependency tree starting from an entry file and return a bundle of sources
   * Output: Map<originalImportPath, content>
   */
  public async buildDependencyTree(entryFile: string): Promise<Map<string, string>> {
    this.logIf('tree', `[DependencyResolver] 🌳 Building dependency tree from: ${entryFile}`)
    this.sourceFiles.clear()
    this.processedFiles.clear()
    this.importGraph.clear()
    this.fileToPackageContext.clear()
    // Ensure resolution index is loaded so we can record per-file mappings
    if (!this.resolutionIndex) {
      this.resolutionIndex = this.pluginApi
        ? new ResolutionIndex(this.pluginApi as any, this.debugConfig.enabled || false)
        : (new FileResolutionIndex(this.io, this.debugConfig.enabled || false) as unknown as ResolutionIndex)
    }
    if (!this.resolutionIndexInitialized) {
      await this.resolutionIndex.load()
      this.resolutionIndexInitialized = true
    }
    try {
      await this.processFile(entryFile, null)
      this.logIf('tree', `[DependencyResolver] ✅ Built source bundle with ${this.sourceFiles.size} files`)
      return this.sourceFiles
    } catch (err) {
      this.logIf('tree', `[DependencyResolver] ❌ Failed to build dependency tree from ${entryFile}:`, err)
      throw err
    }
  }

  private isLocalFile(path: string): boolean {
    // External schemes are never local
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('npm:')) return false
    // Treat on-disk cached deps as local (they are already materialized in workspace)
    if (path.startsWith('.deps/')) return path.endsWith('.sol')
    // Check special npm imports (e.g., hardhat/console.sol)
    if (SPECIAL_NPM_IMPORTS.some(spec => spec.isNpmImport(path))) return false
    // Everything else that is a .sol path in the workspace (including relative paths) is local
    return path.endsWith('.sol') && !path.includes('@') // && !path.includes('node_modules')
  }

  /**
   * Try to find a file in localhost (remixd) paths when it's not in the workspace.
   * Checks in order: installed_contracts/, node_modules/, .deps/remix-tests/
   */
  private async tryLocalhostPaths(importPath: string): Promise<{ path: string; content: string } | null> {
    // Check if localhost is connected using the IOAdapter interface
    let isConnected = false
    try {
      if (typeof (this.io as any).isLocalhostConnected === 'function') {
        isConnected = await (this.io as any).isLocalhostConnected()
      }
    } catch (err) {
      this.logIf('localhost', `[DependencyResolver]   ⚠️  Error checking localhost connection:`, err)
      isConnected = false
    }

    if (!isConnected) {
      this.logIf('localhost', `[DependencyResolver]   ℹ️  Localhost not connected, skipping remixd paths`)
      return null
    }

    this.logIf('localhost', `[DependencyResolver]   🔌 Localhost connected, trying remixd paths...`)

    // Build candidate paths in order of importance
    const candidatePaths = [
      `localhost/installed_contracts/${importPath}`,
      `localhost/node_modules/${importPath}`,
      `localhost/.deps/remix-tests/${importPath}`
    ]

    // Try each path in order
    for (const candidatePath of candidatePaths) {
      try {
        this.logIf('localhost', `[DependencyResolver]   🔍 Trying: ${candidatePath}`)
        const content = await this.io.readFile(candidatePath)
        if (content) {
          this.logIf('localhost', `[DependencyResolver]   ✅ Found at: ${candidatePath}`)
          // Record normalized name for IDE features
          try {
            if (typeof (this.io as any).addNormalizedName === 'function') {
              await (this.io as any).addNormalizedName(candidatePath, importPath)
            }
          } catch { }
          return { path: candidatePath, content }
        }
      } catch {
        // File not found at this path, try next
        continue
      }
    }

    this.logIf('localhost', `[DependencyResolver]   ❌ Not found in any localhost paths`)
    return null
  }

  // moved to utils/dependency-helpers

  private async processFile(importPath: string, requestingFile: string | null, packageContext?: string): Promise<void> {
    if (!importPath.endsWith('.sol')) {
      this.logIf('fileProcessing', `[DependencyResolver] ❌ Invalid import: "${importPath}" does not end with .sol extension`)
      try { await this.warnings.emitInvalidSolidityImport(importPath) } catch { }
      throw new Error(`Invalid import: "${importPath}" does not end with .sol extension`)
    }
    if (this.processedFiles.has(importPath)) {
      this.logIf('fileProcessing', `[DependencyResolver]   ⏭️  Already processed: ${importPath}`)
      return
    }

    this.logIf('fileProcessing', `[DependencyResolver] 📄 Processing: ${importPath}`)
    this.logIf('fileProcessing', `[DependencyResolver]   📍 Requested by: ${requestingFile || 'entry point'}`)

    if (packageContext) {
      this.logIf('packageContext', `[DependencyResolver]   📦 Package context: ${packageContext}`)
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
      let actualPath = importPath // Track where we actually read from (might be localhost/...)
      const isLocal = this.isLocalFile(importPath)
      this.logIf('fileProcessing', `[DependencyResolver]   🔍 isLocalFile("${importPath}") = ${isLocal}`)
      if (isLocal) {
        this.logIf('fileProcessing', `[DependencyResolver]   📁 Local file detected, reading directly`, importPath)
        try {
          content = await this.io.readFile(importPath)
        } catch (err) {
          // Local file not found. If remixd is connected, try node_modules/installed_contracts paths
          this.logIf('fileProcessing', `[DependencyResolver]   🔄 Local file not found, checking localhost paths...`)
          
          const localhostResult = await this.tryLocalhostPaths(importPath)
          if (localhostResult) {
            content = localhostResult.content
            // Track the actual localhost path for internal use, but keep importPath as the key
            actualPath = localhostResult.path
            this.logIf('fileProcessing', `[DependencyResolver]   ✅ Found at: ${actualPath}`)
          } else {
            // Still not found. Try handler system ONLY (e.g., remix_tests.sol), do not externalize.
            this.logIf('fileProcessing', `[DependencyResolver]   🔄 Not in localhost, trying handler system...`)
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
              this.logIf('fileProcessing', `[DependencyResolver]   ⚠️  Local resolution failed for ${importPath}:`, e)
              try { await this.warnings.emitFailedToResolve(importPath) } catch { }
              throw new Error(`File not found: ${importPath}`)
            }
          }
        }
      } else {
        this.logIf('fileProcessing', `[DependencyResolver]   🌐 External import detected, delegating to ImportResolver`)
        content = await this.resolver.resolveAndSave(importPath, undefined, false)
      }

      if (!content) {
        if (content === '') return
        this.logIf('fileProcessing', `[DependencyResolver] ⚠️  Failed to resolve: ${importPath}`)
        try { await this.warnings.emitFailedToResolve(importPath) } catch { }
        throw new Error(`File not found: ${importPath}`)
      }

      const resolvedPath = this.isLocalFile(importPath) ? importPath : this.getResolvedPath(importPath)
      this.logIf('storage', `[DependencyResolver]   📥 Resolved path: ${resolvedPath}`)
      this.logIf('storage', `[DependencyResolver]   📝 Actual path: ${actualPath}`)
      this.logIf('storage', `[DependencyResolver]   📄 Import spec key: ${importPath}`)

      // Always store under the ORIGINAL IMPORT SPEC (compiler will request this)
      this.sourceFiles.set(importPath, content)
      this.logIf('storage', `[DependencyResolver]   ✅ Stored under spec key: ${importPath}`)

      // Maintain alias mapping for navigation/internal lookups
      if (resolvedPath !== importPath) this.aliasToSpec.set(resolvedPath, importPath)
      if (actualPath !== importPath && actualPath !== resolvedPath) this.aliasToSpec.set(actualPath, importPath)

      // Special-case npm imports like hardhat/console.sol: map versioned alias too
      const specialImport = SPECIAL_NPM_IMPORTS.find(spec => spec.isNpmImport(importPath))
      if (specialImport && resolvedPath !== importPath) {
        this.aliasToSpec.set(resolvedPath, importPath)
        this.logIf('storage', `[DependencyResolver]   🔄 Special alias: ${resolvedPath} → ${importPath}`)
      }

      // For scoped packages with versions, create unversioned alias in alias map only
      if (!this.isLocalFile(resolvedPath) && resolvedPath.includes('@') && resolvedPath.match(/@[^@]+@\d+\.\d+\.\d+\//)) {
        const unversionedPath = resolvedPath.replace(/(@[^@]+)@\d+\.\d+\.\d+\//, '$1/')
        if (unversionedPath !== importPath) this.aliasToSpec.set(unversionedPath, importPath)
        this.logIf('storage', `[DependencyResolver]   🔄 Alias (unversioned): ${unversionedPath} → ${importPath}`)
      }

      // Derive package context from path, regardless of local vs external.
      {
        const logFn = (msg: string, ...args: any[]) => this.logIf('packageContext', msg, ...args)
        const filePackageContext = extractPackageContext(importPath) || (!this.isLocalFile(importPath) ? extractUrlContext(importPath, logFn) : null)
        if (filePackageContext) {
          this.fileToPackageContext.set(resolvedPath, filePackageContext)
          this.resolver.setPackageContext(filePackageContext)
          if ((this.resolver as any).ensurePackageContextLoaded) {
            await (this.resolver as any).ensurePackageContextLoaded(filePackageContext)
          }
          this.logIf('packageContext', `[DependencyResolver]   📦 File belongs to: ${filePackageContext}`)
        }
      }

      // Before scanning imports, clear any prior index entries for this file so we write fresh mappings
      if (this.resolutionIndex) {
        try { this.resolutionIndex.clearFileResolutions(resolvedPath) } catch { }
      }

      const logFn = (msg: string, ...args: any[]) => this.logIf('imports', msg, ...args)
      const imports = extractImports(content, logFn)
      if (imports.length > 0) {
        this.logIf('imports', `[DependencyResolver]   🔗 Found ${imports.length} imports`)
        const resolvedImports = new Set<string>()
        const logFn = (msg: string, ...args: any[]) => this.logIf('packageContext', msg, ...args)
        const currentFilePackageContext = extractPackageContext(importPath) || (!this.isLocalFile(importPath) ? extractUrlContext(importPath, logFn) : null)

        for (const importedPath of imports) {
          this.logIf('imports', `[DependencyResolver]   ➡️  Processing import: "${importedPath}"`)
          // Start with the raw path as written in the file
          let nextPath = importedPath
          // Resolve relative paths using the CURRENT FILE PATH as base (original importPath)
          if (importedPath.startsWith('./') || importedPath.startsWith('../')) {
            const relLogFn = (msg: string, ...args: any[]) => this.logIf('imports', msg, ...args)
            nextPath = resolveRelativeImport(importPath, importedPath, relLogFn)
            this.logIf('imports', `[DependencyResolver]   🔗 Resolved relative: "${importedPath}" → "${nextPath}"`)
          }
          // Apply any remappings (e.g., oz/ → @openzeppelin/contracts@X/)
          const remapLogFn = (msg: string, ...args: any[]) => this.logIf('imports', msg, ...args)
          const beforeRemap = nextPath
          nextPath = applyRemappings(nextPath, this.remappings, remapLogFn)
          const wasRemapped = beforeRemap !== nextPath

          // Recursively process the child first so that resolver mappings are populated
          await this.processFile(nextPath, resolvedPath, currentFilePackageContext || undefined)

          // Graph should use the SPEC of the child (what compiler will request)
          const childGraphKey = nextPath
          resolvedImports.add(childGraphKey)

          // Record per-file resolution for Go-to-Definition: parent spec → child resolved path
          // Always record, even for relative (local) imports inside external packages, so navigation works everywhere.
          if (this.resolutionIndex) {
            try { 
              const childResolved = this.isLocalFile(nextPath) ? nextPath : this.getResolvedPath(nextPath)
              // Record the original import path
              this.resolutionIndex.recordResolution(importPath, importedPath, childResolved)
              this.logIf('resolutionIndex', `[DependencyResolver]   📝 Recorded: ${importPath} | ${importedPath} → ${childResolved}`)
              // If a remapping was applied, also record the remapped path so the resolution index
              // contains both the original (e.g., "oz/ERC20/ERC20.sol") and the remapped path
              // (e.g., "@openzeppelin/contracts@5.4.0/token/ERC20/ERC20.sol") pointing to the same file
              if (wasRemapped) {
                this.resolutionIndex.recordResolution(importPath, nextPath, childResolved)
                this.logIf('resolutionIndex', `[DependencyResolver]   📝 Recorded remapped: ${importPath} | ${nextPath} → ${childResolved}`)
              }
            } catch { }
          }
        }
        this.importGraph.set(importPath, resolvedImports)
      }
    } catch (err) {
      this.logIf('fileProcessing', `[DependencyResolver] ❌ Error processing ${importPath}:`, err)
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
  public toCompilerInput(): CompilerInput {
    const sources: CompilerInput = {}
    for (const [path, content] of this.sourceFiles.entries()) sources[path] = { content }
    return sources
  }

  /** Persist the resolution index for this session. */
  public async saveResolutionIndex(): Promise<void> {
    this.logIf('resolutionIndex', `[DependencyResolver] 💾 Saving resolution index...`)
    if (this.resolutionIndex) {
      try { await this.resolutionIndex.save() } catch { }
    }
  }
}
