import type { IOAdapter } from './adapters/io-adapter'

/**
 * FileResolutionIndex - IOAdapter-backed variant of ResolutionIndex
 * Saves to .deps/npm/.resolution-index.json using provided IO.
 */
export class FileResolutionIndex {
  private io: IOAdapter
  private indexPath: string = '.deps/npm/.resolution-index.json'
  private index: Record<string, Record<string, string>> = {}
  private isDirty = false
  private loadPromise: Promise<void> | null = null
  private isLoaded = false
  private debug = false

  constructor(io: IOAdapter, debug = false) {
    this.io = io
    this.debug = debug
  }

  private log(message: string, ...args: any[]) {
    if (this.debug) console.log(message, ...args)
  }

  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise
    if (this.isLoaded) return
    this.loadPromise = (async () => {
      try {
        if (await this.io.exists(this.indexPath)) {
          const content = await this.io.readFile(this.indexPath)
          this.index = JSON.parse(content)
          this.log(`[FileResolutionIndex] Loaded ${Object.keys(this.index).length} files`)
        }
      } catch (err) {
        this.log(`[FileResolutionIndex] Failed to load index:`, err)
        this.index = {}
      } finally {
        this.isLoaded = true
      }
    })()
    return this.loadPromise
  }

  async ensureLoaded(): Promise<void> {
    if (!this.isLoaded) await this.load()
  }

  clearFileResolutions(sourceFile: string): void {
    if (this.index[sourceFile]) {
      delete this.index[sourceFile]
      this.isDirty = true
      this.log(`[FileResolutionIndex] Cleared: ${sourceFile}`)
    }
  }

  recordResolution(sourceFile: string, originalImport: string, resolvedPath: string): void {
    if (originalImport === resolvedPath) return
    if (!this.index[sourceFile]) this.index[sourceFile] = {}
    if (this.index[sourceFile][originalImport] !== resolvedPath) {
      this.index[sourceFile][originalImport] = resolvedPath
      this.isDirty = true
      this.log(`[FileResolutionIndex] Recorded: ${sourceFile} | ${originalImport} → ${resolvedPath}`)
    }
  }

  async save(): Promise<void> {
    if (!this.isDirty) return
    try {
      // ensure directory exists
      const dir = '.deps/npm'
      if (!(await this.io.exists(dir))) await this.io.mkdir(dir)
      await this.io.writeFile(this.indexPath, JSON.stringify(this.index, null, 2))
      this.isDirty = false
      this.log(`[FileResolutionIndex] Saved to ${this.indexPath}`)
    } catch (err) {
      this.log(`[FileResolutionIndex] Failed to save index:`, err)
    }
  }
}
