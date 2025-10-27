'use strict'

import { Plugin } from '@remixproject/engine'

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

  async ensureLoaded(): Promise<void> { if (!this.isLoaded) await this.load() }

  async reload(): Promise<void> {
    this.log(`[ResolutionIndex] 🔄 Reloading index (workspace changed)`)
    this.index = {}
    this.isDirty = false
    this.isLoaded = false
    this.loadPromise = null
    await this.load()
  }

  recordResolution(sourceFile: string, originalImport: string, resolvedPath: string): void {
    if (originalImport === resolvedPath) return
    if (!this.index[sourceFile]) this.index[sourceFile] = {}
    if (this.index[sourceFile][originalImport] !== resolvedPath) {
      this.index[sourceFile][originalImport] = resolvedPath
      this.isDirty = true
      this.log(`[ResolutionIndex] 📝 Recorded: ${sourceFile} | ${originalImport} → ${resolvedPath}`)
    }
  }

  lookup(sourceFile: string, importPath: string): string | null {
    if (this.index[sourceFile] && this.index[sourceFile][importPath]) return this.index[sourceFile][importPath]
    return null
  }

  lookupAny(importPath: string): string | null {
    for (const sourceFile in this.index) {
      if (this.index[sourceFile][importPath]) return this.index[sourceFile][importPath]
    }
    return null
  }

  getResolutionsForFile(sourceFile: string): Record<string, string> | null { return this.index[sourceFile] || null }

  clearFileResolutions(sourceFile: string): void {
    if (this.index[sourceFile]) {
      delete this.index[sourceFile]
      this.isDirty = true
      this.log(`[ResolutionIndex] 🗑️  Cleared resolutions for: ${sourceFile}`)
    }
  }

  async save(): Promise<void> {
    if (!this.isDirty) { this.log(`[ResolutionIndex] ⏭️  Index unchanged, skipping save`); return }
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
