'use strict'

/**
 * ResolutionIndex - Tracks import resolution mappings for editor navigation
 * 
 * This creates a persistent index file at .deps/npm/.resolution-index.json
 * that maps source files to their resolved import paths.
 * 
 * Format:
 * {
 *   "contracts/MyToken.sol": {
 *     "@openzeppelin/contracts/token/ERC20/ERC20.sol": "@openzeppelin/contracts@5.4.0/token/ERC20/ERC20.sol",
 *     "@chainlink/contracts/src/interfaces/IFeed.sol": "@chainlink/contracts@1.5.0/src/interfaces/IFeed.sol"
 *   }
 * }
 */
export class ResolutionIndex {
  private pluginApi: any
  private indexPath: string = '.deps/npm/.resolution-index.json'
  private index: Record<string, Record<string, string>> = {}
  private isDirty: boolean = false

  constructor(pluginApi: any) {
    this.pluginApi = pluginApi
  }

  /**
   * Load the existing index from disk
   */
  async load(): Promise<void> {
    try {
      const exists = await this.pluginApi.call('fileManager', 'exists', this.indexPath)
      if (exists) {
        const content = await this.pluginApi.call('fileManager', 'readFile', this.indexPath)
        this.index = JSON.parse(content)
        console.log(`[ResolutionIndex] 📖 Loaded index with ${Object.keys(this.index).length} source files`)
      } else {
        console.log(`[ResolutionIndex] 📝 No existing index found, starting fresh`)
        this.index = {}
      }
    } catch (err) {
      console.log(`[ResolutionIndex] ⚠️  Failed to load index:`, err)
      this.index = {}
    }
  }

  /**
   * Record a resolution mapping for a source file
   * @param sourceFile The file being compiled (e.g., "contracts/MyToken.sol")
   * @param originalImport The import as written in source (e.g., "@openzeppelin/contracts/token/ERC20/ERC20.sol")
   * @param resolvedPath The actual resolved path (e.g., "@openzeppelin/contracts@5.4.0/token/ERC20/ERC20.sol")
   */
  recordResolution(sourceFile: string, originalImport: string, resolvedPath: string): void {
    // Only record if there was an actual mapping (resolved path differs from original)
    if (originalImport === resolvedPath) {
      return
    }

    if (!this.index[sourceFile]) {
      this.index[sourceFile] = {}
    }

    // Only mark dirty if this is a new or changed mapping
    if (this.index[sourceFile][originalImport] !== resolvedPath) {
      this.index[sourceFile][originalImport] = resolvedPath
      this.isDirty = true
      console.log(`[ResolutionIndex] 📝 Recorded: ${sourceFile} | ${originalImport} → ${resolvedPath}`)
    }
  }

  /**
   * Look up how an import was resolved for a specific source file
   * @param sourceFile The source file that contains the import
   * @param importPath The import path to look up
   * @returns The resolved path, or null if not found
   */
  lookup(sourceFile: string, importPath: string): string | null {
    if (this.index[sourceFile] && this.index[sourceFile][importPath]) {
      return this.index[sourceFile][importPath]
    }
    return null
  }

  /**
   * Get all resolutions for a specific source file
   */
  getResolutionsForFile(sourceFile: string): Record<string, string> | null {
    return this.index[sourceFile] || null
  }

  /**
   * Clear resolutions for a specific source file
   * (useful when recompiling)
   */
  clearFileResolutions(sourceFile: string): void {
    if (this.index[sourceFile]) {
      delete this.index[sourceFile]
      this.isDirty = true
      console.log(`[ResolutionIndex] 🗑️  Cleared resolutions for: ${sourceFile}`)
    }
  }

  /**
   * Save the index to disk if it has been modified
   */
  async save(): Promise<void> {
    if (!this.isDirty) {
      console.log(`[ResolutionIndex] ⏭️  Index unchanged, skipping save`)
      return
    }

    try {
      const content = JSON.stringify(this.index, null, 2)
      await this.pluginApi.call('fileManager', 'writeFile', this.indexPath, content)
      this.isDirty = false
      console.log(`[ResolutionIndex] 💾 Saved index with ${Object.keys(this.index).length} source files`)
    } catch (err) {
      console.log(`[ResolutionIndex] ❌ Failed to save index:`, err)
    }
  }

  /**
   * Get the full index (for debugging)
   */
  getFullIndex(): Record<string, Record<string, string>> {
    return this.index
  }

  /**
   * Get statistics about the index
   */
  getStats(): { sourceFiles: number, totalMappings: number } {
    const sourceFiles = Object.keys(this.index).length
    let totalMappings = 0
    for (const file in this.index) {
      totalMappings += Object.keys(this.index[file]).length
    }
    return { sourceFiles, totalMappings }
  }
}
