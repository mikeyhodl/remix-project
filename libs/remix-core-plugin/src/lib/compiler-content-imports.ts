'use strict'
import { Plugin } from '@remixproject/engine'
import { RemixURLResolver, githubFolderResolver } from '@remix-project/remix-url-resolver'

const profile = {
  name: 'contentImport',
  displayName: 'content import',
  version: '0.0.1',
  methods: ['resolve', 'resolveAndSave', 'isExternalUrl', 'resolveGithubFolder']
}

export type ResolvedImport = {
  content: string,
  cleanUrl: string
  type: string
}

export class CompilerImports extends Plugin {
  urlResolver: any
  constructor () {
    super(profile)
    this.urlResolver = new RemixURLResolver(async () => {
      try {
        let yarnLock
        if (await this.call('fileManager', 'exists', './yarn.lock')) {
          yarnLock = await this.call('fileManager', 'readFile', './yarn.lock')
        }

        let packageLock
        if (await this.call('fileManager', 'exists', './package-lock.json')) {
          packageLock = await this.call('fileManager', 'readFile', './package-lock.json')
          packageLock = JSON.parse(packageLock)
        }

        if (await this.call('fileManager', 'exists', './package.json')) {
          const content = await this.call('fileManager', 'readFile', './package.json')
          const pkg = JSON.parse(content)
          return { deps: { ...pkg['dependencies'], ...pkg['devDependencies'] }, yarnLock, packageLock }
        } else {
          return {}
        }
      } catch (e) {
        console.error(e)
        return {}
      }
    })

  }

  onActivation(): void {
    const packageFiles = ['package.json', 'package-lock.json', 'yarn.lock']
    this.on('filePanel', 'setWorkspace', () => this.urlResolver.clearCache())
    this.on('fileManager', 'fileRemoved', (file: string) => {
      if (packageFiles.includes(file)) {
        this.urlResolver.clearCache()
      }
    })
    this.on('fileManager', 'fileChanged', (file: string) => {
      if (packageFiles.includes(file)) {
        this.urlResolver.clearCache()
      }
    })
  }

  async setToken () {
    try {
      const protocol = typeof window !== 'undefined' && window.location.protocol
      const token = await this.call('settings', 'get', 'settings/gist-access-token')

      this.urlResolver.setGistToken(token, protocol)
    } catch (error) {
      console.log(error)
    }
  }

  isRelativeImport (url) {
    return /^([^/]+)/.exec(url)
  }

  isExternalUrl (url) {
    const handlers = this.urlResolver.getHandlers()
    // we filter out "npm" because this will be recognized as internal url although it's not the case.
    return handlers.filter((handler) => handler.type !== 'npm').some(handler => handler.match(url))
  }

  /**
    * resolve the content of @arg url. This only resolves external URLs.
    *
    * @param {String} url  - external URL of the content. can be basically anything like raw HTTP, ipfs URL, github address etc...
    * @returns {Promise} - { content, cleanUrl, type, url }
    */
  resolve (url) {
    return new Promise((resolve, reject) => {
      this.import(url, null, (error, content, cleanUrl, type, url) => {
        if (error) return reject(error)
        resolve({ content, cleanUrl, type, url })
      }, null)
    })
  }

  async import (url, force, loadingCb, cb) {
    if (typeof force !== 'boolean') {
      const temp = loadingCb
      loadingCb = force
      cb = temp
      force = false
    }
    if (!loadingCb) loadingCb = () => {}
    if (!cb) cb = () => {}

    const self = this

    let resolved
    try {
      await this.setToken()
      resolved = await this.urlResolver.resolve(url, [], force)
      const { content, cleanUrl, type } = resolved
      cb(null, content, cleanUrl, type, url)
    } catch (e) {
      return cb(new Error('not found ' + url))
    }
  }

  /**
   * Extract npm package name from import path
   * @param importPath - the import path (e.g., "@openzeppelin/contracts/token/ERC20/ERC20.sol")
   * @returns package name (e.g., "@openzeppelin/contracts") or null
   */
  extractPackageName(importPath: string): string | null {
    // Handle scoped packages like @openzeppelin/contracts
    if (importPath.startsWith('@')) {
      const match = importPath.match(/^(@[^/]+\/[^/]+)/)
      return match ? match[1] : null
    }
    // Handle regular packages
    const match = importPath.match(/^([^/]+)/)
    return match ? match[1] : null
  }

