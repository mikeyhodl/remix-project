import type { IOAdapter } from './io-adapter'
import { promises as fs } from 'fs'
import { dirname } from 'path'

function isHttp(url: string) {
  return url.startsWith('http://') || url.startsWith('https://')
}

function toNpmCdn(url: string) {
  // Map bare npm path like "@scope/pkg@1.2.3/file" or "@scope/pkg/file" to jsDelivr
  // Preserve @version if present
  return `https://cdn.jsdelivr.net/npm/${url}`
}

export class NodeIOAdapter implements IOAdapter {
  async readFile(path: string): Promise<string> {
    return await fs.readFile(path, 'utf8')
  }

  async writeFile(path: string, content: string): Promise<void> {
    await fs.writeFile(path, content, 'utf8')
  }

  async setFile(path: string, content: string): Promise<void> {
    await fs.mkdir(dirname(path), { recursive: true })
    await fs.writeFile(path, content, 'utf8')
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.stat(path)
      return true
    } catch {
      return false
    }
  }

  async mkdir(path: string): Promise<void> {
    await fs.mkdir(path, { recursive: true })
  }

  async fetch(url: string): Promise<string> {
    const finalUrl = isHttp(url) ? url : toNpmCdn(url)
    const res = await fetch(finalUrl)
    if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${finalUrl}`)
    return await res.text()
  }

  async resolveAndSave(url: string, targetPath?: string, _useOriginal?: boolean): Promise<string> {
    const content = await this.fetch(url)
    let dest = targetPath
    if (!dest) {
      // Determine a deterministic destination under .deps
      if (isHttp(url)) {
        try {
          const u = new URL(url)
          const cleanPath = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname
          dest = `.deps/http/${u.hostname}/${cleanPath}`
        } catch {
          // Fallback to hashing or raw, but keep inside .deps/http
          const safe = url.replace(/^[a-zA-Z]+:\/\//, '').replace(/[^a-zA-Z0-9._\-\/]/g, '_')
          dest = `.deps/http/${safe}`
        }
      } else {
        // Treat as npm-like path (e.g., "@scope/pkg@ver/path")
        dest = `.deps/npm/${url}`
      }
    } else if (!dest.startsWith('.deps/')) {
      // Ensure all resolver-managed artifacts live under .deps
      dest = `.deps/${dest}`
    }
    await this.setFile(dest, content)
    return content
  }
}
