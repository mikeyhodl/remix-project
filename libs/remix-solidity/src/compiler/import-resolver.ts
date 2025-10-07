'use strict'

/**
 * ImportResolver - Per-compilation import resolution with isolated state
 * 
 * This class is instantiated once per compilation to maintain isolated
 * import mappings. It resolves package imports to their versioned equivalents
 * and manages the resolution of external dependencies.
 */
export class ImportResolver {
  private importMappings: Map<string, string>
  private pluginApi: any
  private targetFile: string

  constructor(pluginApi: any, targetFile: string) {
    this.pluginApi = pluginApi
    this.targetFile = targetFile
    this.importMappings = new Map()
    
    console.log(`[ImportResolver] 🆕 Created new resolver instance for: "${targetFile}"`)
  }

  public clearMappings(): void {
    console.log(`[ImportResolver] 🧹 Clearing all import mappings`)
    this.importMappings.clear()
  }

  public logMappings(): void {
    console.log(`[ImportResolver] 📊 Current import mappings for: "${this.targetFile}"`)
    if (this.importMappings.size === 0) {
      console.log(`[ImportResolver] ℹ️  No mappings defined`)
    } else {
      this.importMappings.forEach((value, key) => {
        console.log(`[ImportResolver]   ${key} → ${value}`)
      })
    }
  }

  private extractPackageName(url: string): string | null {
    const scopedMatch = url.match(/^(@[^/]+\/[^/@]+)/)
    if (scopedMatch) {
      return scopedMatch[1]
    }
    
    const regularMatch = url.match(/^([^/@]+)/)
    if (regularMatch) {
      return regularMatch[1]
    }
    
    return null
  }

  private async fetchAndMapPackage(packageName: string): Promise<void> {
    const mappingKey = `__PKG__${packageName}`
    
    if (this.importMappings.has(mappingKey)) {
      return
    }
    
    try {
      console.log(`[ImportResolver] 📦 Fetching package.json for ISOLATED mapping: ${packageName}`)
      
      // Use 'resolve' instead of 'resolveAndSave' to just fetch without saving
      // ContentImport will save it later if an actual import from this package is requested
      const packageJsonUrl = `${packageName}/package.json`
      const content = await this.pluginApi.call('contentImport', 'resolve', packageJsonUrl)
      
      const packageJson = JSON.parse(content.content || content)
      if (packageJson.version) {
        const versionedPackageName = `${packageName}@${packageJson.version}`
        this.importMappings.set(mappingKey, versionedPackageName)
        console.log(`[ImportResolver] ✅ Created ISOLATED mapping: ${mappingKey} → ${versionedPackageName}`)
        console.log(`[ImportResolver] 📊 Total isolated mappings: ${this.importMappings.size}`)
      }
    } catch (err) {
      console.log(`[ImportResolver] ⚠️  Failed to fetch package.json for ${packageName}:`, err)
    }
  }

  public async resolveAndSave(url: string, targetPath?: string, skipResolverMappings = false): Promise<string> {
    const packageName = this.extractPackageName(url)
    
    if (!skipResolverMappings && packageName) {
      const hasVersion = url.includes(`${packageName}@`)
      
      if (!hasVersion) {
        const mappingKey = `__PKG__${packageName}`
        
        if (!this.importMappings.has(mappingKey)) {
          console.log(`[ImportResolver] 🔍 First import from ${packageName}, fetching package.json...`)
          await this.fetchAndMapPackage(packageName)
        }
        
        if (this.importMappings.has(mappingKey)) {
          const versionedPackageName = this.importMappings.get(mappingKey)
          const mappedUrl = url.replace(packageName, versionedPackageName)
          console.log(`[ImportResolver] 🔀 Applying ISOLATED mapping: ${url} → ${mappedUrl}`)
          return this.resolveAndSave(mappedUrl, targetPath, true)
        } else {
          console.log(`[ImportResolver] ⚠️  No mapping available for ${mappingKey}`)
        }
      }
    }
    
    console.log(`[ImportResolver] 📥 Fetching file (skipping ContentImport global mappings): ${url}`)
    const content = await this.pluginApi.call('contentImport', 'resolveAndSave', url, targetPath, true)
    
    return content
  }

  public getTargetFile(): string {
    return this.targetFile
  }
}