  /**
   * Fetch package.json for an npm package
   * @param packageName - the package name (e.g., "@openzeppelin/contracts")
   * @returns package.json content or null
   */
  async fetchPackageJson(packageName: string): Promise<string | null> {
    const npm_urls = [
      "https://cdn.jsdelivr.net/npm/",
      "https://unpkg.com/"
    ]
    
    console.log(`[ContentImport] 📦 Fetching package.json for: ${packageName}`)
    
    for (const baseUrl of npm_urls) {
      try {
        const url = `${baseUrl}${packageName}/package.json`
        const response = await fetch(url)
        if (response.ok) {
          const content = await response.text()
          console.log(`[ContentImport] ✅ Successfully fetched package.json for ${packageName} from ${baseUrl}`)
          return content
        }
      } catch (e) {
        console.log(`[ContentImport] ⚠️  Failed to fetch from ${baseUrl}: ${e.message}`)
        // Try next URL
      }
    }
    
    console.log(`[ContentImport] ❌ Could not fetch package.json for ${packageName}`)
    return null
  }

  /**
   * Rewrite imports in content to include version tags from package.json dependencies
   * @param content - the file content with imports
   * @param packageName - the package this file belongs to
   * @param packageJsonContent - the package.json content (string)
   * @returns modified content with versioned imports
   */
  rewriteImportsWithVersions(content: string, packageName: string, packageJsonContent: string): string {
    try {
      const packageJson = JSON.parse(packageJsonContent)
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies
      }
      
      if (!dependencies || Object.keys(dependencies).length === 0) {
        return content
      }

      console.log(`[ContentImport] 🔄 Checking imports in file from package: ${packageName}`)
      
      // Match Solidity import statements
      // Handles: import "path"; import 'path'; import {...} from "path";
      const importRegex = /import\s+(?:[^"']*["']([^"']+)["']|["']([^"']+)["'])/g
      let modifiedContent = content
      let modificationsCount = 0
      
      // Find all imports
      const imports: string[] = []
      let match
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1] || match[2]
        if (importPath) {
          imports.push(importPath)
        }
      }
      
      // Process each import
      for (const importPath of imports) {
        // Extract package name from import
        const importedPackage = this.extractPackageName(importPath)
        
        if (importedPackage && dependencies[importedPackage]) {
          const version = dependencies[importedPackage]
          
          // Check if the import already has a version tag
          if (!importPath.includes('@') || (importPath.startsWith('@') && importPath.split('@').length === 2)) {
            // Rewrite the import to include version
            // For scoped packages: @openzeppelin/contracts/path -> @openzeppelin/contracts@5.0.0/path
            // For regular packages: hardhat/console.sol -> hardhat@2.0.0/console.sol
            
            let versionedImport: string
            if (importPath.startsWith('@')) {
              // Scoped package: @scope/package/path -> @scope/package@version/path
              const parts = importPath.split('/')
              versionedImport = `${parts[0]}/${parts[1]}@${version}/${parts.slice(2).join('/')}`
            } else {
              // Regular package: package/path -> package@version/path
              const parts = importPath.split('/')
              versionedImport = `${parts[0]}@${version}/${parts.slice(1).join('/')}`
            }
            
            // Replace in content (need to escape special regex characters in the import path)
            const escapedImportPath = importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const replaceRegex = new RegExp(`(["'])${escapedImportPath}\\1`, 'g')
            
            const beforeReplace = modifiedContent
            modifiedContent = modifiedContent.replace(replaceRegex, `$1${versionedImport}$1`)
            
            if (beforeReplace !== modifiedContent) {
              modificationsCount++
              console.log(`[ContentImport] 📝 Rewrote import: "${importPath}" → "${versionedImport}" (version: ${version})`)
            }
          }
        }
      }
      
      if (modificationsCount > 0) {
        console.log(`[ContentImport] ✅ Modified ${modificationsCount} import(s) with version tags`)
      }
      
      return modifiedContent
    } catch (e) {
      console.error(`[ContentImport] ❌ Error rewriting imports: ${e.message}`)
      return content // Return original content on error
    }
  }

  importExternal (url, targetPath) {
    return new Promise((resolve, reject) => {
      this.import(url,
        // TODO: handle this event
        (loadingMsg) => { this.emit('message', loadingMsg) },
        async (error, content, cleanUrl, type, url) => {
          if (error) return reject(error)
          try {
            const provider = await this.call('fileManager', 'getProviderOf', null)
            const path = targetPath || type + '/' + cleanUrl
            
            // If this is an npm import, fetch and save the package.json first, then rewrite imports
            let finalContent = content
            let packageJsonContent: string | null = null
            
            if (type === 'npm' && provider) {
              const packageName = this.extractPackageName(cleanUrl)
              if (packageName) {
                const packageJsonPath = `.deps/npm/${packageName}/package.json`
                
                // Try to get existing package.json or fetch it
                const exists = await this.call('fileManager', 'exists', packageJsonPath)
                if (exists) {
                  console.log(`[ContentImport] ⏭️  package.json already exists at: ${packageJsonPath}`)
                  try {
                    packageJsonContent = await this.call('fileManager', 'readFile', packageJsonPath)
                  } catch (readErr) {
                    console.error(`[ContentImport] ⚠️  Could not read existing package.json: ${readErr.message}`)
                  }
                } else {
                  packageJsonContent = await this.fetchPackageJson(packageName)
                  if (packageJsonContent) {
                    try {
                      await this.call('fileManager', 'writeFile', packageJsonPath, packageJsonContent)
                      console.log(`[ContentImport] 💾 Saved package.json to: ${packageJsonPath}`)
                    } catch (writeErr) {
                      console.error(`[ContentImport] ❌ Failed to write package.json: ${writeErr.message}`)
                    }
                  }
                }
                
                // Rewrite imports in the content with version tags from package.json
                if (packageJsonContent) {
                  finalContent = this.rewriteImportsWithVersions(content, packageName, packageJsonContent)
                }
              }
            }
            
            // Save the file (with rewritten imports if applicable)
            if (provider) {
              await provider.addExternal('.deps/' + path, finalContent, url)
            }
          } catch (err) {
            console.error(err)
          }
          resolve(content)
        }, null)
    })
  }

  /**
    * import the content of @arg url.
    * first look in the browser localstorage (browser explorer) or localhost explorer. if the url start with `browser/*` or  `localhost/*`
    * then check if the @arg url is located in the localhost, in the node_modules or installed_contracts folder
    * then check if the @arg url match any external url
    *
    * @param {String} url - URL of the content. can be basically anything like file located in the browser explorer, in the localhost explorer, raw HTTP, github address etc...
    * @param {String} targetPath - (optional) internal path where the content should be saved to
    * @returns {Promise} - string content
    */
  async resolveAndSave (url, targetPath) {
    try {
      if (targetPath && this.currentRequest) {
        const canCall = await this.askUserPermission('resolveAndSave', 'This action will update the path ' + targetPath)
        if (!canCall) throw new Error('No permission to update ' + targetPath)
      }
      const provider = await this.call('fileManager', 'getProviderOf', url)
      if (provider) {
        if (provider.type === 'localhost' && !provider.isConnected()) {
          throw new Error(`file provider ${provider.type} not available while trying to resolve ${url}`)
        }
        let exist = await provider.exists(url)
        /*
          if the path is absolute and the file does not exist, we can stop here
          Doesn't make sense to try to resolve "localhost/node_modules/localhost/node_modules/<path>" and we'll end in an infinite loop.
        */
        if (!exist && (url === 'remix_tests.sol' || url === 'remix_accounts.sol')) {
          await this.call('solidityUnitTesting', 'createTestLibs')
          exist = await provider.exists(url)
        }
        if (!exist && url.startsWith('browser/')) throw new Error(`not found ${url}`)
        if (!exist && url.startsWith('localhost/')) throw new Error(`not found ${url}`)
        if (exist) {
          const content = await (() => {
            return new Promise((resolve, reject) => {
              provider.get(url, (error, content) => {
                if (error) return reject(error)
                resolve(content)
              })
            })
          })()
          return content
        } else {
          const localhostProvider = await this.call('fileManager', 'getProviderByName', 'localhost')
          if (localhostProvider.isConnected()) {
            const split = /([^/]+)\/(.*)$/g.exec(url)

            const possiblePaths = ['localhost/installed_contracts/' + url]
            // pick remix-tests library contracts from '.deps'
            if (url.startsWith('remix_')) possiblePaths.push('localhost/.deps/remix-tests/' + url)
            if (split) possiblePaths.push('localhost/installed_contracts/' + split[1] + '/contracts/' + split[2])
            possiblePaths.push('localhost/node_modules/' + url)
            if (split) possiblePaths.push('localhost/node_modules/' + split[1] + '/contracts/' + split[2])

            for (const path of possiblePaths) {
              try {
                const content = await this.resolveAndSave(path, null)
                if (content) {
                  localhostProvider.addNormalizedName(path.replace('localhost/', ''), url)
                  return content
                }
              } catch (e) {}
            }
            return await this.importExternal(url, targetPath)
          }
          return await this.importExternal(url, targetPath)
        }
      }
    } catch (e) {
      throw new Error(e)
    }
  }

  async resolveGithubFolder (url) {
    const ghFolder = {}
    await githubFolderResolver(url, ghFolder, 3)
    return ghFolder
  }
}
