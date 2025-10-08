'use strict'

import { Plugin } from '@remixproject/engine'
import { ResolutionIndex } from './resolution-index'
import { IImportResolver } from './import-resolver-interface'

export class ImportResolver implements IImportResolver {
  private importMappings: Map<string, string>
  private pluginApi: Plugin
  private targetFile: string
  private resolutions: Map<string, string> = new Map()
  private workspaceResolutions: Map<string, string> = new Map() // From package.json resolutions/overrides
  private lockFileVersions: Map<string, string> = new Map() // From yarn.lock or package-lock.json
  private conflictWarnings: Set<string> = new Set() // Track warned conflicts

  // Shared resolution index across all ImportResolver instances
  private static resolutionIndex: ResolutionIndex | null = null
  private static resolutionIndexInitialized: boolean = false

  constructor(pluginApi: Plugin, targetFile: string) {
    this.pluginApi = pluginApi
    this.targetFile = targetFile
    this.importMappings = new Map()
    
    console.log(`[ImportResolver] 🆕 Created new resolver instance for: "${targetFile}"`)
    
    // Initialize shared resolution index on first use
    if (!ImportResolver.resolutionIndexInitialized) {
      ImportResolver.resolutionIndexInitialized = true
      ImportResolver.resolutionIndex = new ResolutionIndex(this.pluginApi)
      ImportResolver.resolutionIndex.load().catch(err => {
        console.log(`[ImportResolver] ⚠️  Failed to load resolution index:`, err)
      })
      
      // Set up workspace change listeners after a short delay to ensure plugin system is ready
      setTimeout(() => {
        if (ImportResolver.resolutionIndex) {
          ImportResolver.resolutionIndex.onActivation()
        }
      }, 100)
    }
    
    // Initialize workspace resolution rules
    this.initializeWorkspaceResolutions().catch(err => {
      console.log(`[ImportResolver] ⚠️  Failed to initialize workspace resolutions:`, err)
    })
  }

  public clearMappings(): void {
    console.log(`[ImportResolver] 🧹 Clearing all import mappings`)
    this.importMappings.clear()
  }

  /**
   * Initialize workspace-level resolution rules
   * Priority: 1) package.json resolutions/overrides, 2) lock files
   */
  private async initializeWorkspaceResolutions(): Promise<void> {
    try {
      // 1. Check for workspace package.json resolutions/overrides
      await this.loadWorkspaceResolutions()
      
      // 2. Parse lock files for installed versions
      await this.loadLockFileVersions()
      
      console.log(`[ImportResolver] 📋 Workspace resolutions loaded:`, this.workspaceResolutions.size)
      console.log(`[ImportResolver] 🔒 Lock file versions loaded:`, this.lockFileVersions.size)
    } catch (err) {
      console.log(`[ImportResolver] ⚠️  Error initializing workspace resolutions:`, err)
    }
  }

  /**
   * Load resolutions/overrides from workspace package.json
   */
  private async loadWorkspaceResolutions(): Promise<void> {
    try {
      const exists = await this.pluginApi.call('fileManager', 'exists', 'package.json')
      if (!exists) return

      const content = await this.pluginApi.call('fileManager', 'readFile', 'package.json')
      const packageJson = JSON.parse(content)

      // Yarn resolutions or npm overrides
      const resolutions = packageJson.resolutions || packageJson.overrides || {}
      
      for (const [pkg, version] of Object.entries(resolutions)) {
        if (typeof version === 'string') {
          this.workspaceResolutions.set(pkg, version)
          console.log(`[ImportResolver] 📌 Workspace resolution: ${pkg} → ${version}`)
        }
      }
      
      // Also check dependencies and peerDependencies for version hints
      // These are lower priority than explicit resolutions/overrides, but useful for reference
      const allDeps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.peerDependencies || {}),
        ...(packageJson.devDependencies || {})
      }
      
