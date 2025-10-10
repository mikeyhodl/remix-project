'use strict'

import { Plugin } from '@remixproject/engine'
import { ImportResolver } from './import-resolver'

/**
 * Pre-compilation dependency tree builder
 * 
 * This class manually walks the Solidity import graph BEFORE compilation,
 * tracking which file requests which import. This enables accurate resolution
 * of dependencies even when multiple versions of packages are used.
 * 
 * Key difference from compiler's missing imports callback:
 * - We know the REQUESTING file for each import
 * - We can resolve based on that file's package context
 * - We build the complete source bundle before compiling
 */
export class DependencyResolver {
  private pluginApi: Plugin
  private resolver: ImportResolver
  private sourceFiles: Map<string, string> = new Map() // resolved path -> content
  private processedFiles: Set<string> = new Set() // Track already processed files
  private importGraph: Map<string, Set<string>> = new Map() // file -> files it imports
  private fileToPackageContext: Map<string, string> = new Map() // file -> package@version it belongs to
  private debug: boolean = false

  constructor(pluginApi: Plugin, targetFile: string, debug: boolean = false) {
    this.pluginApi = pluginApi
    this.debug = debug
    this.resolver = new ImportResolver(pluginApi, targetFile, debug)
  }

  /**
   * Internal debug logging method
   */
  private log(message: string, ...args: any[]): void {
    if (this.debug) {
      console.log(message, ...args)
    }
  }

  /**
   * Build complete dependency tree starting from entry file
   * Returns a map of resolved paths to their contents
   */
  public async buildDependencyTree(entryFile: string): Promise<Map<string, string>> {
    this.log(`[DependencyResolver] 🌳 Building dependency tree from: ${entryFile}`)
    
    this.sourceFiles.clear()
    this.processedFiles.clear()
    this.importGraph.clear()
    this.fileToPackageContext.clear()
    
    // Start recursive import resolution
    await this.processFile(entryFile, null)
    
    this.log(`[DependencyResolver] ✅ Built source bundle with ${this.sourceFiles.size} files`)
    
    return this.sourceFiles
  }

  /**
   * Check if a path is a local file (not an npm package)
   */
  private isLocalFile(path: string): boolean {
    // Local files typically:
    // - End with .sol
    // - Don't start with @ or contain package-like structure
    // - Are relative paths or simple filenames
    // - But NOT relative paths within npm packages (those should be resolved via ImportResolver)
    return path.endsWith('.sol') && !path.includes('@') && !path.includes('node_modules') && !path.startsWith('../') && !path.startsWith('./')
  }

  /**
   * Resolve a relative import path against the current file
   * E.g., if currentFile is "@chainlink/contracts-ccip@1.6.1/contracts/applications/CCIPClientExample.sol"
   * and importPath is "../libraries/Client.sol", 
   * result should be "@chainlink/contracts-ccip@1.6.1/contracts/libraries/Client.sol"
   */
  private resolveRelativeImport(currentFile: string, importPath: string): string {
    if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
      return importPath // Not a relative path
    }

    // Get the directory of the current file
    const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/'))
    
    // Split paths into parts
    const currentParts = currentDir.split('/')
    const importParts = importPath.split('/')
    
    // Process the relative path
    for (const part of importParts) {
      if (part === '..') {
        currentParts.pop() // Go up one directory
      } else if (part === '.') {
        // Stay in current directory, do nothing
      } else {
        currentParts.push(part)
      }
    }
    
