import type { IOAdapter } from './io-adapter'

// Thin adapter around the Remix plugin APIs previously used throughout the resolver.
// This keeps the app-coupled logic at the edge while enabling a pure core.
export class RemixPluginAdapter implements IOAdapter {
  constructor(private readonly plugin: any) {}

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
    // Use the content import plugin to resolve arbitrary URLs and npm sources.
    const result = await this.plugin.call('contentImport', 'resolve', url)
    // result may be { content, cleanUrl } shape – we only need the content here.
    return typeof result === 'string' ? result : (result?.content ?? '')
  }

  async resolveAndSave(url: string, targetPath?: string, useOriginal?: boolean): Promise<string> {
    // Fetch content using contentImport.resolve to avoid any side-effects or internal remapping,
    // then persist to the deterministic destination under .deps (mirrors NodeIOAdapter logic).
    const contentResult = await this.plugin.call('contentImport', 'resolve', url)
    const content: string = typeof contentResult === 'string' ? contentResult : (contentResult?.content ?? '')

    // Determine destination
    let dest = targetPath
    const isHttp = (u: string) => u.startsWith('http://') || u.startsWith('https://')
    if (!dest) {
      if (isHttp(url)) {
        try {
          const u = new URL(url)
          const cleanPath = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname
          dest = `.deps/http/${u.hostname}/${cleanPath}`
        } catch {
          const safe = url.replace(/^[a-zA-Z]+:\/\//, '').replace(/[^a-zA-Z0-9._\-\/]/g, '_')
          dest = `.deps/http/${safe}`
        }
      } else {
        // Treat as npm-like path (e.g., "@scope/pkg@ver/path")
        dest = `.deps/npm/${url}`
      }
    } else if (!dest.startsWith('.deps/')) {
      dest = `.deps/${dest}`
    }

    await this.plugin.call('fileManager', 'setFile', dest, content)
    // Return content to the resolver (it expects the fetched file contents, not a path)
    return content
  }
}
