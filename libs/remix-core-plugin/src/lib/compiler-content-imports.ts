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
  importMappings: Map<string, string> // Maps non-versioned imports to versioned imports
  
  constructor () {
    super(profile)
    this.importMappings = new Map()
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
    this.on('filePanel', 'setWorkspace', () => {
      this.urlResolver.clearCache()
      this.importMappings.clear()
    })
    this.on('fileManager', 'fileRemoved', (file: string) => {
      if (packageFiles.includes(file)) {
        this.urlResolver.clearCache()
        this.importMappings.clear()
      }
    })
    this.on('fileManager', 'fileChanged', (file: string) => {
      if (packageFiles.includes(file)) {
        this.urlResolver.clearCache()
        this.importMappings.clear()
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

    // Check if this import should be redirected via package-level mappings BEFORE resolving
    const packageName = this.extractPackageName(url)
    if (packageName && !url.includes('@')) {
      const mappingKey = `__PKG__${packageName}`
      if (this.importMappings.has(mappingKey)) {
        const versionedPackageName = this.importMappings.get(mappingKey)
        const mappedUrl = url.replace(packageName, versionedPackageName)
        console.log(`[ContentImport] 🗺️  Redirecting via package mapping: ${url} → ${mappedUrl}`)
        // Recursively call import with the mapped URL
        return this.import(mappedUrl, force, loadingCb, cb)
      }
    }

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
  /**
   * Create import mappings from package imports to versioned imports
   * Instead of mapping individual files, we map entire packages as wildcards
   * @param content File content to parse for imports
   * @param packageName The package name (e.g., "@openzeppelin/contracts")
   * @param packageJsonContent The package.json content as a string
   */
  createImportMappings(content: string, packageName: string, packageJsonContent: string): void {
    console.log(`[ContentImport] 📋 Creating import mappings for ${packageName}`)
    
    try {
      const packageJson = JSON.parse(packageJsonContent)
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies
      }
      
      // For each dependency, create a PACKAGE-LEVEL mapping
      // This maps ALL imports from that package to the versioned equivalent
      for (const [depPackageName, depVersion] of Object.entries(dependencies)) {
        // Create a wildcard mapping entry
        // We'll use the package name as the key with a special marker
        const mappingKey = `__PKG__${depPackageName}`
        const mappingValue = `${depPackageName}@${depVersion}`
        
        this.importMappings.set(mappingKey, mappingValue)
        console.log(`[ContentImport] 🗺️  Package mapping: ${depPackageName}/* → ${depPackageName}@${depVersion}/*`)
      }
    } catch (error) {
      console.error(`[ContentImport] ❌ Error creating import mappings:`, error)
    }
  }

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
            
            // If this is an npm import, fetch and save the package.json, then create import mappings
            // We DO NOT rewrite the source code - we create mappings instead for transparent resolution
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
                
                // Create import mappings (non-versioned → versioned) instead of rewriting source
                // This preserves the original source code for Sourcify verification
                if (packageJsonContent) {
                  this.createImportMappings(content, packageName, packageJsonContent)
                  
                  // Also create a self-mapping for this package if it has a version
                  try {
                    const packageJson = JSON.parse(packageJsonContent)
                    if (packageJson.version && !cleanUrl.includes('@')) {
                      const mappingKey = `__PKG__${packageName}`
                      const mappingValue = `${packageName}@${packageJson.version}`
                      this.importMappings.set(mappingKey, mappingValue)
                      console.log(`[ContentImport] 🗺️  Self-mapping: ${packageName}/* → ${packageName}@${packageJson.version}/*`)
                    }
                  } catch (e) {
                    // Ignore errors in self-mapping
                  }
                }
              }
            }
            
            // Save the ORIGINAL file content (no rewriting)
            if (provider) {
              await provider.addExternal('.deps/' + path, content, url)
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
    * @param {Boolean} skipMappings - (optional) if true, skip package-level mapping resolution. Used by code parser to avoid conflicts with main compiler
    * @returns {Promise} - string content
    */
  async resolveAndSave (url, targetPath, skipMappings = false) {
    try {
      // Extract package name for use in various checks below
      const packageName = this.extractPackageName(url)
      
      // FIRST: Check if this import should be redirected via package-level mappings
      // Skip this if skipMappings is true (e.g., for code parser to avoid race conditions)
      if (!skipMappings) {
        console.log(`[ContentImport] 🔍 resolveAndSave called with url: ${url}, extracted package: ${packageName}`)
        
        // Check if this URL has a version (e.g., @package@1.0.0 or package@1.0.0)
        // We only want to redirect non-versioned imports
        const hasVersion = packageName && url.includes(`${packageName}@`)
        
        if (packageName && !hasVersion) {
          const mappingKey = `__PKG__${packageName}`
          console.log(`[ContentImport] 🔑 Looking for mapping key: ${mappingKey}`)
          console.log(`[ContentImport] 📚 Available mappings:`, Array.from(this.importMappings.keys()))
          
          if (this.importMappings.has(mappingKey)) {
            const versionedPackageName = this.importMappings.get(mappingKey)
            const mappedUrl = url.replace(packageName, versionedPackageName)
            console.log(`[ContentImport] 🗺️  Resolving via package mapping: ${url} → ${mappedUrl}`)
            return await this.resolveAndSave(mappedUrl, targetPath, skipMappings)
          } else {
            console.log(`[ContentImport] ⚠️  No mapping found for: ${mappingKey}`)
          }
        } else if (hasVersion) {
          console.log(`[ContentImport] ℹ️  URL already has version, skipping mapping check`)
        }
      } else {
        console.log(`[ContentImport] ⏭️  Skipping mapping resolution (skipMappings=true) for url: ${url}`)
      }
      
      // SECOND: Check if we should redirect `.deps/npm/` paths back to npm format for fetching
      if (url.startsWith('.deps/npm/')) {
        const npmPath = url.replace('.deps/npm/', '')
        console.log(`[ContentImport] 🔄 Converting .deps/npm/ path to npm format: ${url} → ${npmPath}`)
        return await this.importExternal(npmPath, null)
      }
      
      // THIRD: For non-versioned npm imports, check if we already have a versioned equivalent file
      // This prevents fetching duplicates when the same version is already downloaded
      if (packageName && !url.includes('@')) {
        const packageJsonPath = `.deps/npm/${packageName}/package.json`
        try {
          const exists = await this.call('fileManager', 'exists', packageJsonPath)
          if (exists) {
            const packageJsonContent = await this.call('fileManager', 'readFile', packageJsonPath)
            const packageJson = JSON.parse(packageJsonContent)
            const version = packageJson.version
            
            // Construct versioned path
            let versionedPath = url.replace(packageName, `${packageName}@${version}`)
            
            // Check if versioned file exists
            const versionedExists = await this.call('fileManager', 'exists', `.deps/${versionedPath}`)
            if (versionedExists) {
              console.log(`[ContentImport] 🔄 Using existing versioned file: ${versionedPath}`)
              return await this.resolveAndSave(versionedPath, null)
            }
          }
        } catch (e) {
          // Continue with normal resolution if check fails
        }
      }
      
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
