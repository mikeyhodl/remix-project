'use strict'

import { Plugin } from '@remixproject/engine'
import { ImportResolver } from '@remix-project/import-resolver'
import type { IOAdapter } from '@remix-project/import-resolver'
import { RemixPluginAdapter } from '@remix-project/import-resolver'

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
  private pluginApi: Plugin | null
  private io: IOAdapter
  private resolver: any
  private sourceFiles: Map<string, string> = new Map() // resolved path -> content
  private processedFiles: Set<string> = new Set() // Track already processed files
  private importGraph: Map<string, Set<string>> = new Map() // file -> files it imports
  private fileToPackageContext: Map<string, string> = new Map() // file -> package@version it belongs to
  private debug: boolean = false
  private remappings: Array<{ from: string; to: string }> = []

  // Overloaded constructor to support Plugin or IOAdapter
  constructor(pluginApi: Plugin, targetFile: string, debug?: boolean)
  constructor(io: IOAdapter, targetFile: string, debug?: boolean)
  constructor(pluginOrIo: Plugin | IOAdapter, targetFile: string, debug: boolean = false) {
    const isPlugin = typeof (pluginOrIo as any)?.call === 'function'
    this.pluginApi = isPlugin ? (pluginOrIo as Plugin) : null
    this.io = isPlugin ? new RemixPluginAdapter(this.pluginApi as Plugin) : (pluginOrIo as IOAdapter)
    this.debug = debug
    if (isPlugin) {
      this.resolver = new ImportResolver(this.pluginApi as Plugin, targetFile, debug)
    } else {
      this.resolver = new ImportResolver(this.io, targetFile, debug)
    }
  }

  /** Set remappings used to rewrite non-relative import specifiers. */
  public setRemappings(remaps: Array<{ from: string; to: string }>) {
    this.remappings = remaps || []
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
    // Also treat external URLs and npm: alias as non-local
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('npm:')) return false
    return path.endsWith('.sol') && !path.includes('@') && !path.includes('node_modules') && !path.startsWith('../') && !path.startsWith('./')
  }

  /**
   * Resolve a relative import path against the current file
   * E.g., if currentFile is "@chainlink/contracts-ccip@1.6.1/contracts/applications/CCIPClientExample.sol"
   * and importPath is "../libraries/Client.sol", 
   * result should be "@chainlink/contracts-ccip@1.6.1/contracts/libraries/Client.sol"
   * 
   * Also handles CDN URLs like:
   * - currentFile: "https://unpkg.com/@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol"
   * - importPath: "./IERC20.sol"
   * - result: "https://unpkg.com/@openzeppelin/contracts@4.8.0/token/ERC20/IERC20.sol"
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

  /** Apply prefix remappings (e.g., forge-style: prefix=target) to an import path. */
  private applyRemappings(importPath: string): string {
    if (importPath.startsWith('./') || importPath.startsWith('../')) return importPath
    for (const { from, to } of this.remappings) {
      if (!from) continue
      if (importPath === from || importPath.startsWith(from)) {
        const replaced = to + importPath.substring(from.length)
        this.log(`[DependencyResolver]   🔁 Remapped import: ${importPath} → ${replaced}`)
        return replaced
      }
    }
    return importPath
  }

  /**
   * Process a single file: fetch content, extract imports, resolve dependencies
   */
  private async processFile(
    importPath: string, 
    requestingFile: string | null,
    packageContext?: string
  ): Promise<void> {
    // Validate that import path points to a .sol file
    if (!importPath.endsWith('.sol')) {
      this.log(`[DependencyResolver] ❌ Invalid import: "${importPath}" does not end with .sol extension`)
      return
    }
    
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

      // Handle local files differently from npm/npm-alias/external urls
      if (this.isLocalFile(importPath)) {
        this.log(`[DependencyResolver]   📁 Local file detected, reading directly`, importPath)
        // For local files, read directly from adapter or plugin-backed adapter
        content = await this.io.readFile(importPath)
      } else {
        // For npm packages and external URLs (http/https/npm:), use the resolver
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
      

      
      // Determine context for this file (npm packages or external URL bases)
      if (!this.isLocalFile(importPath)) {
        const filePackageContext = this.extractPackageContext(importPath) || this.extractUrlContext(importPath)
        if (filePackageContext) {
          this.fileToPackageContext.set(resolvedPath, filePackageContext)
          this.resolver.setPackageContext(filePackageContext)
          this.log(`[DependencyResolver]   📦 File belongs to: ${filePackageContext}`)
        }
      }

      // Extract imports from this file
      const imports = this.extractImports(content)
      
      if (imports.length > 0) {
        this.log(`[DependencyResolver]   🔗 Found ${imports.length} imports`)

        // Build a set of resolved import paths (after relative resolution and remappings)
        const resolvedImports = new Set<string>()

        // Determine the package/url context to pass to child imports
        const currentFilePackageContext = this.isLocalFile(importPath)
          ? null
          : (this.extractPackageContext(importPath) || this.extractUrlContext(importPath))
        
        // Recursively process each import
        for (const importedPath of imports) {
          this.log(`[DependencyResolver]   ➡️  Processing import: "${importedPath}"`)
          
          // Resolve relative imports against the original import path (not the resolved path)
          // This ensures the resolved import matches what the compiler expects
          let resolvedImportPath = importedPath
          if (importedPath.startsWith('./') || importedPath.startsWith('../')) {
            resolvedImportPath = this.resolveRelativeImport(importPath, importedPath)
            this.log(`[DependencyResolver]   🔗 Resolved relative: "${importedPath}" → "${resolvedImportPath}"`)
          }
          // Apply remappings for non-relative specifiers (or after relative resolution)
          resolvedImportPath = this.applyRemappings(resolvedImportPath)

          // Track the resolved import path in the graph to keep keys aligned with stored sources
          resolvedImports.add(resolvedImportPath)
          
          await this.processFile(resolvedImportPath, resolvedPath, currentFilePackageContext)
        }

        // Store the resolved imports for this file in the graph
        this.importGraph.set(resolvedPath, resolvedImports)
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
    this.log(`[DependencyResolver]   📝 Extracting imports from content (${content.length} chars)`)
    const imports: string[] = []
    
    // Step 1: Remove all comments to avoid false positives
    // But be careful not to remove // inside strings (like URLs!)
    
    // First, remove multi-line comments: /* comment */
    let cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '')
    
    // For single-line comments, we need to be smarter
    // Split by lines and only remove // if it's not inside quotes
    const lines = cleanContent.split('\n')
    const cleanedLines = lines.map(line => {
      // Find all quoted strings in the line
      const stringMatches: Array<{start: number, end: number}> = []
      let inString = false
      let stringChar = ''
      let escaped = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        
        if (escaped) {
          escaped = false
          continue
        }
        
        if (char === '\\') {
          escaped = true
          continue
        }
        
        if ((char === '"' || char === "'") && !inString) {
          inString = true
          stringChar = char
          stringMatches.push({start: i, end: -1})
        } else if (char === stringChar && inString) {
          inString = false
          stringMatches[stringMatches.length - 1].end = i
        }
      }
      
      // Find // that's not inside a string
      const commentIndex = line.indexOf('//')
      if (commentIndex === -1) return line
      
      // Check if this // is inside any string
      const isInsideString = stringMatches.some(match => 
        match.start < commentIndex && (match.end === -1 || match.end > commentIndex)
      )
      
      if (isInsideString) {
        return line // Keep the line as-is, // is part of a string
      } else {
        return line.substring(0, commentIndex) // Remove the comment
      }
    })
    
    cleanContent = cleanedLines.join('\n')
    
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
    
    if (imports.length > 0) {
      this.log(`[DependencyResolver]   📝 Extracted ${imports.length} imports:`, imports)
    } else {
      this.log(`[DependencyResolver]   📝 No imports found`)
    }
    
    return imports
  }

  /**
   * Extract a URL-based "package" context from an external source path so that
   * relative imports fetched from CDNs can stay scoped under the same base.
   *
   * Supported forms:
   * - https://unpkg.com/@scope/pkg@1.2.3/...
   * - https://cdn.jsdelivr.net/npm/@scope/pkg@1.2.3/...
   * - https://cdn.jsdelivr.net/gh/owner/repo@tag/...
   * - https://raw.githubusercontent.com/owner/repo/v1.2.3/...
   * - https://github.com/owner/repo/blob/v1.2.3/... (will be converted to raw.githubusercontent.com)
   *
   * Returns the base up to the version/tag segment so children can be resolved beneath it.
   */
  private extractUrlContext(path: string): string | null {
    // IPFS pattern: ipfs://QmHash/path or ipfs://ipfs/QmHash/path
    if (path.startsWith('ipfs://')) {
      // Extract the hash (everything after ipfs:// up to the first / or end of string)
      const ipfsMatch = path.match(/^ipfs:\/\/(?:ipfs\/)?([^/]+)/)
      if (ipfsMatch) {
        const hash = ipfsMatch[1]
        this.log(`[DependencyResolver]   🌐 Extracted IPFS context: ipfs://${hash}`)
        return `ipfs://${hash}`
      }
    }

    // Swarm pattern: bzz-raw://hash/path or bzz://hash/path
    if (path.startsWith('bzz-raw://') || path.startsWith('bzz://')) {
      const swarmMatch = path.match(/^(bzz-raw?:\/\/[^/]+)/)
      if (swarmMatch) {
        const baseUrl = swarmMatch[1]
        this.log(`[DependencyResolver]   🌐 Extracted Swarm context: ${baseUrl}`)
        return baseUrl
      }
    }

    if (!path.startsWith('http://') && !path.startsWith('https://')) return null

    // unpkg pattern: https://unpkg.com/@scope/pkg@version/...
    const unpkgMatch = path.match(/^(https?:\/\/unpkg\.com\/(@?[^/]+(?:\/[^@/]+)?)@([^/]+))\//)
    if (unpkgMatch) {
      const baseUrl = unpkgMatch[1]
      this.log(`[DependencyResolver]   🌐 Extracted unpkg context: ${baseUrl}`)
      return baseUrl
    }

    // jsDelivr npm pattern: https://cdn.jsdelivr.net/npm/@scope/pkg@version/...
    const jsDelivrNpmMatch = path.match(/^(https?:\/\/cdn\.jsdelivr\.net\/npm\/(@?[^/]+(?:\/[^@/]+)?)@([^/]+))\//)
    if (jsDelivrNpmMatch) {
      const baseUrl = jsDelivrNpmMatch[1]
      this.log(`[DependencyResolver]   🌐 Extracted jsDelivr npm context: ${baseUrl}`)
      return baseUrl
    }

    // jsDelivr GitHub pattern: https://cdn.jsdelivr.net/gh/owner/repo@tag/...
    const jsDelivrGhMatch = path.match(/^(https?:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^/@]+)@([^/]+))\//)
    if (jsDelivrGhMatch) {
      const baseUrl = jsDelivrGhMatch[1]
      this.log(`[DependencyResolver]   🌐 Extracted jsDelivr GitHub context: ${baseUrl}`)
      return baseUrl
    }

    // raw.githubusercontent.com pattern: https://raw.githubusercontent.com/owner/repo/tag/...
    const rawMatch = path.match(/^(https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+))\//)
    if (rawMatch) {
      const baseUrl = rawMatch[1]
      this.log(`[DependencyResolver]   🌐 Extracted raw.githubusercontent.com context: ${baseUrl}`)
      return baseUrl
    }

    // GitHub blob URL pattern: https://github.com/owner/repo/blob/tag/...
    // We should convert this to raw.githubusercontent.com for actual file fetching
    const githubBlobMatch = path.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\//)
    if (githubBlobMatch) {
      const owner = githubBlobMatch[1]
      const repo = githubBlobMatch[2]
      const ref = githubBlobMatch[3]
      const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}`
      this.log(`[DependencyResolver]   🌐 Converted GitHub blob to raw context: ${baseUrl}`)
      return baseUrl
    }

    this.log(`[DependencyResolver]   ⚠️  Could not extract URL context from: ${path}`)
    return null
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
