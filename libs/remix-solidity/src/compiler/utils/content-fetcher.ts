import { Plugin } from '@remixproject/engine'

export class ContentFetcher {
  constructor(private pluginApi: Plugin, private debug = false) {}

  private log(...args: any[]) {
    if (this.debug) console.log('[ContentFetcher]', ...args)
  }

  async resolve(url: string): Promise<any> {
    this.log('resolve', url)
    return this.pluginApi.call('contentImport', 'resolve', url)
  }

  async resolveAndSave(url: string, targetPath?: string, useOriginal?: boolean): Promise<string> {
    this.log('resolveAndSave', url, targetPath, useOriginal)
    return this.pluginApi.call('contentImport', 'resolveAndSave', url, targetPath, useOriginal)
  }

  async readFile(path: string): Promise<string> {
    this.log('readFile', path)
    return this.pluginApi.call('fileManager', 'readFile', path)
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.log('writeFile', path)
    await this.pluginApi.call('fileManager', 'writeFile', path, content)
  }

  async setFile(path: string, content: string): Promise<void> {
    this.log('setFile', path)
    await this.pluginApi.call('fileManager', 'setFile', path, content)
  }

  async exists(path: string): Promise<boolean> {
    try {
      return await this.pluginApi.call('fileManager', 'exists', path)
    } catch {
      return false
    }
  }

  async mkdir(path: string): Promise<void> {
    this.log('mkdir', path)
    await this.pluginApi.call('fileManager', 'mkdir', path)
  }
}
