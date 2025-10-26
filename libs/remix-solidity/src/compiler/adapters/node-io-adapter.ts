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
    const dest = targetPath || url
    await this.setFile(dest, content)
    return content
  }
}