    const resolvedPath = currentParts.join('/')
    this.log(`[DependencyResolver]   🔗 Resolved relative import: ${importPath} → ${resolvedPath}`)
    return resolvedPath
  }

  /**
   * Process a single file: fetch content, extract imports, resolve dependencies
   */
  private async processFile(
    importPath: string, 
    requestingFile: string | null,
    packageContext?: string
  ): Promise<void> {
    // Avoid processing the same file twice
    if (this.processedFiles.has(importPath)) {
      this.log(`[DependencyResolver]   ⏭️  Already processed: ${importPath}`)
      return
    }

    this.log(`[DependencyResolver] 📄 Processing: ${importPath}`)
    this.log(`[DependencyResolver]   📍 Requested by: ${requestingFile || 'entry point'}`)
    
    if (packageContext) {
      this.log(`[DependencyResolver]   📦 Package context: ${packageContext}`)
      this.fileToPackageContext.set(importPath, packageContext)
      
      // Tell the resolver about this context so it can make context-aware decisions
      this.resolver.setPackageContext(packageContext)
    }

    this.processedFiles.add(importPath)

    try {
      let content: string

      // Handle local files differently from npm packages
      if (this.isLocalFile(importPath)) {
        this.log(`[DependencyResolver]   📁 Local file detected, reading directly`, importPath)
        // For local files, read directly from file system
        content = await this.pluginApi.call('fileManager', 'readFile', importPath)
      } else {
        // For npm packages, use the resolver
        content = await this.resolver.resolveAndSave(importPath, undefined, false)
      }
      
      if (!content) {
        this.log(`[DependencyResolver] ⚠️  Failed to resolve: ${importPath}`)
        return
      }

      // Store the resolved content using the original import path as key
      // The compiler expects source keys to match import statements exactly
      const resolvedPath = this.isLocalFile(importPath) ? importPath : this.getResolvedPath(importPath)
      this.sourceFiles.set(importPath, content)
      
      // If this is a versioned path (like @package@1.5.0/...) but the original import 
      // was unversioned, also store under the unversioned path for compiler compatibility
      if (!this.isLocalFile(importPath) && importPath.includes('@') && importPath.match(/@[^/]+@\d+\.\d+\.\d+\//)) {
        const unversionedPath = importPath.replace(/@([^@/]+(?:\/[^@/]+)?)@\d+\.\d+\.\d+\//, '@$1/')
        this.sourceFiles.set(unversionedPath, content)
        this.log(`[DependencyResolver]   🔄 Also stored under unversioned path: ${unversionedPath}`)
      }
      

      
      // Determine package context for this file (only for npm packages)
      if (!this.isLocalFile(importPath)) {
        const filePackageContext = this.extractPackageContext(importPath)
        if (filePackageContext) {
          this.fileToPackageContext.set(resolvedPath, filePackageContext)
          this.log(`[DependencyResolver]   📦 File belongs to: ${filePackageContext}`)
        }
      }

      // Extract imports from this file
      const imports = this.extractImports(content)
      
      if (imports.length > 0) {
        this.log(`[DependencyResolver]   🔗 Found ${imports.length} imports`)
        this.importGraph.set(resolvedPath, new Set(imports))
        
        // Determine the package context to pass to child imports
        const currentFilePackageContext = this.isLocalFile(importPath) ? null : this.extractPackageContext(importPath)
        
        // Recursively process each import
        for (const importedPath of imports) {
          this.log(`[DependencyResolver]   ➡️  Processing import: ${importedPath}`)
          
          // Resolve relative imports against the original import path (not the resolved path)
          // This ensures the resolved import matches what the compiler expects
          let resolvedImportPath = importedPath
          if (importedPath.startsWith('./') || importedPath.startsWith('../')) {
            resolvedImportPath = this.resolveRelativeImport(importPath, importedPath)
            this.log(`[DependencyResolver]   🔗 Resolving import via ImportResolver: "${resolvedImportPath}"`)
          }
          
          await this.processFile(resolvedImportPath, resolvedPath, currentFilePackageContext)
        }
      }
    } catch (err) {
      this.log(`[DependencyResolver] ❌ Error processing ${importPath}:`, err)
    }
  }

  /**
   * Extract import statements from Solidity source code
   * Handles multi-line imports, ignores commented imports, and avoids string literals
   */
  private extractImports(content: string): string[] {
    const imports: string[] = []
    
    // Step 1: Remove all comments to avoid false positives
    // Remove single-line comments: // comment
    let cleanContent = content.replace(/\/\/.*$/gm, '')
    
    // Remove multi-line comments: /* comment */
    cleanContent = cleanContent.replace(/\/\*[\s\S]*?\*\//g, '')
    
    // Step 2: Match import statements directly from the cleaned content
    // Match various import patterns across multiple lines
    const importPatterns = [
      // import "path/to/file.sol";
      /import\s+["']([^"']+)["']\s*;/g,
      
      // import {Symbol1, Symbol2} from "path/to/file.sol";
      /import\s*{\s*[^}]*}\s*from\s+["']([^"']+)["']\s*;/g,
      
      // import * as Name from "path/to/file.sol";
      /import\s+\*\s+as\s+\w+\s+from\s+["']([^"']+)["']\s*;/g,
      
      // import Name from "path/to/file.sol";
      /import\s+\w+\s+from\s+["']([^"']+)["']\s*;/g,
      
      // import Name, {Symbol} from "path/to/file.sol";  
      /import\s+\w+\s*,\s*{\s*[^}]*}\s*from\s+["']([^"']+)["']\s*;/g
    ]
    
    // Apply each pattern to the cleaned content
    for (const pattern of importPatterns) {
      let match
      while ((match = pattern.exec(cleanContent)) !== null) {
        const importPath = match[1]
        if (importPath && !imports.includes(importPath)) {
          imports.push(importPath)
        }
      }
      // Reset regex state for next pattern
      pattern.lastIndex = 0
    }
    
    if (this.debug && imports.length > 0) {
      this.log(`[DependencyResolver]   📝 Extracted imports:`, imports)
    }
    
    return imports
  }

  /**
   * Extract package context from a file path
   * E.g., "@openzeppelin/contracts@4.8.0/token/ERC20/IERC20.sol" -> "@openzeppelin/contracts@4.8.0"
   */
  private extractPackageContext(path: string): string | null {
    // Match: @scope/package@version or package@version at start of path
    const scopedMatch = path.match(/^(@[^/]+\/[^/@]+)@([^/]+)/)
    if (scopedMatch) {
      return `${scopedMatch[1]}@${scopedMatch[2]}`
    }
    
    const regularMatch = path.match(/^([^/@]+)@([^/]+)/)
    if (regularMatch) {
      return `${regularMatch[1]}@${regularMatch[2]}`
    }
    
    return null
  }

  /**
   * Get the resolved path for a file (what the compiler will see)
   */
  private getResolvedPath(importPath: string): string {
    // Get the actual resolved path from the ImportResolver's resolutions
    const resolved = this.resolver.getResolution(importPath)
    return resolved || importPath
  }

  /**
   * Get the complete source bundle as a map
   */
  public getSourceBundle(): Map<string, string> {
    return this.sourceFiles
  }

  /**
   * Get the import graph (which files import which)
   */
  public getImportGraph(): Map<string, Set<string>> {
    return this.importGraph
  }

  /**
   * Get the package context for a file
   */
  public getPackageContext(filePath: string): string | null {
    return this.fileToPackageContext.get(filePath) || null
  }

  /**
   * Convert source bundle to Solidity compiler input format
   */
  public toCompilerInput(): { [fileName: string]: { content: string } } {
    const sources: { [fileName: string]: { content: string } } = {}
    
    for (const [path, content] of this.sourceFiles.entries()) {
      sources[path] = { content }
    }
    
    return sources
  }

  /**
   * Save all import resolutions to the resolution index for "Go to Definition" functionality
   * This should be called after buildDependencyTree() completes successfully
   */
  public async saveResolutionIndex(): Promise<void> {
    this.log(`[DependencyResolver] 💾 Saving resolution index...`)
    await this.resolver.saveResolutionsToIndex()
  }
}
