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
  private importedFiles: Map<string, string> = new Map() // Track imported files: "pkg/path/to/file.sol" -> "version"
  private packageSources: Map<string, string> = new Map() // Track which package.json resolved each dependency: "pkg" -> "source-package"

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
    // Also matches partial versions: @5, @5.0, @5.0.2
    const match = url.match(/@(\d+(?:\.\d+)?(?:\.\d+)?[^\s/]*)/)
    return match ? match[1] : null
  }

  private extractRelativePath(url: string, packageName: string): string | null {
    // Extract the relative path after the package name (and optional version)
    // Examples:
    //   "@openzeppelin/contracts@5.0.2/token/ERC20/IERC20.sol" -> "token/ERC20/IERC20.sol"
    //   "@openzeppelin/contracts/token/ERC20/IERC20.sol" -> "token/ERC20/IERC20.sol"
    const versionedPattern = new RegExp(`^${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}@[^/]+/(.+)$`)
    const versionedMatch = url.match(versionedPattern)
    if (versionedMatch) {
      return versionedMatch[1]
    }
    
    const unversionedPattern = new RegExp(`^${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(.+)$`)
    const unversionedMatch = url.match(unversionedPattern)
    if (unversionedMatch) {
      return unversionedMatch[1]
    }
    
    return null
  }

  /**
   * Compare major versions between requested and resolved versions
   * Returns true if they're different major versions
   */
  private hasMajorVersionMismatch(requestedVersion: string, resolvedVersion: string): boolean {
    const requestedMajor = parseInt(requestedVersion.split('.')[0])
    const resolvedMajor = parseInt(resolvedVersion.split('.')[0])
    
    return !isNaN(requestedMajor) && !isNaN(resolvedMajor) && requestedMajor !== resolvedMajor
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

  /**
   * Check dependencies of a package for version conflicts
   */
  private async checkPackageDependencies(packageName: string, resolvedVersion: string, packageJson: any): Promise<void> {
    const allDeps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.peerDependencies || {})
    }
    
    if (Object.keys(allDeps).length === 0) return
    
    const depTypes = []
    if (packageJson.dependencies) depTypes.push('dependencies')
    if (packageJson.peerDependencies) depTypes.push('peerDependencies')
    console.log(`[ImportResolver] 🔗 Found ${depTypes.join(' & ')} for ${packageName}:`, Object.keys(allDeps))
    
    for (const [dep, requestedRange] of Object.entries(allDeps)) {
      await this.checkDependencyConflict(packageName, resolvedVersion, dep, requestedRange as string, packageJson.peerDependencies)
    }
  }

  /**
   * Check a single dependency for version conflicts
   */
  private async checkDependencyConflict(
    packageName: string, 
    packageVersion: string, 
    dep: string, 
    requestedRange: string,
    peerDependencies: any
  ): Promise<void> {
    const isPeerDep = peerDependencies && dep in peerDependencies
    
    // IMPORTANT: Only check if this dependency is ALREADY mapped (i.e., actually imported)
    // Don't recursively fetch the entire npm dependency tree!
    const depMappingKey = `__PKG__${dep}`
    if (!this.importMappings.has(depMappingKey)) return
    
    const resolvedDepPackage = this.importMappings.get(depMappingKey)
    const resolvedDepVersion = this.extractVersion(resolvedDepPackage)
    
    if (!resolvedDepVersion || typeof requestedRange !== 'string') return
    
    const conflictKey = `${isPeerDep ? 'peer' : 'dep'}:${packageName}→${dep}:${requestedRange}→${resolvedDepVersion}`
    
    // Check if it looks like a potential conflict (basic semver check)
    if (this.conflictWarnings.has(conflictKey) || !this.isPotentialVersionConflict(requestedRange, resolvedDepVersion)) {
      return
    }
    
    this.conflictWarnings.add(conflictKey)
    
    // Determine where the resolved version came from
    let resolvedFrom = 'npm registry'
    const sourcePackage = this.packageSources.get(dep)
    if (this.workspaceResolutions.has(dep)) {
      resolvedFrom = 'workspace package.json'
    } else if (this.lockFileVersions.has(dep)) {
      resolvedFrom = 'lock file'
    } else if (sourcePackage && sourcePackage !== dep && sourcePackage !== 'workspace') {
      resolvedFrom = `${sourcePackage}/package.json`
    }
    
    // Check if this is a BREAKING change (different major versions)
    const isBreaking = this.isBreakingVersionConflict(requestedRange, resolvedDepVersion)
    const severity = isBreaking ? 'error' : 'warn'
    const emoji = isBreaking ? '🚨' : '⚠️'
    
    const depType = isPeerDep ? 'peerDependencies' : 'dependencies'
    const warningMsg = [
      `${emoji} Version mismatch detected:`,
      `   Package ${packageName}@${packageVersion} requires in ${depType}:`,
      `     "${dep}": "${requestedRange}"`,
      ``,
      `   But actual imported version is: ${dep}@${resolvedDepVersion}`,
      `     (resolved from ${resolvedFrom})`,
      ``,
      isBreaking ? `⚠️ MAJOR VERSION MISMATCH - May cause compilation failures!` : '',
      isBreaking ? `` : '',
      `💡 To fix, update your workspace package.json:`,
      `     "${dep}": "${requestedRange}"`,
      ``
    ].filter(line => line !== '').join('\n')
    
    this.pluginApi.call('terminal', 'log', { 
      type: severity, 
      value: warningMsg 
    }).catch(err => {
      console.warn(warningMsg)
    })
  }

  /**
   * Resolve a package version from workspace, lock file, or npm
   */
  private async resolvePackageVersion(packageName: string): Promise<{ version: string | null, source: string }> {
    // PRIORITY 1: Workspace resolutions/overrides
    if (this.workspaceResolutions.has(packageName)) {
      const version = this.workspaceResolutions.get(packageName)
      console.log(`[ImportResolver] 📌 Using workspace resolution: ${packageName} → ${version}`)
      return { version, source: 'workspace-resolution' }
    }
    
    // PRIORITY 2: Lock file (if no workspace override)
    if (this.lockFileVersions.has(packageName)) {
      const version = this.lockFileVersions.get(packageName)
      console.log(`[ImportResolver] 🔒 Using lock file version: ${packageName} → ${version}`)
      return { version, source: 'lock-file' }
    }
    
    // PRIORITY 3: Fetch package.json (fallback)
    return await this.fetchPackageVersionFromNpm(packageName)
  }

  /**
   * Fetch package version from npm and save package.json
   */
  private async fetchPackageVersionFromNpm(packageName: string): Promise<{ version: string | null, source: string }> {
    try {
      console.log(`[ImportResolver] 📦 Fetching package.json for: ${packageName}`)
      
      const packageJsonUrl = `${packageName}/package.json`
      const content = await this.pluginApi.call('contentImport', 'resolve', packageJsonUrl)
      
      const packageJson = JSON.parse(content.content || content)
      if (!packageJson.version) {
        return { version: null, source: 'fetched' }
      }
      
      // Save package.json to file system for visibility and debugging
      try {
        const targetPath = `.deps/npm/${packageName}@${packageJson.version}/package.json`
        await this.pluginApi.call('fileManager', 'setFile', targetPath, JSON.stringify(packageJson, null, 2))
        console.log(`[ImportResolver] 💾 Saved package.json to: ${targetPath}`)
      } catch (saveErr) {
        console.log(`[ImportResolver] ⚠️  Failed to save package.json:`, saveErr)
      }
      
      return { version: packageJson.version, source: 'package-json' }
    } catch (err) {
      console.log(`[ImportResolver] ⚠️  Failed to fetch package.json for ${packageName}:`, err)
      return { version: null, source: 'fetched' }
    }
  }

  private async fetchAndMapPackage(packageName: string): Promise<void> {
    const mappingKey = `__PKG__${packageName}`
    
    if (this.importMappings.has(mappingKey)) {
      return
    }
    
    // Resolve version from workspace, lock file, or npm
    const { version: resolvedVersion, source } = await this.resolvePackageVersion(packageName)
    
    if (!resolvedVersion) {
      return
    }
    
    const versionedPackageName = `${packageName}@${resolvedVersion}`
    this.importMappings.set(mappingKey, versionedPackageName)
    
    // Record the source of this resolution
    if (source === 'workspace-resolution' || source === 'lock-file') {
      this.packageSources.set(packageName, 'workspace')
    } else {
      this.packageSources.set(packageName, packageName) // Direct fetch from npm
    }
    
    console.log(`[ImportResolver] ✅ Mapped ${packageName} → ${versionedPackageName} (source: ${source})`)
    
    // Check dependencies for conflicts
    await this.checkPackageDependenciesIfNeeded(packageName, resolvedVersion, source)
    
    console.log(`[ImportResolver] 📊 Total isolated mappings: ${this.importMappings.size}`)
  }

  /**
   * Check package dependencies if we haven't already (when using lock file or workspace resolutions)
   */
  private async checkPackageDependenciesIfNeeded(packageName: string, resolvedVersion: string, source: string): Promise<void> {
    try {
      const packageJsonUrl = `${packageName}/package.json`
      const content = await this.pluginApi.call('contentImport', 'resolve', packageJsonUrl)
      const packageJson = JSON.parse(content.content || content)
      
      // Save package.json if we haven't already (when using lock file or workspace resolutions)
      if (source !== 'package-json') {
        try {
          const targetPath = `.deps/npm/${packageName}@${resolvedVersion}/package.json`
          await this.pluginApi.call('fileManager', 'setFile', targetPath, JSON.stringify(packageJson, null, 2))
          console.log(`[ImportResolver] 💾 Saved package.json to: ${targetPath}`)
        } catch (saveErr) {
          console.log(`[ImportResolver] ⚠️  Failed to save package.json:`, saveErr)
        }
      }
      
      // Check dependencies for conflicts
      await this.checkPackageDependencies(packageName, resolvedVersion, packageJson)
    } catch (err) {
      // Dependencies are optional, don't fail compilation
      console.log(`[ImportResolver] ℹ️  Could not check dependencies for ${packageName}`)
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
            // Extract the relative file path to check for actual duplicate imports
            const relativePath = this.extractRelativePath(url, packageName)
            const fileKey = relativePath ? `${packageName}/${relativePath}` : null
            
            // Check if we've already imported this EXACT file from a different version
            const previousVersion = fileKey ? this.importedFiles.get(fileKey) : null
            
            if (previousVersion && previousVersion !== resolvedVersion) {
              // REAL CONFLICT: Same file imported from two different versions
              const conflictKey = `${fileKey}:${previousVersion}↔${resolvedVersion}`
              
              if (!this.conflictWarnings.has(conflictKey)) {
                this.conflictWarnings.add(conflictKey)
                
                // Determine the source of the resolved version
                let resolutionSource = 'npm registry'
                const sourcePackage = this.packageSources.get(packageName)
                if (this.workspaceResolutions.has(packageName)) {
                  resolutionSource = 'workspace package.json'
                } else if (this.lockFileVersions.has(packageName)) {
                  resolutionSource = 'lock file'
                } else if (sourcePackage && sourcePackage !== packageName) {
                  resolutionSource = `${sourcePackage}/package.json`
                }
                
                const warningMsg = [
                  `🚨 DUPLICATE FILE DETECTED - Will cause compilation errors!`,
                  `   File: ${relativePath}`,
                  `   From package: ${packageName}`,
                  ``,
                  `   Already imported from version: ${previousVersion}`,
                  `   Now requesting version:       ${resolvedVersion}`,
                  `     (from ${resolutionSource})`,
                  ``,
                  `🔧 REQUIRED FIX - Use explicit versioned imports in your Solidity file:`,
                  `   Choose ONE version:`,
                  `     import "${packageName}@${previousVersion}/${relativePath}";`,
                  `   OR`,
                  `     import "${packageName}@${resolvedVersion}/${relativePath}";`,
                  `     (and update package.json: "${packageName}": "${resolvedVersion}")`,
                  ``
                ].join('\n')
                
                this.pluginApi.call('terminal', 'log', { 
                  type: 'error', 
                  value: warningMsg 
                }).catch(err => {
                  console.warn(warningMsg)
                })
              }
            } else if (fileKey && !previousVersion) {
              // First time seeing this file - just record which version we're using
              // Don't warn about version mismatches here - only warn if same file imported twice
              this.importedFiles.set(fileKey, resolvedVersion)
              console.log(`[ImportResolver] 📝 Tracking import: ${fileKey} from version ${resolvedVersion}`)
            }
            
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
