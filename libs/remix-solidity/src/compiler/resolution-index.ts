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
import { Plugin } from '@remixproject/engine'
export class ResolutionIndex {
  private pluginApi: Plugin
  private indexPath: string = '.deps/npm/.resolution-index.json'
  private index: Record<string, Record<string, string>> = {}
  private isDirty: boolean = false
  private loadPromise: Promise<void> | null = null
  private isLoaded: boolean = false
  private debug: boolean = false

  constructor(pluginApi: Plugin, debug: boolean = false) {
    this.pluginApi = pluginApi
    this.debug = debug
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
   * Set up event listeners after plugin activation
   * Should be called after the plugin system is ready
   */
  onActivation(): void {
    // Listen for workspace changes and reload the index
    if (this.pluginApi && this.pluginApi.on) {
      this.pluginApi.on('filePanel', 'setWorkspace', () => {
        this.log(`[ResolutionIndex] 🔄 Workspace changed, reloading index...`)
        this.reload().catch(err => {
          this.log(`[ResolutionIndex] ⚠️  Failed to reload index after workspace change:`, err)
        })
      })
    }
  }

  /**
   * Load the existing index from disk
   */
  async load(): Promise<void> {
    // Return existing load promise if already loading
    if (this.loadPromise) {
      return this.loadPromise
    }
    
    // Return immediately if already loaded
    if (this.isLoaded) {
      return Promise.resolve()
    }
    
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

  /**
   * Ensure the index is loaded before using it
   */
  async ensureLoaded(): Promise<void> {
    if (!this.isLoaded) {
      await this.load()
    }
  }

  /**
   * Reload the index from disk (e.g., after workspace change)
   * This clears the current in-memory index and reloads from the file system
   */
  async reload(): Promise<void> {
    this.log(`[ResolutionIndex] 🔄 Reloading index (workspace changed)`)
    this.index = {}
    this.isDirty = false
    this.isLoaded = false
    this.loadPromise = null
    await this.load()
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
      this.log(`[ResolutionIndex] 📝 Recorded: ${sourceFile} | ${originalImport} → ${resolvedPath}`)
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
   * Look up an import path across ALL source files in the index
   * This is useful when navigating from library files (which aren't keys in the index)
   * @param importPath The import path to look up
   * @returns The resolved path from any source file that used it, or null if not found
   */
  lookupAny(importPath: string): string | null {
    // Search through all source files for this import
    for (const sourceFile in this.index) {
      if (this.index[sourceFile][importPath]) {
        this.log(`[ResolutionIndex] 🔍 Found import "${importPath}" in source file "${sourceFile}":`, this.index[sourceFile][importPath])
        return this.index[sourceFile][importPath]
      }
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
      this.log(`[ResolutionIndex] 🗑️  Cleared resolutions for: ${sourceFile}`)
    }
  }

  /**
   * Save the index to disk if it has been modified
   */
  async save(): Promise<void> {
    if (!this.isDirty) {
      this.log(`[ResolutionIndex] ⏭️  Index unchanged, skipping save`)
      return
    }

    try {
      // Ensure the directory exists before writing the file
      const directory = '.deps/npm'
      try {
        const exists = await this.pluginApi.call('fileManager', 'exists', directory)
        if (!exists) {
          await this.pluginApi.call('fileManager', 'mkdir', directory)
          this.log(`[ResolutionIndex] 📁 Created directory: ${directory}`)
        }
      } catch (dirErr) {
        this.log(`[ResolutionIndex] ⚠️  Could not ensure directory exists:`, dirErr)
      }
      
      const content = JSON.stringify(this.index, null, 2)
      await this.pluginApi.call('fileManager', 'writeFile', this.indexPath, content)
      this.isDirty = false
      this.log(`[ResolutionIndex] 💾 Saved index with ${Object.keys(this.index).length} source files to: ${this.indexPath}`)
    } catch (err) {
      this.log(`[ResolutionIndex] ❌ Failed to save index:`, err)
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
