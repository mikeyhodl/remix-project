import type { IOAdapter } from '../adapters/io-adapter'

export class ContentFetcher {
  constructor(private io: IOAdapter, private debug = false) {}

  private log(...args: any[]) {
    if (this.debug) console.log('[ContentFetcher]', ...args)
  }

  async resolve(url: string): Promise<any> {
    this.log('resolve', url)
    // Standardize to return an object that may contain { content }
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

  async readFile(path: string): Promise<string> {
    this.log('readFile', path)
    return this.io.readFile(path)
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.log('writeFile', path)
    await this.io.writeFile(path, content)
  }

  async setFile(path: string, content: string): Promise<void> {
    this.log('setFile', path)
    await this.io.setFile(path, content)
  }

  async exists(path: string): Promise<boolean> {
    try {
      return await this.io.exists(path)
    } catch {
      return false
    }
  }

  async mkdir(path: string): Promise<void> {
    this.log('mkdir', path)
    await this.io.mkdir(path)
  }
}
