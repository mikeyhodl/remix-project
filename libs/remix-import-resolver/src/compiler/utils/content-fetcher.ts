import type { IOAdapter } from '../adapters/io-adapter'
import { Logger } from './logger'

export class ContentFetcher {
  private cacheEnabled = true
  private logger: Logger

  constructor(private io: IOAdapter, private debug = false) {
    this.logger = new Logger(undefined, debug)
  }

  private log(...args: any[]) {
    this.logger.logIf('contentFetcher', '[ContentFetcher]', ...args)
  }

  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = !!enabled
    if (typeof (this.io as any).setCacheEnabled === 'function') {
      try { (this.io as any).setCacheEnabled(this.cacheEnabled) } catch {}
    }
  }

  async resolve(url: string): Promise<any> {
    this.log('resolve', url)
    const content = await this.io.fetch(url)
    return { content }
  }

  async resolveAndSave(url: string, targetPath?: string, useOriginal?: boolean): Promise<string> {
    this.log('resolveAndSave', url, targetPath, useOriginal)
    if (this.io.resolveAndSave) {
      return this.io.resolveAndSave(url, targetPath, useOriginal)
    }
    const content = await this.io.fetch(url)
    const dest = targetPath || url
    await this.io.setFile(dest, content)
    return content
  }

  async readFile(path: string): Promise<string> { return this.io.readFile(path) }
  async writeFile(path: string, content: string): Promise<void> { await this.io.writeFile(path, content) }
  async setFile(path: string, content: string): Promise<void> { await this.io.setFile(path, content) }
  async exists(path: string): Promise<boolean> { try { return await this.io.exists(path) } catch { return false } }
  async mkdir(path: string): Promise<void> { await this.io.mkdir(path) }
}
