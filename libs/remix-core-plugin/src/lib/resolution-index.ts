'use strict'
import { Plugin } from '@remixproject/engine'

const profile = {
  name: 'resolutionIndex',
  displayName: 'resolution index',
  version: '0.0.1',
  methods: ['resolveImportFromIndex', 'resolvePath', 'refresh']
}

type Index = Record<string, Record<string, string>>

export class ResolutionIndexPlugin extends Plugin {
  private index: Index = {}
  private readonly indexPath = '.deps/npm/.resolution-index.json'

  constructor() {
    super(profile)
  }

  onActivation() {
    // Prime the in-memory index and keep it in sync
    this.loadIndex().catch(() => {})
    this.on('filePanel', 'setWorkspace', () => this.loadIndex())
    this.on('fileManager', 'fileAdded', (file: string) => { if (file === this.indexPath) this.loadIndex() })
    this.on('fileManager', 'fileChanged', (file: string) => { if (file === this.indexPath) this.loadIndex() })
    this.on('fileManager', 'fileRemoved', (file: string) => { if (file === this.indexPath) this.index = {} })
  }

  async refresh() {
    await this.loadIndex()
  }

  private async loadIndex() {
    try {
      const exists = await this.call('fileManager', 'exists', this.indexPath)
      if (!exists) {
        this.index = {}
        return
      }
      const content = await this.call('fileManager', 'readFile', this.indexPath)
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed === 'object') {
        this.index = parsed as Index
      } else {
        this.index = {}
      }
    } catch (e) {
      this.index = {}
    }
  }

  /**
   * Resolve an import path using the in-memory resolution index
   */
  async resolveImportFromIndex(sourceFile: string, importPath: string): Promise<string | null> {
    // 1) Direct lookup in the source file's mapping
    if (this.index[sourceFile] && this.index[sourceFile][importPath]) {
      return this.index[sourceFile][importPath]
    }
    // 2) Fallback: search across all base files
    for (const file in this.index) {
      if (this.index[file] && this.index[file][importPath]) {
        return this.index[file][importPath]
      }
    }
    return null
  }

  /**
   * Resolve a path (import or external path) to an internal file path for navigation use
   * Does not touch providers or the file system; uses only the in-memory index.
   */
  async resolvePath(sourceFile: string, inputPath: string): Promise<string> {
    const mapped = await this.resolveImportFromIndex(sourceFile, inputPath)
    return mapped || inputPath
  }
}