      for (const [pkg, versionRange] of Object.entries(allDeps)) {
        // Only store if not already set by resolutions/overrides
        if (!this.workspaceResolutions.has(pkg) && typeof versionRange === 'string') {
          // Store the version range as-is (lock file will provide actual version)
          console.log(`[ImportResolver] 📦 Found workspace dependency: ${pkg}@${versionRange}`)
        }
      }
    } catch (err) {
      console.log(`[ImportResolver] ℹ️  No workspace package.json or resolutions`)
    }
  }

  /**
   * Parse lock file to get actual installed versions
   */
  private async loadLockFileVersions(): Promise<void> {
    // Try yarn.lock first
    try {
      const yarnLockExists = await this.pluginApi.call('fileManager', 'exists', 'yarn.lock')
      if (yarnLockExists) {
        await this.parseYarnLock()
        return
      }
    } catch (err) {
      console.log(`[ImportResolver] ℹ️  No yarn.lock found`)
    }

    // Try package-lock.json
    try {
      const npmLockExists = await this.pluginApi.call('fileManager', 'exists', 'package-lock.json')
      if (npmLockExists) {
        await this.parsePackageLock()
        return
      }
    } catch (err) {
      console.log(`[ImportResolver] ℹ️  No package-lock.json found`)
    }
  }

  /**
   * Parse yarn.lock to extract package versions
   */
  private async parseYarnLock(): Promise<void> {
    try {
      const content = await this.pluginApi.call('fileManager', 'readFile', 'yarn.lock')
      
      // Simple yarn.lock parsing - look for package@version entries
      const lines = content.split('\n')
      let currentPackage = null
      
      for (const line of lines) {
        // Match: "@openzeppelin/contracts@^5.0.0":
        const packageMatch = line.match(/^"?([^"@]+)@[^"]*"?:/)
        if (packageMatch) {
          currentPackage = packageMatch[1]
        }
        
        // Match:   version "5.4.0"
        const versionMatch = line.match(/^\s+version\s+"([^"]+)"/)
        if (versionMatch && currentPackage) {
          this.lockFileVersions.set(currentPackage, versionMatch[1])
          console.log(`[ImportResolver] 🔒 Lock file: ${currentPackage} → ${versionMatch[1]}`)
          currentPackage = null
        }
      }
    } catch (err) {
      console.log(`[ImportResolver] ⚠️  Failed to parse yarn.lock:`, err)
    }
  }

  /**
   * Parse package-lock.json to extract package versions
   */
  private async parsePackageLock(): Promise<void> {
    try {
      const content = await this.pluginApi.call('fileManager', 'readFile', 'package-lock.json')
      const lockData = JSON.parse(content)
      
      // npm v1/v2 format
      if (lockData.dependencies) {
        for (const [pkg, data] of Object.entries(lockData.dependencies)) {
          if (data && typeof data === 'object' && 'version' in data) {
            this.lockFileVersions.set(pkg, (data as any).version)
            console.log(`[ImportResolver] 🔒 Lock file: ${pkg} → ${(data as any).version}`)
          }
        }
      }
      
      // npm v3 format
      if (lockData.packages) {
        for (const [path, data] of Object.entries(lockData.packages)) {
          if (data && typeof data === 'object' && 'version' in data) {
            const pkg = path.replace('node_modules/', '')
            if (pkg && pkg !== '') {
              this.lockFileVersions.set(pkg, (data as any).version)
              console.log(`[ImportResolver] 🔒 Lock file: ${pkg} → ${(data as any).version}`)
            }
          }
        }
      }
    } catch (err) {
      console.log(`[ImportResolver] ⚠️  Failed to parse package-lock.json:`, err)
    }
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

  private extractVersion(url: string): string | null {
    // Match version after @ symbol: pkg@1.2.3 or @scope/pkg@1.2.3
    const match = url.match(/@(\d+\.\d+\.\d+[^\s/]*)/)
    return match ? match[1] : null
  }

  /**
   * Basic semver compatibility check
   * Returns true if the resolved version might not satisfy the requested range
   */
  private isPotentialVersionConflict(requestedRange: string, resolvedVersion: string): boolean {
    // Extract major.minor.patch from resolved version
    const resolvedMatch = resolvedVersion.match(/^(\d+)\.(\d+)\.(\d+)/)
    if (!resolvedMatch) return false
    
    const [, resolvedMajor, resolvedMinor, resolvedPatch] = resolvedMatch.map(Number)
    
    // Handle caret ranges: ^5.4.0 means >=5.4.0 <6.0.0
    const caretMatch = requestedRange.match(/^\^(\d+)\.(\d+)\.(\d+)/)
    if (caretMatch) {
      const [, reqMajor, reqMinor, reqPatch] = caretMatch.map(Number)
      
      // Must be same major version
      if (resolvedMajor !== reqMajor) return true
      
      // If major > 0, minor can be >= requested
      if (resolvedMajor > 0) {
        if (resolvedMinor < reqMinor) return true
        if (resolvedMinor === reqMinor && resolvedPatch < reqPatch) return true
      }
      
      return false
    }
    
    // Handle tilde ranges: ~5.4.0 means >=5.4.0 <5.5.0
    const tildeMatch = requestedRange.match(/^~(\d+)\.(\d+)\.(\d+)/)
    if (tildeMatch) {
      const [, reqMajor, reqMinor, reqPatch] = tildeMatch.map(Number)
      
      if (resolvedMajor !== reqMajor) return true
      if (resolvedMinor !== reqMinor) return true
      if (resolvedPatch < reqPatch) return true
      
      return false
    }
    
    // Handle exact version: 5.4.0
    const exactMatch = requestedRange.match(/^(\d+)\.(\d+)\.(\d+)$/)
    if (exactMatch) {
      return requestedRange !== resolvedVersion
    }
    
    // Handle >= ranges
    const gteMatch = requestedRange.match(/^>=(\d+)\.(\d+)\.(\d+)/)
    if (gteMatch) {
      const [, reqMajor, reqMinor, reqPatch] = gteMatch.map(Number)
      
      if (resolvedMajor < reqMajor) return true
      if (resolvedMajor === reqMajor && resolvedMinor < reqMinor) return true
      if (resolvedMajor === reqMajor && resolvedMinor === reqMinor && resolvedPatch < reqPatch) return true
      
      return false
    }
    
    // For complex ranges or wildcards, we can't reliably determine - don't warn
    return false
  }

  /**
   * Check if version conflict is a BREAKING change (different major versions)
   * This is likely to cause compilation failures
   */
  private isBreakingVersionConflict(requestedRange: string, resolvedVersion: string): boolean {
    const resolvedMatch = resolvedVersion.match(/^(\d+)/)
    if (!resolvedMatch) return false
    const resolvedMajor = parseInt(resolvedMatch[1])
    
    // Extract major version from requested range
    const rangeMatch = requestedRange.match(/(\d+)/)
    if (!rangeMatch) return false
    const requestedMajor = parseInt(rangeMatch[1])
    
    return resolvedMajor !== requestedMajor
  }

  private async fetchAndMapPackage(packageName: string): Promise<void> {
    const mappingKey = `__PKG__${packageName}`
    
    if (this.importMappings.has(mappingKey)) {
      return
    }
    
    let resolvedVersion: string | null = null
    let source = 'fetched'
    
    // PRIORITY 1: Workspace resolutions/overrides
    if (this.workspaceResolutions.has(packageName)) {
      resolvedVersion = this.workspaceResolutions.get(packageName)
      source = 'workspace-resolution'
      console.log(`[ImportResolver] � Using workspace resolution: ${packageName} → ${resolvedVersion}`)
    }
    
    // PRIORITY 2: Lock file (if no workspace override)
    if (!resolvedVersion && this.lockFileVersions.has(packageName)) {
      resolvedVersion = this.lockFileVersions.get(packageName)
      source = 'lock-file'
      console.log(`[ImportResolver] 🔒 Using lock file version: ${packageName} → ${resolvedVersion}`)
    }
    
    // PRIORITY 3: Fetch package.json (fallback)
    if (!resolvedVersion) {
      try {
        console.log(`[ImportResolver] 📦 Fetching package.json for: ${packageName}`)
        
        const packageJsonUrl = `${packageName}/package.json`
        const content = await this.pluginApi.call('contentImport', 'resolve', packageJsonUrl)
        
        const packageJson = JSON.parse(content.content || content)
        if (packageJson.version) {
          resolvedVersion = packageJson.version
          source = 'package-json'
          
          // Save package.json to file system for visibility and debugging
          // Use versioned folder path
          try {
            const targetPath = `.deps/npm/${packageName}@${packageJson.version}/package.json`
            await this.pluginApi.call('fileManager', 'setFile', targetPath, JSON.stringify(packageJson, null, 2))
            console.log(`[ImportResolver] 💾 Saved package.json to: ${targetPath}`)
          } catch (saveErr) {
            console.log(`[ImportResolver] ⚠️  Failed to save package.json:`, saveErr)
          }
        }
      } catch (err) {
        console.log(`[ImportResolver] ⚠️  Failed to fetch package.json for ${packageName}:`, err)
        return
      }
    }
    
    if (resolvedVersion) {
      const versionedPackageName = `${packageName}@${resolvedVersion}`
      this.importMappings.set(mappingKey, versionedPackageName)
      console.log(`[ImportResolver] ✅ Mapped ${packageName} → ${versionedPackageName} (source: ${source})`)
      
      // Always check peer dependencies (regardless of source) to detect conflicts
      try {
        const packageJsonUrl = `${packageName}/package.json`
        const content = await this.pluginApi.call('contentImport', 'resolve', packageJsonUrl)
        const packageJson = JSON.parse(content.content || content)
        
        // Save package.json if we haven't already (when using lock file or workspace resolutions)
        // Use versioned folder path
        if (source !== 'package-json') {
          try {
            const targetPath = `.deps/npm/${packageName}@${resolvedVersion}/package.json`
            await this.pluginApi.call('fileManager', 'setFile', targetPath, JSON.stringify(packageJson, null, 2))
            console.log(`[ImportResolver] 💾 Saved package.json to: ${targetPath}`)
          } catch (saveErr) {
            console.log(`[ImportResolver] ⚠️  Failed to save package.json:`, saveErr)
          }
        }
        
        // Check both peerDependencies AND regular dependencies for conflicts
        // In Solidity, unlike npm, we can't have multiple versions - everything shares one namespace
        const allDeps = {
          ...(packageJson.dependencies || {}),
          ...(packageJson.peerDependencies || {})
        }
        
        if (Object.keys(allDeps).length > 0) {
          const depTypes = []
          if (packageJson.dependencies) depTypes.push('dependencies')
          if (packageJson.peerDependencies) depTypes.push('peerDependencies')
          console.log(`[ImportResolver] 🔗 Found ${depTypes.join(' & ')} for ${packageName}:`, Object.keys(allDeps))
          
          for (const [dep, requestedRange] of Object.entries(allDeps)) {
            const isPeerDep = packageJson.peerDependencies && dep in packageJson.peerDependencies
            
            // IMPORTANT: Only check if this dependency is ALREADY mapped (i.e., actually imported)
            // Don't recursively fetch the entire npm dependency tree!
            const depMappingKey = `__PKG__${dep}`
            if (this.importMappings.has(depMappingKey)) {
              const resolvedDepPackage = this.importMappings.get(depMappingKey)
              const resolvedDepVersion = this.extractVersion(resolvedDepPackage)
              
              if (resolvedDepVersion && typeof requestedRange === 'string') {
                const conflictKey = `${isPeerDep ? 'peer' : 'dep'}:${packageName}→${dep}:${requestedRange}→${resolvedDepVersion}`
                
                // Check if it looks like a potential conflict (basic semver check)
                if (!this.conflictWarnings.has(conflictKey) && this.isPotentialVersionConflict(requestedRange, resolvedDepVersion)) {
                  this.conflictWarnings.add(conflictKey)
                  
                  // Determine the source of the resolved version
                  let resolutionSource = 'package.json fetch'
                  if (this.workspaceResolutions.has(dep)) {
                    resolutionSource = 'workspace resolutions'
                  } else if (this.lockFileVersions.has(dep)) {
                    resolutionSource = 'lock file'
                  }
                  
                  // Check if this is a BREAKING change (different major versions)
                  const isBreaking = this.isBreakingVersionConflict(requestedRange, resolvedDepVersion)
                  const severity = isBreaking ? 'error' : 'warn'
                  const emoji = isBreaking ? '🚨' : '⚠️'
                  
                  const depType = isPeerDep ? 'peerDependencies' : 'dependencies'
                  const warningMsg = [
                    `${emoji} Version mismatch detected:`,
                    `   Package ${packageName}@${resolvedVersion} specifies in its ${depType}:`,
                    `     "${dep}": "${requestedRange}"`,
                    `   But resolved version is ${dep}@${resolvedDepVersion} (from ${resolutionSource})`,
                    ``,
                    isBreaking ? `⚠️ MAJOR VERSION MISMATCH - May cause compilation failures!` : '',
                    isBreaking ? `` : '',
                    `💡 To fix this, you can either:`,
                    `   1. Add "${dep}": "${requestedRange}" to your workspace package.json dependencies`,
                    `   2. Or force the version with resolutions/overrides:`,
                    `      • For Yarn: "resolutions": { "${dep}": "${requestedRange}" }`,
                    `      • For npm:  "overrides": { "${dep}": "${requestedRange}" }`,
                    ``
                  ].filter(line => line !== '').join('\n')
                  
                  this.pluginApi.call('terminal', 'log', { 
                    type: severity, 
                    value: warningMsg 
                  }).catch(err => {
                    console.warn(warningMsg)
                  })
                }
              }
            }
          }
        }
      } catch (err) {
        // Dependencies are optional, don't fail compilation
      }
      
      console.log(`[ImportResolver] 📊 Total isolated mappings: ${this.importMappings.size}`)
    }
  }

  public async resolveAndSave(url: string, targetPath?: string, skipResolverMappings = false): Promise<string> {
    const originalUrl = url
    let finalUrl = url
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
          
          finalUrl = mappedUrl
          this.resolutions.set(originalUrl, finalUrl)
          
          return this.resolveAndSave(mappedUrl, targetPath, true)
        } else {
          console.log(`[ImportResolver] ⚠️  No mapping available for ${mappingKey}`)
        }
      } else {
        // CONFLICT DETECTION: URL has explicit version, check if it conflicts with our resolution
        const requestedVersion = this.extractVersion(url)
        const mappingKey = `__PKG__${packageName}`
        
        if (this.importMappings.has(mappingKey)) {
          const versionedPackageName = this.importMappings.get(mappingKey)
          const resolvedVersion = this.extractVersion(versionedPackageName)
          
          if (requestedVersion && resolvedVersion && requestedVersion !== resolvedVersion) {
            const conflictKey = `${packageName}:${requestedVersion}→${resolvedVersion}`
            
            if (!this.conflictWarnings.has(conflictKey)) {
              this.conflictWarnings.add(conflictKey)
              
              // Determine the source of the resolved version
              let resolutionSource = 'package.json fetch'
              if (this.workspaceResolutions.has(packageName)) {
                resolutionSource = 'workspace resolutions'
              } else if (this.lockFileVersions.has(packageName)) {
                resolutionSource = 'lock file'
              }
              
              // Check if this is a BREAKING change (different major versions)
              const isBreaking = this.isBreakingVersionConflict(requestedVersion, resolvedVersion)
              const severity = isBreaking ? 'error' : 'warn'
              const emoji = isBreaking ? '🚨' : '⚠️'
              
              // Log to terminal plugin for user visibility with actionable advice
              const warningMsg = [
                `${emoji} Version conflict detected in ${this.targetFile}:`,
                `   An imported package contains hardcoded versioned imports:`,
                `     ${packageName}@${requestedVersion}`,
                `   But your workspace resolved to: ${packageName}@${resolvedVersion} (from ${resolutionSource})`,
                ``,
                isBreaking ? `⚠️ MAJOR VERSION MISMATCH - Will cause duplicate declaration errors!` : '',
                isBreaking ? `` : '',
                `� REQUIRED FIX - Add explicit versioned imports to your Solidity file:`,
                `   import "${packageName}@${resolvedVersion}/...";  // Add BEFORE other imports`,
                ``,
                `   This ensures all packages use the same canonical version.`,
                `   Example:`,
                `     import "${packageName}@${resolvedVersion}/token/ERC20/IERC20.sol";`,
                `     // ... then your other imports`,
                ``,
                `💡 To switch to version ${requestedVersion} instead:`,
                `   1. Update package.json: "${packageName}": "${requestedVersion}"`,
                `   2. Use explicit imports: import "${packageName}@${requestedVersion}/...";`,
                ``
              ].filter(line => line !== '').join('\n')
              
              this.pluginApi.call('terminal', 'log', { 
                type: severity, 
                value: warningMsg 
              }).catch(err => {
                // Fallback to console if terminal plugin is unavailable
                console.warn(warningMsg)
              })
            }
            
            // Use the resolved version instead
            const mappedUrl = url.replace(`${packageName}@${requestedVersion}`, versionedPackageName)
            finalUrl = mappedUrl
            this.resolutions.set(originalUrl, finalUrl)
            
            return this.resolveAndSave(mappedUrl, targetPath, true)
          } else if (requestedVersion && resolvedVersion && requestedVersion === resolvedVersion) {
            // Versions MATCH - normalize to canonical path to prevent duplicate declarations
            // This ensures "@openzeppelin/contracts@4.8.3/..." always resolves to the same path
            // regardless of which import statement triggered it first
            const mappedUrl = url.replace(`${packageName}@${requestedVersion}`, versionedPackageName)
            if (mappedUrl !== url) {
              finalUrl = mappedUrl
              this.resolutions.set(originalUrl, finalUrl)
              
              return this.resolveAndSave(mappedUrl, targetPath, true)
            }
          }
        } else {
          // No mapping exists yet - this is the FIRST import with an explicit version
          // Record it as our canonical version for this package
          if (requestedVersion) {
            const versionedPackageName = `${packageName}@${requestedVersion}`
            this.importMappings.set(mappingKey, versionedPackageName)
            
            // Fetch and save package.json for this version
            try {
              const packageJsonUrl = `${packageName}@${requestedVersion}/package.json`
              const content = await this.pluginApi.call('contentImport', 'resolve', packageJsonUrl)
              const packageJson = JSON.parse(content.content || content)
              
              const targetPath = `.deps/npm/${versionedPackageName}/package.json`
              await this.pluginApi.call('fileManager', 'setFile', targetPath, JSON.stringify(packageJson, null, 2))
              console.log(`[ImportResolver] 💾 Saved package.json to: ${targetPath}`)
            } catch (err) {
              console.log(`[ImportResolver] ⚠️  Failed to fetch/save package.json:`, err)
            }
          }
        }
      }
    }
    
    console.log(`[ImportResolver] 📥 Fetching file (skipping ContentImport global mappings): ${url}`)
    const content = await this.pluginApi.call('contentImport', 'resolveAndSave', url, targetPath, true)
    
    if (!skipResolverMappings || originalUrl === url) {
      if (!this.resolutions.has(originalUrl)) {
        this.resolutions.set(originalUrl, url)
        console.log(`[ImportResolver] �� Recorded resolution: ${originalUrl} → ${url}`)
      }
    }
    
    return content
  }

  public async saveResolutionsToIndex(): Promise<void> {
    console.log(`[ImportResolver] 💾 Saving ${this.resolutions.size} resolution(s) to index for: ${this.targetFile}`)
    
    if (!ImportResolver.resolutionIndex) {
      console.log(`[ImportResolver] ⚠️  Resolution index not initialized, skipping save`)
      return
    }
    
    ImportResolver.resolutionIndex.clearFileResolutions(this.targetFile)
    
    this.resolutions.forEach((resolvedPath, originalImport) => {
      ImportResolver.resolutionIndex!.recordResolution(this.targetFile, originalImport, resolvedPath)
    })
    
    await ImportResolver.resolutionIndex.save()
  }

  public getTargetFile(): string {
    return this.targetFile
  }
}
