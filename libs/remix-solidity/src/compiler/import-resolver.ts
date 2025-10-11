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
  private parentPackageDependencies: Map<string, Map<string, string>> = new Map() // Track dependencies of each parent package: "parent@version" -> { "dep" -> "version" }
  private debug: boolean = false

  // Shared resolution index across all ImportResolver instances
  private resolutionIndex: ResolutionIndex | null = null
  private resolutionIndexInitialized: boolean = false

  constructor(pluginApi: Plugin, targetFile: string, debug: boolean = false) {
    this.pluginApi = pluginApi
    this.targetFile = targetFile
    this.debug = debug
    this.importMappings = new Map()

    this.log(`[ImportResolver] 🆕 Created new resolver instance for: "${targetFile}"`)

    this.resolutionIndexInitialized = true
    this.resolutionIndex = new ResolutionIndex(this.pluginApi, this.debug)
    this.resolutionIndex.load().catch(err => {
      this.log(`[ImportResolver] ⚠️  Failed to load resolution index:`, err)
    })

    // Initialize workspace resolution rules
    this.initializeWorkspaceResolutions().catch(err => {
      this.log(`[ImportResolver] ⚠️  Failed to initialize workspace resolutions:`, err)
    })
  }

  /**
   * Internal debug logging method
   */
  private log(message: string, ...args: any[]): void {
    if (this.debug) {
      console.log(message, ...args)
    }
  }

  public clearMappings(): void {
    this.log(`[ImportResolver] 🧹 Clearing all import mappings`)
    this.importMappings.clear()
  }

  /**
   * Set the package context for resolution
   * This is called by DependencyResolver to inform the resolver which package
   * the current file belongs to, enabling context-aware resolution
   */
  public setPackageContext(packageContext: string | null): void {
    if (packageContext) {
      this.log(`[ImportResolver] 📦 Setting package context: ${packageContext}`)
      // Store the current package context - this will be used by findParentPackageContext()
      // We can make the parent lookup smarter by explicitly setting context
      const mappingKey = `__CONTEXT__`
      this.importMappings.set(mappingKey, packageContext)
    }
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

      this.log(`[ImportResolver] 📋 Workspace resolutions loaded:`, this.workspaceResolutions.size)
      this.log(`[ImportResolver] 🔒 Lock file versions loaded:`, this.lockFileVersions.size)
    } catch (err) {
      this.log(`[ImportResolver] ⚠️  Error initializing workspace resolutions:`, err)
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
          this.log(`[ImportResolver] 📌 Workspace resolution: ${pkg} → ${version}`)
        }
      }

      // Also check dependencies and peerDependencies for version hints
      // These are lower priority than explicit resolutions/overrides
      const allDeps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.peerDependencies || {}),
        ...(packageJson.devDependencies || {})
      }

      for (const [pkg, versionRange] of Object.entries(allDeps)) {
        // Only store if not already set by resolutions/overrides
        if (!this.workspaceResolutions.has(pkg) && typeof versionRange === 'string') {
          // Handle npm aliases like "npm:@openzeppelin/contracts@4.8.3"
          if (versionRange.startsWith('npm:')) {
            const npmAlias = versionRange.substring(4) // Remove "npm:" prefix
            const match = npmAlias.match(/^(@?[^@]+)@(.+)$/)
            if (match) {
              const [, realPackage, version] = match
              this.workspaceResolutions.set(pkg, `alias:${realPackage}@${version}`)
              this.log(`[ImportResolver] 🔗 NPM alias: ${pkg} → ${realPackage}@${version}`)
            } else {
              this.log(`[ImportResolver] ⚠️  Invalid npm alias format: ${pkg} → ${versionRange}`)
            }
          }
          // For exact versions (e.g., "4.8.3"), store directly
          // For ranges (e.g., "^4.8.0"), we'll need the lock file or npm to resolve
          else if (versionRange.match(/^\d+\.\d+\.\d+$/)) {
            // Exact version - store it
            this.workspaceResolutions.set(pkg, versionRange)
            this.log(`[ImportResolver] 📦 Workspace dependency (exact): ${pkg} → ${versionRange}`)
          } else {
            // Range - just log it, lock file or npm will resolve
            this.log(`[ImportResolver] 📦 Workspace dependency (range): ${pkg}@${versionRange}`)
          }
        }
      }
    } catch (err) {
      this.log(`[ImportResolver] ℹ️  No workspace package.json or resolutions`)
    }
  }

  /**
   * Parse lock file to get actual installed versions
   */
  private async loadLockFileVersions(): Promise<void> {
    // Only reload if we haven't loaded lock files yet (avoid repeated logging)
    if (this.lockFileVersions.size > 0) {
      return
    }

    // Try yarn.lock first
    try {
      const yarnLockExists = await this.pluginApi.call('fileManager', 'exists', 'yarn.lock')
      if (yarnLockExists) {
        await this.parseYarnLock()
        return
      }
    } catch (err) {
      // Silent
    }

    // Try package-lock.json
    try {
      const npmLockExists = await this.pluginApi.call('fileManager', 'exists', 'package-lock.json')
      if (npmLockExists) {
        await this.parsePackageLock()
        return
      }
    } catch (err) {
      // Silent
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
        // Match: "@openzeppelin/contracts@^5.0.0": or "lodash@^4.17.0":
        // For scoped packages: "@scope/package@version"
        // For regular packages: "package@version"
        const packageMatch = line.match(/^"?(@?[^"@]+(?:\/[^"@]+)?)@[^"]*"?:/)
        if (packageMatch) {
          currentPackage = packageMatch[1]
        }

        // Match:   version "5.4.0"
        const versionMatch = line.match(/^\s+version\s+"([^"]+)"/)
        if (versionMatch && currentPackage) {
          this.lockFileVersions.set(currentPackage, versionMatch[1])
          currentPackage = null
        }
      }

      this.log(`[ImportResolver] 🔒 Loaded ${this.lockFileVersions.size} versions from yarn.lock`)
    } catch (err) {
      this.log(`[ImportResolver] ⚠️  Failed to parse yarn.lock:`, err)
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
          }
        }
      }

      // npm v3 format
      if (lockData.packages) {
        for (const [path, data] of Object.entries(lockData.packages)) {
          if (data && typeof data === 'object' && 'version' in data) {
            // Skip root package (path is empty string "")
            if (path === '') continue

            // Extract package name from path
            // Format: "node_modules/@openzeppelin/contracts" -> "@openzeppelin/contracts"
            const pkg = path.replace(/^node_modules\//, '')
            if (pkg && pkg !== '') {
              this.lockFileVersions.set(pkg, (data as any).version)
            }
          }
        }
      }

      this.log(`[ImportResolver] 🔒 Loaded ${this.lockFileVersions.size} versions from package-lock.json`)
    } catch (err) {
      this.log(`[ImportResolver] ⚠️  Failed to parse package-lock.json:`, err)
    }
  }

  public logMappings(): void {
    this.log(`[ImportResolver] 📊 Current import mappings for: "${this.targetFile}"`)
    if (this.importMappings.size === 0) {
      this.log(`[ImportResolver] ℹ️  No mappings defined`)
    } else {
      this.importMappings.forEach((value, key) => {
        this.log(`[ImportResolver]   ${key} → ${value}`)
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
    this.log(`[ImportResolver] 🔗 Found ${depTypes.join(' & ')} for ${packageName}:`, Object.keys(allDeps))

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

    // For peer dependencies, check against workspace/lock file versions even if not yet imported
    // For regular dependencies, only check if already mapped (don't recursively fetch entire tree)
    const depMappingKey = `__PKG__${dep}`
    let resolvedDepVersion: string | null = null

    if (this.importMappings.has(depMappingKey)) {
      // Dependency already imported - get its mapped version
      const resolvedDepPackage = this.importMappings.get(depMappingKey)
      resolvedDepVersion = this.extractVersion(resolvedDepPackage)
    } else if (isPeerDep) {
      // Peer dependency not yet imported - check what version would be resolved
      // Check workspace resolutions first
      if (this.workspaceResolutions.has(dep)) {
        resolvedDepVersion = this.workspaceResolutions.get(dep)!
      } else if (this.lockFileVersions.has(dep)) {
        resolvedDepVersion = this.lockFileVersions.get(dep)!
      }
      // Don't fetch from npm - that's too expensive for peer dep checking
    } else {
      // Regular dependency not yet imported - skip check
      return
    }

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
    const isAlreadyImported = this.importMappings.has(depMappingKey)

    const warningMsg = [
      `${emoji} ${isPeerDep ? 'Peer Dependency' : 'Dependency'} version mismatch detected:`,
      `   Package ${packageName}@${packageVersion} requires in ${depType}:`,
      `     "${dep}": "${requestedRange}"`,
      ``,
      isAlreadyImported
        ? `   But actual imported version is: ${dep}@${resolvedDepVersion}`
        : `   But your workspace will resolve to: ${dep}@${resolvedDepVersion}`,
      `     (from ${resolvedFrom})`,
      ``,
      isBreaking && isPeerDep ? `⚠️  PEER DEPENDENCY MISMATCH - This WILL cause compilation failures!` : '',
      isBreaking && !isPeerDep ? `⚠️  MAJOR VERSION MISMATCH - May cause compilation failures!` : '',
      isBreaking ? `` : '',
      `💡 To fix, update your workspace package.json:`,
      `     "${dep}": "${requestedRange}"`,
      isPeerDep ? `   (Peer dependencies must be satisfied for ${packageName} to work correctly)` : '',
      ``
    ].filter(line => line !== '').join('\n')

    this.pluginApi.call('terminal', 'log', {
      type: severity,
      value: warningMsg
    }).catch(() => {
      console.warn(warningMsg)
    })
  }

  /**
   * Find the parent package context we're currently resolving from
   * E.g., if we've mapped @chainlink/contracts-ccip@1.6.1, and it imports @chainlink/contracts,
   * we want to use contracts-ccip's dependencies to resolve that import
   */
  /**
   * Find the parent package context for dependency resolution
   * First checks for explicitly set context (from DependencyResolver),
   * then falls back to LIFO (most recently mapped package)
   */
  private findParentPackageContext(): string | null {
    // Priority 1: Check for explicitly set context (from DependencyResolver)
    const explicitContext = this.importMappings.get('__CONTEXT__')
    if (explicitContext && this.parentPackageDependencies.has(explicitContext)) {
      this.log(`[ImportResolver]    📍 Using explicit context: ${explicitContext}`)
      return explicitContext
    }

    // Priority 2: Fall back to LIFO approach
    // Look through all mapped packages to find a potential parent
    // The most recently mapped package is likely the parent we're resolving from
    const mappedPackages = Array.from(this.importMappings.values())
      .filter(v => v !== explicitContext && v.includes('@')) // Only versioned packages, exclude context marker
      .map(v => {
        // Extract package@version from versioned package name
        const match = v.match(/^(@?[^@]+)@(.+)$/)
        return match ? `${match[1]}@${match[2]}` : null
      })
      .filter(Boolean)

    // Return the most recently added parent package (LIFO - last in, first out)
    for (let i = mappedPackages.length - 1; i >= 0; i--) {
      const pkg = mappedPackages[i]
      if (pkg && this.parentPackageDependencies.has(pkg)) {
        return pkg
      }
    }

    return null
  }

  /**
   * Check if multiple parent packages have conflicting dependencies on the same package
   * This helps users understand complex dependency conflicts
   */
  private checkForConflictingParentDependencies(packageName: string): void {
    const conflictingParents: Array<{ parent: string, version: string }> = []

    // Check all parent packages to see if they depend on this package
    for (const [parentPkg, deps] of this.parentPackageDependencies.entries()) {
      if (deps.has(packageName)) {
        conflictingParents.push({
          parent: parentPkg,
          version: deps.get(packageName)!
        })
      }
    }

    // If 2+ parent packages have different versions of the same dependency, warn the user
    if (conflictingParents.length >= 2) {
      const uniqueVersions = new Set(conflictingParents.map(p => p.version))

      if (uniqueVersions.size > 1) {
        const conflictKey = `multi-parent:${packageName}:${Array.from(uniqueVersions).sort().join('↔')}`

        if (!this.conflictWarnings.has(conflictKey)) {
          this.conflictWarnings.add(conflictKey)

          const warningMsg = [
            `⚠️  MULTI-PARENT DEPENDENCY CONFLICT`,
            ``,
            `   Multiple parent packages require different versions of: ${packageName}`,
            ``,
            ...conflictingParents.map(p => `   • ${p.parent} requires ${packageName}@${p.version}`),
            ``
          ].join('\n')

          this.pluginApi.call('terminal', 'log', {
            type: 'warn',
            value: warningMsg
          }).catch(() => {
            console.warn(warningMsg)
          })
        }
      }
    }
  }

  /**
   * Resolve a package version from workspace, lock file, or npm
   */
  private async resolvePackageVersion(packageName: string): Promise<{ version: string | null, source: string }> {
    this.log(`[ImportResolver] 🔍 Resolving version for: ${packageName}`)

    // Check if multiple parent packages have conflicting dependencies
    this.checkForConflictingParentDependencies(packageName)

    // PRIORITY 1: Workspace resolutions/overrides - ALWAYS reload fresh
    await this.loadWorkspaceResolutions()

    if (this.workspaceResolutions.has(packageName)) {
      const resolution = this.workspaceResolutions.get(packageName)

      // Handle npm aliases like "alias:@openzeppelin/contracts@4.8.3"
      if (resolution?.startsWith('alias:')) {
        const aliasTarget = resolution.substring(6) // Remove "alias:" prefix
        this.log(`[ImportResolver] 🔗 PRIORITY 1 - NPM alias: ${packageName} → ${aliasTarget}`)
        const match = aliasTarget.match(/^(@?[^@]+)@(.+)$/)
        if (match) {
          const [, realPackage, version] = match
          // Return the specific version from the alias, don't recurse
          return { version, source: `alias:${packageName}→${realPackage}` }
        }
      } else {
        this.log(`[ImportResolver] ✅ PRIORITY 1 - Workspace resolution: ${packageName} → ${resolution}`)
        return { version: resolution, source: 'workspace-resolution' }
      }
    }
    this.log(`[ImportResolver]    ⏭️  Priority 1 (workspace): Not found`)

    // PRIORITY 2: Parent package dependencies
    // Check if we're resolving from within a parent package (e.g., @chainlink/contracts-ccip@1.6.1)
    const parentPackage = this.findParentPackageContext()
    if (parentPackage) {
      this.log(`[ImportResolver]    🔍 Priority 2 (parent): Checking ${parentPackage}`)
      const parentDeps = this.parentPackageDependencies.get(parentPackage)
      if (parentDeps && parentDeps.has(packageName)) {
        const version = parentDeps.get(packageName)!
        this.log(`[ImportResolver] ✅ PRIORITY 2 - Parent dependency: ${packageName} → ${version} (from ${parentPackage})`)
        return { version, source: `parent-${parentPackage}` }
      } else {
        this.log(`[ImportResolver]    ⏭️  Priority 2 (parent): ${packageName} not in ${parentPackage} deps`)
      }
    } else {
      this.log(`[ImportResolver]    ⏭️  Priority 2 (parent): No parent package context`)
    }

    // PRIORITY 3: Lock file (if no workspace override or parent dependency)
    // Reload lock files fresh each time to pick up changes
    await this.loadLockFileVersions()

    if (this.lockFileVersions.has(packageName)) {
      const version = this.lockFileVersions.get(packageName)
      this.log(`[ImportResolver] ✅ PRIORITY 3 - Lock file: ${packageName} → ${version}`)
      return { version, source: 'lock-file' }
    }
    this.log(`[ImportResolver]    ⏭️  Priority 3 (lock file): Not found`)

    // PRIORITY 4: Fetch package.json (fallback)
    this.log(`[ImportResolver]    🌐 Priority 4 (NPM): Fetching latest...`)
    return await this.fetchPackageVersionFromNpm(packageName)
  }

  /**
   * Fetch package version from npm and save package.json
   */
  private async fetchPackageVersionFromNpm(packageName: string): Promise<{ version: string | null, source: string }> {
    try {
      this.log(`[ImportResolver] 📦 Fetching package.json for: ${packageName}`)

      const packageJsonUrl = `${packageName}/package.json`
      const content = await this.pluginApi.call('contentImport', 'resolve', packageJsonUrl)

      const packageJson = JSON.parse(content.content || content)
      if (!packageJson.version) {
        return { version: null, source: 'fetched' }
      }

      // Save package.json to file system for visibility and debugging
      // Use the actual package name from package.json, not the potentially aliased packageName parameter
      const realPackageName = packageJson.name || packageName
      try {
        const targetPath = `.deps/npm/${realPackageName}@${packageJson.version}/package.json`
        await this.pluginApi.call('fileManager', 'setFile', targetPath, JSON.stringify(packageJson, null, 2))
        this.log(`[ImportResolver] 💾 Saved package.json to: ${targetPath}`)
      } catch (saveErr) {
        this.log(`[ImportResolver] ⚠️  Failed to save package.json:`, saveErr)
      }

      // Store parent's dependencies for future lookups
      this.storePackageDependencies(`${packageName}@${packageJson.version}`, packageJson)

      return { version: packageJson.version, source: 'package-json' }
    } catch (err) {
      this.log(`[ImportResolver] ⚠️  Failed to fetch package.json for ${packageName}:`, err)
      return { version: null, source: 'fetched' }
    }
  }

  /**
   * Extract and store dependencies from a package.json for future parent context resolution
   */
  private storePackageDependencies(packageKey: string, packageJson: any): void {
    if (!packageJson.dependencies && !packageJson.peerDependencies) {
      return
    }

    const deps = new Map<string, string>()

    // Store regular dependencies
    if (packageJson.dependencies) {
      for (const [dep, versionRange] of Object.entries(packageJson.dependencies)) {
        // Extract version number from range (e.g., "^1.4.0" -> "1.4.0")
        const cleanVersion = (versionRange as string).replace(/^[\^~>=<]+/, '')
        deps.set(dep, cleanVersion)
      }
    }

    // Store peer dependencies
    if (packageJson.peerDependencies) {
      for (const [dep, versionRange] of Object.entries(packageJson.peerDependencies)) {
        if (!deps.has(dep)) {
          const cleanVersion = (versionRange as string).replace(/^[\^~>=<]+/, '')
          deps.set(dep, cleanVersion)
        }
      }
    }

    this.parentPackageDependencies.set(packageKey, deps)
    this.log(`[ImportResolver] 📚 Stored ${deps.size} dependencies for ${packageKey}:`)
    deps.forEach((version, dep) => {
      this.log(`[ImportResolver]      - ${dep}: ${version}`)
    })
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

    // Handle npm aliases: if this is an alias, use the real package name
    let actualPackageName = packageName
    if (source.startsWith('alias:')) {
      const aliasMatch = source.match(/^alias:[^→]+→(.+)$/)
      if (aliasMatch) {
        actualPackageName = aliasMatch[1]
        this.log(`[ImportResolver] 🔄 Using real package name: ${packageName} → ${actualPackageName}`)
      }
    }

    const versionedPackageName = `${actualPackageName}@${resolvedVersion}`
    this.importMappings.set(mappingKey, versionedPackageName)

    // Record the source of this resolution
    if (source === 'workspace-resolution' || source === 'lock-file') {
      this.packageSources.set(packageName, 'workspace')
    } else {
      this.packageSources.set(packageName, packageName) // Direct fetch from npm
    }

    this.log(`[ImportResolver] ✅ Mapped ${packageName} → ${versionedPackageName} (source: ${source})`)

    // Check dependencies for conflicts
    await this.checkPackageDependenciesIfNeeded(packageName, resolvedVersion, source)

    this.log(`[ImportResolver] 📊 Total isolated mappings: ${this.importMappings.size}`)
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
          // Use the actual package name from package.json, not the potentially aliased packageName parameter
          const realPackageName = packageJson.name || packageName
          const targetPath = `.deps/npm/${realPackageName}@${resolvedVersion}/package.json`
          await this.pluginApi.call('fileManager', 'setFile', targetPath, JSON.stringify(packageJson, null, 2))
          this.log(`[ImportResolver] 💾 Saved package.json to: ${targetPath}`)
        } catch (saveErr) {
          this.log(`[ImportResolver] ⚠️  Failed to save package.json:`, saveErr)
        }
      }

      // Store dependencies for future parent context resolution
      this.storePackageDependencies(`${packageName}@${resolvedVersion}`, packageJson)

      // Check dependencies for conflicts
      await this.checkPackageDependencies(packageName, resolvedVersion, packageJson)
    } catch (err) {
      // Dependencies are optional, don't fail compilation
      this.log(`[ImportResolver] ℹ️  Could not check dependencies for ${packageName}`)
    }
  }

  public async resolveAndSave(url: string, targetPath?: string, skipResolverMappings = false): Promise<string> {
    const originalUrl = url
    
    // If this is an external URL, check if it's a CDN serving an npm package
    if (url.startsWith('http://') || url.startsWith('https://')) {
      this.log(`[ImportResolver] 🌐 External URL detected: ${url}`)
      
      // Convert GitHub blob URLs to raw.githubusercontent.com for direct file access
      const githubBlobMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/)
      if (githubBlobMatch) {
        const owner = githubBlobMatch[1]
        const repo = githubBlobMatch[2]
        const ref = githubBlobMatch[3]
        const filePath = githubBlobMatch[4]
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`
        this.log(`[ImportResolver]   🔄 Converting GitHub blob URL to raw: ${rawUrl}`)
        url = rawUrl
      }
      
      // Check if this CDN URL is serving an npm package
      // unpkg.com/@scope/pkg@version/... → @scope/pkg@version/...
      // cdn.jsdelivr.net/npm/@scope/pkg@version/... → @scope/pkg@version/...
      const npmCdnMatch = url.match(/^https?:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net\/npm)\/(@?[^/]+(?:\/[^/@]+)?)@([^/]+)\/(.+)$/)
      
      if (npmCdnMatch) {
        const packageName = npmCdnMatch[1]
        const version = npmCdnMatch[2]
        const filePath = npmCdnMatch[3]
        const npmPath = `${packageName}@${version}/${filePath}`
        
        this.log(`[ImportResolver]   🔄 CDN URL is serving npm package, normalizing:`)
        this.log(`[ImportResolver]      From: ${url}`)
        this.log(`[ImportResolver]      To:   ${npmPath}`)
        
        // Record the mapping from original URL to npm path
        if (!this.resolutions.has(originalUrl)) {
          this.resolutions.set(originalUrl, npmPath)
        }
        
        // Now resolve it as a regular npm import (this will use our existing npm resolution logic)
        return await this.resolveAndSave(npmPath, targetPath, skipResolverMappings)
      }
      
      // For raw.githubusercontent.com URLs, normalize to a cleaner path structure
      // raw.githubusercontent.com/owner/repo/ref/path → github/owner/repo@ref/path
      const rawGithubMatch = url.match(/^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/)
      if (rawGithubMatch) {
        const owner = rawGithubMatch[1]
        const repo = rawGithubMatch[2]
        const ref = rawGithubMatch[3]
        const filePath = rawGithubMatch[4]
        
        // Create a normalized path without the full URL
        const normalizedPath = `github/${owner}/${repo}@${ref}/${filePath}`
        const normalizedTargetPath = `.deps/${normalizedPath}`
        
        this.log(`[ImportResolver]   🔄 Normalizing raw.githubusercontent.com URL:`)
        this.log(`[ImportResolver]      From: ${url}`)
        this.log(`[ImportResolver]      To:   ${normalizedPath}`)
        
        // Fetch the content using the full URL but save to normalized path
        const content = await this.pluginApi.call('contentImport', 'resolveAndSave', url, normalizedTargetPath, false)
        
        this.log(`[ImportResolver]   ✅ Received content: ${content ? content.length : 0} chars`)
        
        // Record the mapping from original URL to normalized path
        if (!this.resolutions.has(originalUrl)) {
          this.resolutions.set(originalUrl, normalizedPath)
        }
        
        return content
      }
    }

    // Handle IPFS URLs: ipfs://QmHash/path or ipfs://ipfs/QmHash/path
    if (url.startsWith('ipfs://')) {
      this.log(`[ImportResolver] 🌐 IPFS URL detected: ${url}`)
      
      // Extract hash and path
      const ipfsMatch = url.match(/^ipfs:\/\/(?:ipfs\/)?([^/]+)(?:\/(.+))?$/)
      if (ipfsMatch) {
        const hash = ipfsMatch[1]
        const filePath = ipfsMatch[2] || ''
        
        // Create a normalized path
        const normalizedPath = filePath ? `ipfs/${hash}/${filePath}` : `ipfs/${hash}`
        const normalizedTargetPath = `.deps/${normalizedPath}`
        
        this.log(`[ImportResolver]   🔄 Normalizing IPFS URL:`)
        this.log(`[ImportResolver]      From: ${url}`)
        this.log(`[ImportResolver]      To:   ${normalizedPath}`)
        
        // Fetch the content using the IPFS URL
        const content = await this.pluginApi.call('contentImport', 'resolveAndSave', url, normalizedTargetPath, false)
        
        this.log(`[ImportResolver]   ✅ Received content: ${content ? content.length : 0} chars`)
        
        // Record the mapping from original URL to normalized path
        if (!this.resolutions.has(originalUrl)) {
          this.resolutions.set(originalUrl, normalizedPath)
        }
        
        return content
      }
    }

    // Handle Swarm URLs: bzz-raw://hash/path or bzz://hash/path
    if (url.startsWith('bzz-raw://') || url.startsWith('bzz://')) {
      this.log(`[ImportResolver] 🌐 Swarm URL detected: ${url}`)
      
      // Extract hash and path
      const swarmMatch = url.match(/^(bzz-raw?):\/\/([^/]+)(?:\/(.+))?$/)
      if (swarmMatch) {
        const protocol = swarmMatch[1]
        const hash = swarmMatch[2]
        const filePath = swarmMatch[3] || ''
        
        // Create a normalized path
        const normalizedPath = filePath ? `swarm/${hash}/${filePath}` : `swarm/${hash}`
        const normalizedTargetPath = `.deps/${normalizedPath}`
        
        this.log(`[ImportResolver]   🔄 Normalizing Swarm URL:`)
        this.log(`[ImportResolver]      From: ${url}`)
        this.log(`[ImportResolver]      To:   ${normalizedPath}`)
        
        // Fetch the content using the Swarm URL
        const content = await this.pluginApi.call('contentImport', 'resolveAndSave', url, normalizedTargetPath, false)
        
        this.log(`[ImportResolver]   ✅ Received content: ${content ? content.length : 0} chars`)
        
        // Record the mapping from original URL to normalized path
        if (!this.resolutions.has(originalUrl)) {
          this.resolutions.set(originalUrl, normalizedPath)
        }
        
        return content
      }
    }

    // For other external HTTP/HTTPS URLs (not npm CDN, not GitHub raw), fetch directly
    if (url.startsWith('http://') || url.startsWith('https://')) {
      this.log(`[ImportResolver]   ⬇️  Fetching directly from URL: ${url}`)
      const content = await this.pluginApi.call('contentImport', 'resolveAndSave', url, targetPath, true)
      
      this.log(`[ImportResolver]   ✅ Received content: ${content ? content.length : 0} chars`)
      if (!content) {
        this.log(`[ImportResolver]   ⚠️  WARNING: Empty content returned from contentImport`)
      } else if (content.length < 200) {
        this.log(`[ImportResolver]   ⚠️  WARNING: Suspiciously short content: "${content.substring(0, 100)}"`)
      }
      
      // Record a simple mapping for traceability (original -> resolved URL)
      if (!this.resolutions.has(originalUrl)) {
        this.resolutions.set(originalUrl, url)
      }
      
      return content
    }
    
    // Handle npm: alias in import paths directly, e.g., "npm:@openzeppelin/contracts@4.9.0/..."
    if (url.startsWith('npm:')) {
      this.log(`[ImportResolver] 🔗 Detected npm: alias in URL, normalizing: ${url}`)
      url = url.substring(4)
    }
    
    let finalUrl = url
    const packageName = this.extractPackageName(url)

    if (!skipResolverMappings && packageName) {
      const hasVersion = url.includes(`${packageName}@`)

      if (!hasVersion) {
        const mappingKey = `__PKG__${packageName}`

        if (!this.importMappings.has(mappingKey)) {
          this.log(`[ImportResolver] 🔍 First import from ${packageName}, resolving version...`)
          await this.fetchAndMapPackage(packageName)
        }

        if (this.importMappings.has(mappingKey)) {
          const versionedPackageName = this.importMappings.get(mappingKey)
          const mappedUrl = url.replace(packageName, versionedPackageName)
          this.log(`[ImportResolver] 🔀 Mapped: ${packageName} → ${versionedPackageName}`)

          finalUrl = mappedUrl
          this.resolutions.set(originalUrl, finalUrl)

          return this.resolveAndSave(mappedUrl, targetPath, true)
        } else {
          this.log(`[ImportResolver] ⚠️  No mapping available for ${mappingKey}`)
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

            if (previousVersion && previousVersion !== requestedVersion) {
              // REAL CONFLICT: Same file imported from two different versions
              const conflictKey = `${fileKey}:${previousVersion}↔${requestedVersion}`

              if (!this.conflictWarnings.has(conflictKey)) {
                this.conflictWarnings.add(conflictKey)

                const warningMsg = [
                  `🚨 DUPLICATE FILE DETECTED - Will cause compilation errors!`,
                  `   File: ${relativePath}`,
                  `   From package: ${packageName}`,
                  ``,
                  `   Already imported from version: ${previousVersion}`,
                  `   Now requesting version:       ${requestedVersion}`,
                  ``,
                  `🔧 REQUIRED FIX - Use explicit versioned imports in your Solidity file:`,
                  `   Choose ONE version:`,
                  `     import "${packageName}@${previousVersion}/${relativePath}";`,
                  `   OR`,
                  `     import "${packageName}@${requestedVersion}/${relativePath}";`,
                  ``
                ].join('\n')

                this.pluginApi.call('terminal', 'log', {
                  type: 'error',
                  value: warningMsg
                }).catch(() => {
                  console.warn(warningMsg)
                })
              }
            }

            // Record this file import (even if different version)
            if (fileKey) {
              this.importedFiles.set(fileKey, requestedVersion)
              this.log(`[ImportResolver] 📝 Tracking: ${fileKey} @ ${requestedVersion}`)
            }

            // IMPORTANT: Don't force version mapping! Allow explicit version to be used
            // This allows: contracts@4.8.0/ERC20.sol + contracts@5.2.0/StorageSlot.sol
            // (different files, no conflict)
            this.log(`[ImportResolver] ✅ Explicit version: ${packageName}@${requestedVersion}`)

            // Fetch and save package.json for this version (if not already done)
            const versionedPackageName = `${packageName}@${requestedVersion}`
            if (!this.parentPackageDependencies.has(versionedPackageName)) {
              try {
                const packageJsonUrl = `${packageName}@${requestedVersion}/package.json`
                const content = await this.pluginApi.call('contentImport', 'resolve', packageJsonUrl)
                const packageJson = JSON.parse(content.content || content)

                const pkgJsonPath = `.deps/npm/${versionedPackageName}/package.json`
                await this.pluginApi.call('fileManager', 'setFile', pkgJsonPath, JSON.stringify(packageJson, null, 2))
                this.log(`[ImportResolver] 💾 Saved package.json to: ${pkgJsonPath}`)

                // Store dependencies for future parent context resolution
                this.storePackageDependencies(versionedPackageName, packageJson)
              } catch (err) {
                this.log(`[ImportResolver] ⚠️  Failed to fetch/save package.json:`, err)
              }
            }

            // Use the URL as-is (with explicit version)
            finalUrl = url
            this.resolutions.set(originalUrl, finalUrl)

            return this.resolveAndSave(url, targetPath, true)
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
              this.log(`[ImportResolver] 💾 Saved package.json to: ${targetPath}`)

              // Store dependencies for future parent context resolution
              this.storePackageDependencies(versionedPackageName, packageJson)
            } catch (err) {
              this.log(`[ImportResolver] ⚠️  Failed to fetch/save package.json:`, err)
            }
          }
        }
      }
    }

    this.log(`[ImportResolver] 📥 Fetching: ${url}`)
    const content = await this.pluginApi.call('contentImport', 'resolveAndSave', url, targetPath, true)

    if (!skipResolverMappings || originalUrl === url) {
      if (!this.resolutions.has(originalUrl)) {
        this.resolutions.set(originalUrl, url)
      }
    }

    return content
  }

  public async saveResolutionsToIndex(): Promise<void> {
    this.log(`[ImportResolver] 💾 Saving ${this.resolutions.size} resolution(s) to index for: ${this.targetFile}`)

    if (!this.resolutionIndex) {
      this.log(`[ImportResolver] ⚠️  Resolution index not initialized, skipping save`)
      return
    }

    this.resolutionIndex.clearFileResolutions(this.targetFile)

    this.resolutions.forEach((resolvedPath, originalImport) => {
      this.resolutionIndex!.recordResolution(this.targetFile, originalImport, resolvedPath)
    })

    await this.resolutionIndex.save()
  }

  public getTargetFile(): string {
    return this.targetFile
  }

  public getResolution(originalImport: string): string | null {
    return this.resolutions.get(originalImport) || null
  }
}
