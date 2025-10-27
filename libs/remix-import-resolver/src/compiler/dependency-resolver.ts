'use strict'

import type { Plugin } from '@remixproject/engine'
import { ImportResolver } from './import-resolver'
import type { IOAdapter } from './adapters/io-adapter'
import { RemixPluginAdapter } from './adapters/remix-plugin-adapter'

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

  public setRemappings(remaps: Array<{ from: string; to: string }>) {
    this.remappings = remaps || []
  }

  private log(message: string, ...args: any[]): void {
    if (this.debug) console.log(message, ...args)
  }

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

  private resolveRelativeImport(currentFile: string, importPath: string): string {
    if (!importPath.startsWith('./') && !importPath.startsWith('../')) return importPath
    const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/'))
    const currentParts = currentDir.split('/')
    const importParts = importPath.split('/')
    for (const part of importParts) {
      if (part === '..') currentParts.pop()
      else if (part !== '.') currentParts.push(part)
    }
    const resolvedPath = currentParts.join('/')
    this.log(`[DependencyResolver]   🔗 Resolved relative import: ${importPath} → ${resolvedPath}`)
    return resolvedPath
  }

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
        const filePackageContext = this.extractPackageContext(importPath) || this.extractUrlContext(importPath)
        if (filePackageContext) {
          this.fileToPackageContext.set(resolvedPath, filePackageContext)
          this.resolver.setPackageContext(filePackageContext)
          this.log(`[DependencyResolver]   📦 File belongs to: ${filePackageContext}`)
        }
      }

      const imports = this.extractImports(content)
      if (imports.length > 0) {
        this.log(`[DependencyResolver]   🔗 Found ${imports.length} imports`)
        const resolvedImports = new Set<string>()
        const currentFilePackageContext = this.isLocalFile(importPath)
          ? null
          : (this.extractPackageContext(importPath) || this.extractUrlContext(importPath))

        for (const importedPath of imports) {
          this.log(`[DependencyResolver]   ➡️  Processing import: "${importedPath}"`)
          let resolvedImportPath = importedPath
          if (importedPath.startsWith('./') || importedPath.startsWith('../')) {
            resolvedImportPath = this.resolveRelativeImport(importPath, importedPath)
            this.log(`[DependencyResolver]   🔗 Resolved relative: "${importedPath}" → "${resolvedImportPath}"`)
          }
          resolvedImportPath = this.applyRemappings(resolvedImportPath)
          resolvedImports.add(resolvedImportPath)
          await this.processFile(resolvedImportPath, resolvedPath, currentFilePackageContext || undefined)
        }
        this.importGraph.set(resolvedPath, resolvedImports)
      }
    } catch (err) {
      this.log(`[DependencyResolver] ❌ Error processing ${importPath}:`, err)
    }
  }

  private extractImports(content: string): string[] {
    this.log(`[DependencyResolver]   📝 Extracting imports from content (${content.length} chars)`) 
    const imports: string[] = []
    let cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '')
    const lines = cleanContent.split('\n')
    const cleanedLines = lines.map(line => {
      const stringMatches: Array<{start: number, end: number}> = []
      let inString = false
      let stringChar = ''
      let escaped = false
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (escaped) { escaped = false; continue }
        if (char === '\\') { escaped = true; continue }
        if ((char === '"' || char === "'") && !inString) {
          inString = true
          stringChar = char
          stringMatches.push({start: i, end: -1})
        } else if (char === stringChar && inString) {
          inString = false
          stringMatches[stringMatches.length - 1].end = i
        }
      }
      const commentIndex = line.indexOf('//')
      if (commentIndex === -1) return line
      const isInsideString = stringMatches.some(match => match.start < commentIndex && (match.end === -1 || match.end > commentIndex))
      if (isInsideString) return line
      return line.substring(0, commentIndex)
    })
    cleanContent = cleanedLines.join('\n')

    const importPatterns = [
      /import\s+["']([^"']+)["']\s*;/g,
      /import\s*{\s*[^}]*}\s*from\s+["']([^"']+)["']\s*;/g,
      /import\s+\*\s+as\s+\w+\s+from\s+["']([^"']+)["']\s*;/g,
      /import\s+\w+\s+from\s+["']([^"']+)["']\s*;/g,
      /import\s+\w+\s*,\s*{\s*[^}]*}\s*from\s+["']([^"']+)["']\s*;/g
    ]
    for (const pattern of importPatterns) {
      let match
      while ((match = pattern.exec(cleanContent)) !== null) {
        const importPath = match[1]
        if (importPath && !imports.includes(importPath)) imports.push(importPath)
      }
      pattern.lastIndex = 0
    }
    if (imports.length > 0) this.log(`[DependencyResolver]   📝 Extracted ${imports.length} imports:`, imports)
    else this.log(`[DependencyResolver]   📝 No imports found`)
    return imports
  }

  private extractUrlContext(path: string): string | null {
    if (path.startsWith('ipfs://')) {
      const ipfsMatch = path.match(/^ipfs:\/\/(?:ipfs\/)?([^/]+)/)
      if (ipfsMatch) {
        const hash = ipfsMatch[1]
        this.log(`[DependencyResolver]   🌐 Extracted IPFS context: ipfs://${hash}`)
        return `ipfs://${hash}`
      }
    }
    if (path.startsWith('bzz-raw://') || path.startsWith('bzz://')) {
      const swarmMatch = path.match(/^(bzz-raw?:\/\/[^/]+)/)
      if (swarmMatch) {
        const baseUrl = swarmMatch[1]
        this.log(`[DependencyResolver]   🌐 Extracted Swarm context: ${baseUrl}`)
        return baseUrl
      }
    }
    if (!path.startsWith('http://') && !path.startsWith('https://')) return null
    const unpkgMatch = path.match(/^(https?:\/\/unpkg\.com\/@?[^/]+(?:\/[^@/]+)?@[^/]+)\//)
    if (unpkgMatch) {
      const baseUrl = unpkgMatch[1]
      this.log(`[DependencyResolver]   🌐 Extracted unpkg context: ${baseUrl}`)
      return baseUrl
    }
    const jsDelivrNpmMatch = path.match(/^(https?:\/\/cdn\.jsdelivr\.net\/npm\/@?[^/]+(?:\/[^@/]+)?@[^/]+)\//)
    if (jsDelivrNpmMatch) {
      const baseUrl = jsDelivrNpmMatch[1]
      this.log(`[DependencyResolver]   🌐 Extracted jsDelivr npm context: ${baseUrl}`)
      return baseUrl
    }
    const jsDelivrGhMatch = path.match(/^(https?:\/\/cdn\.jsdelivr\.net\/gh\/[^/]+\/[^/@]+@[^/]+)\//)
    if (jsDelivrGhMatch) {
      const baseUrl = jsDelivrGhMatch[1]
      this.log(`[DependencyResolver]   🌐 Extracted jsDelivr GitHub context: ${baseUrl}`)
      return baseUrl
    }
    const rawMatch = path.match(/^(https?:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+)\//)
    if (rawMatch) {
      const baseUrl = rawMatch[1]
      this.log(`[DependencyResolver]   🌐 Extracted raw.githubusercontent.com context: ${baseUrl}`)
      return baseUrl
    }
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

  private extractPackageContext(path: string): string | null {
    const scopedMatch = path.match(/^(@[^/]+\/[^/@]+)@([^/]+)/)
    if (scopedMatch) return `${scopedMatch[1]}@${scopedMatch[2]}`
    const regularMatch = path.match(/^([^/@]+)@([^/]+)/)
    if (regularMatch) return `${regularMatch[1]}@${regularMatch[2]}`
    return null
  }

  private getResolvedPath(importPath: string): string {
    const resolved = this.resolver.getResolution(importPath)
    return resolved || importPath
  }

  public getSourceBundle(): Map<string, string> {
    return this.sourceFiles
  }

  public getImportGraph(): Map<string, Set<string>> {
    return this.importGraph
  }

  public getPackageContext(filePath: string): string | null {
    return this.fileToPackageContext.get(filePath) || null
  }

  public toCompilerInput(): { [fileName: string]: { content: string } } {
    const sources: { [fileName: string]: { content: string } } = {}
    for (const [path, content] of this.sourceFiles.entries()) sources[path] = { content }
    return sources
  }

  public async saveResolutionIndex(): Promise<void> {
    this.log(`[DependencyResolver] 💾 Saving resolution index...`)
    await (this.resolver as any).saveResolutionsToIndex()
  }
}
