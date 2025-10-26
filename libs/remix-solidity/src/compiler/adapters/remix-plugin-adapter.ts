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
    // Leverage existing optimized path in the app to both resolve and persist content.
    const result = await this.plugin.call('contentImport', 'resolveAndSave', url, targetPath, useOriginal)
    // resolveAndSave returns the local destination path in Remix; propagate it.
    return result
  }
}
