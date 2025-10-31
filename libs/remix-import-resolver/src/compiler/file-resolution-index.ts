import type { IOAdapter } from './adapters/io-adapter'

/**
 * FileResolutionIndex (Node)
 *
 * Node-friendly implementation of the resolution index that persists mappings to
 * .deps/npm/.resolution-index.json for use by tooling (e.g., Go-to-Definition).
 */
export class FileResolutionIndex {
  private indexPath: string = '.deps/npm/.resolution-index.json'
  private index: Record<string, Record<string, string>> = {}
  private isDirty = false
  private loadPromise: Promise<void> | null = null
  private isLoaded = false

  constructor(private io: IOAdapter, private debug = false) {}

  private log(message: string, ...args: any[]) { if (this.debug) console.log(message, ...args) }

  /** Load the index from disk once per process (idempotent). */
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

  /** Ensure the index is loaded before operations. */
  async ensureLoaded(): Promise<void> { if (!this.isLoaded) await this.load() }

  /** Remove all mappings for a given source file (typically before rewriting them). */
  clearFileResolutions(sourceFile: string): void {
    if (this.index[sourceFile]) {
      delete this.index[sourceFile]
      this.isDirty = true
      this.log(`[FileResolutionIndex] Cleared: ${sourceFile}`)
    }
  }

  /** Record a single original → resolved mapping for a source file. */
  recordResolution(sourceFile: string, originalImport: string, resolvedPath: string): void {
    if (!this.index[sourceFile]) this.index[sourceFile] = {}
    const local = this.toLocalPath(resolvedPath)
    if (this.index[sourceFile][originalImport] !== local) {
      this.index[sourceFile][originalImport] = local
      this.isDirty = true
      this.log(`[FileResolutionIndex] Recorded: ${sourceFile} | ${originalImport} → ${local}`)
    }
  }

  /** Save the index to disk if it changed since the last save. */
  async save(): Promise<void> {
    if (!this.isDirty) return
    try {
      const dir = '.deps/npm'
      if (!(await this.io.exists(dir))) await this.io.mkdir(dir)
      await this.io.writeFile(this.indexPath, JSON.stringify(this.index, null, 2))
      this.isDirty = false
      this.log(`[FileResolutionIndex] Saved to ${this.indexPath}`)
    } catch (err) {
      this.log(`[FileResolutionIndex] Failed to save index:`, err)
    }
  }

  /** Translate a resolved path into a deterministic local path under .deps. */
  private toLocalPath(resolved: string): string {
    if (!resolved) return resolved
    if (resolved.startsWith('.deps/')) return resolved
    const isHttp = resolved.startsWith('http://') || resolved.startsWith('https://')
    if (isHttp) {
      try {
        const u = new URL(resolved)
        const cleanPath = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname
        return `.deps/http/${u.hostname}/${cleanPath}`
      } catch {
        const safe = resolved.replace(/^[a-zA-Z]+:\/\//, '').replace(/[^-a-zA-Z0-9._/]/g, '_')
        return `.deps/http/${safe}`
      }
    }
    if (resolved.startsWith('github/') || resolved.startsWith('ipfs/') || resolved.startsWith('swarm/')) {
      return `.deps/${resolved}`
    }
    return `${resolved}`
  }
}
