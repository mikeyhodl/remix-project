import type { IOAdapter } from './io-adapter'
import { toHttpUrl } from '../utils/to-http-url'

// Thin adapter around the Remix plugin APIs previously used throughout the resolver.
// This keeps the app-coupled logic at the edge while enabling a pure core.
export class RemixPluginAdapter implements IOAdapter {
  private cacheEnabled = true
  constructor(private readonly plugin: any) {}

  setCacheEnabled(enabled: boolean): void { this.cacheEnabled = !!enabled }

  async isLocalhostConnected(): Promise<boolean> {
    try {
      const localhostProvider = await this.plugin.call('fileManager', 'getProviderByName', 'localhost')
      return localhostProvider && localhostProvider.isConnected && localhostProvider.isConnected()
    } catch {
      return false
    }
  }

  async addNormalizedName(normalizedPath: string, originalImport: string): Promise<void> {
    try {
      const localhostProvider = await this.plugin.call('fileManager', 'getProviderByName', 'localhost')
      if (localhostProvider && localhostProvider.addNormalizedName) {
        localhostProvider.addNormalizedName(normalizedPath, originalImport)
      }
    } catch (e) {
      // Non-critical, just for IDE features
    }
  }

  async readFile(path: string): Promise<string> {
    return await this.plugin.call('fileManager', 'readFile', path)
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.plugin.call('fileManager', 'writeFile', path, content)
  }

  async setFile(path: string, content: string): Promise<void> {
    await this.plugin.call('fileManager', 'setFile', path, content)
  }

  async exists(path: string): Promise<boolean> {
    return await this.plugin.call('fileManager', 'exists', path)
  }

  async mkdir(path: string): Promise<void> {
    await this.plugin.call('fileManager', 'mkdir', path)
  }

  async fetch(url: string): Promise<string> {
    // Treat absolute workspace paths as local files (no network)
    if (url.startsWith('/')) {
      return await this.readFile(url)
    }
    // Translate to a concrete HTTP URL and fetch directly in the browser/plugin runtime.
    const finalUrl = toHttpUrl(url)
    const res = await fetch(finalUrl)
    if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${finalUrl}`)
    return await res.text()
  }

  async resolveAndSave(url: string, targetPath?: string, useOriginal?: boolean): Promise<string> {
    // Short-circuit local absolute paths: read directly from workspace; don't save under .deps
    if (url.startsWith('/')) {
      return await this.readFile(url)
    }
    // Determine destination FIRST so we can skip fetching if already present
    let dest = targetPath
    const isHttp = (u: string) => u.startsWith('http://') || u.startsWith('https://')
    if (!dest) {
      if (isHttp(url)) {
        try {
          const u = new URL(url)
          const cleanPath = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname
          dest = `.deps/http/${u.hostname}/${cleanPath}`
        } catch {
          const safe = url.replace(/^[a-zA-Z]+:\/\//, '').replace(/[^-a-zA-Z0-9._/]/g, '_')
          dest = `.deps/http/${safe}`
        }
      } else {
        // Treat as npm-like path (e.g., "@scope/pkg@ver/path")
        dest = `.deps/npm/${url}`
      }
    } else if (!dest.startsWith('.deps/')) {
      dest = `.deps/${dest}`
    }

    // Update .raw_paths.json mapping regardless of cache hit/miss
    await this.updateRawPathsMapping(url, dest)

    // If cache is enabled and file already exists, return cached content
    if (this.cacheEnabled) {
      try {
        const exists = await this.exists(dest)
        if (exists) {
          return await this.readFile(dest)
        }
      } catch (_) {
        // If existence check fails, fall through to fetch/write
      }
    }

    // Fetch content directly using our simple translator
    const content: string = await this.fetch(url)
    console.log(`Fetched content from ${url}, saving to ${dest}`)
    await this.plugin.call('fileManager', 'setFile', dest, content)
    
    // Return content to the resolver (it expects the fetched file contents, not a path)
    return content
  }

  private async updateRawPathsMapping(url: string, dest: string): Promise<void> {
    const mappingPath = '.deps/.raw_paths.json'
    let mapping: Record<string, string> = {}
    
    try {
      const exists = await this.exists(mappingPath)
      if (exists) {
        const existing = await this.readFile(mappingPath)
        mapping = JSON.parse(existing)
      }
    } catch {
      // File doesn't exist or parse error, start fresh
    }
    
    mapping[url] = dest
    
    try {
      await this.setFile(mappingPath, JSON.stringify(mapping, null, 2))
    } catch (e) {
      console.warn('Failed to update .raw_paths.json:', e)
    }
  }
}
