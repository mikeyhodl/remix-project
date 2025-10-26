'use strict'

import { Plugin } from '@remixproject/engine'
import { ResolutionIndex } from './resolution-index'
import { IImportResolver } from './import-resolver-interface'
import { normalizeGithubBlobUrl, normalizeIpfsUrl, normalizeRawGithubUrl, normalizeSwarmUrl, rewriteNpmCdnUrl } from './utils/url-normalizer'
import { isBreakingVersionConflict, isPotentialVersionConflict } from './utils/semver-utils'
import { PackageVersionResolver } from './utils/package-version-resolver'
import { Logger } from './utils/logger'
import { ContentFetcher } from './utils/content-fetcher'
import { DependencyStore } from './utils/dependency-store'
import { ConflictChecker } from './utils/conflict-checker'

export class ImportResolver implements IImportResolver {
  private importMappings: Map<string, string>
  private pluginApi: Plugin
  private targetFile: string
  private resolutions: Map<string, string> = new Map()
  private packageVersionResolver: PackageVersionResolver
  private contentFetcher: ContentFetcher
  private dependencyStore: DependencyStore
  private logger: Logger
  private conflictChecker: ConflictChecker
  private conflictWarnings: Set<string> = new Set() // Track warned conflicts
  private importedFiles: Map<string, string> = new Map() // Track imported files: "pkg/path/to/file.sol" -> "version"
  private packageSources: Map<string, string> = new Map() // Track which package.json resolved each dependency: "pkg" -> "source-package"
  private debug: boolean = false

  // Shared resolution index across all ImportResolver instances
  private resolutionIndex: ResolutionIndex | null = null
  private resolutionIndexInitialized: boolean = false

  constructor(pluginApi: Plugin, targetFile: string, debug: boolean = false) {
    this.pluginApi = pluginApi
    this.targetFile = targetFile
    this.debug = debug
    this.importMappings = new Map()
    this.resolutions = new Map()
    this.conflictWarnings = new Set()
    this.importedFiles = new Map()
    this.packageSources = new Map()
    this.packageVersionResolver = new PackageVersionResolver(pluginApi, debug)
    this.logger = new Logger(pluginApi, debug)
    this.contentFetcher = new ContentFetcher(pluginApi, debug)
    this.dependencyStore = new DependencyStore()
    this.conflictChecker = new ConflictChecker(
      this.logger,
      this.packageVersionResolver,
      this.dependencyStore,
      (key: string) => this.importMappings.get(key)
    )
    this.resolutionIndex = null
    this.resolutionIndexInitialized = false
  }

  /**
   * Internal debug logging method
   */
  private log(message: string, ...args: any[]): void {
    if (this.debug) {
      console.log(message, ...args)
    }
  }

  /**
   * Set or clear current package context provided by DependencyResolver
   */
  public setPackageContext(context: string | null): void {
    if (context) {
      this.importMappings.set('__CONTEXT__', context)
    } else {
      this.importMappings.delete('__CONTEXT__')
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
    return isPotentialVersionConflict(requestedRange, resolvedVersion)
  }

  /**
   * Check if version conflict is a BREAKING change (different major versions)
   * This is likely to cause compilation failures
   */
  private isBreakingVersionConflict(requestedRange: string, resolvedVersion: string): boolean {
    return isBreakingVersionConflict(requestedRange, resolvedVersion)
  }

  /**
   * Check dependencies of a package for version conflicts
   */
  private async checkPackageDependencies(packageName: string, resolvedVersion: string, packageJson: any): Promise<void> {
    await this.conflictChecker.checkPackageDependencies(packageName, resolvedVersion, packageJson)
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
      // Check workspace resolutions first, then lock file versions
      if (this.packageVersionResolver.hasWorkspaceResolution(dep)) {
        resolvedDepVersion = this.packageVersionResolver.getWorkspaceResolution(dep)!
      } else if (this.packageVersionResolver.hasLockFileVersion(dep)) {
        resolvedDepVersion = this.packageVersionResolver.getLockFileVersion(dep)!
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
    if (this.packageVersionResolver.hasWorkspaceResolution(dep)) {
      resolvedFrom = 'workspace package.json'
    } else if (this.packageVersionResolver.hasLockFileVersion(dep)) {
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
  if (explicitContext && this.dependencyStore.hasParent(explicitContext)) {
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
      if (pkg && this.dependencyStore.hasParent(pkg)) {
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
    for (const [parentPkg, deps] of this.dependencyStore.entries()) {
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

    // Determine parent context and deps (if any)
  const parentPackage = this.findParentPackageContext()
  const parentDeps = parentPackage ? this.dependencyStore.getParentPackageDeps(parentPackage) : undefined

    // Delegate to centralized resolver
    return await this.packageVersionResolver.resolveVersion(packageName, parentDeps, parentPackage || undefined)
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
  this.dependencyStore.storePackageDependencies(`${packageName}@${packageJson.version}`, packageJson)

      return { version: packageJson.version, source: 'package-json' }
    } catch (err) {
      this.log(`[ImportResolver] ⚠️  Failed to fetch package.json for ${packageName}:`, err)
      return { version: null, source: 'fetched' }
    }
  }

  /**
   * Extract and store dependencies from a package.json for future parent context resolution
   */
  // storePackageDependencies removed in favor of DependencyStore

  /**
   * Fetch and save package.json from GitHub repository (if it exists)
   * This provides metadata and dependency information for raw GitHub imports
   */
  private async fetchGitHubPackageJson(owner: string, repo: string, ref: string): Promise<void> {
    try {
      // Construct package.json URL for this GitHub repo
      const packageJsonUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/package.json`
      
      this.log(`[ImportResolver] 📦 Attempting to fetch GitHub package.json: ${packageJsonUrl}`)
      
      // Try to fetch package.json
  const content = await this.contentFetcher.resolve(packageJsonUrl)
      const packageJson = JSON.parse(content.content || content)
      
      if (packageJson && packageJson.name) {
        // Save package.json to normalized GitHub path
        const targetPath = `.deps/github/${owner}/${repo}@${ref}/package.json`
  await this.contentFetcher.setFile(targetPath, JSON.stringify(packageJson, null, 2))
        
        this.log(`[ImportResolver] ✅ Saved GitHub package.json to: ${targetPath}`)
        this.log(`[ImportResolver]    Package: ${packageJson.name}@${packageJson.version || 'unknown'}`)
        
        // Store dependencies for future reference
        if (packageJson.version) {
          const packageKey = `${owner}/${repo}@${ref}`
          this.dependencyStore.storePackageDependencies(packageKey, packageJson)
        }
      }
    } catch (err) {
      // Package.json doesn't exist or failed to fetch - this is not an error
      // Many GitHub repos don't have package.json at root
      this.log(`[ImportResolver] ℹ️  No package.json found for ${owner}/${repo}@${ref} (this is normal for non-npm repos)`)
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
      this.dependencyStore.setPackageSource(packageName, 'workspace')
    } else {
      this.packageSources.set(packageName, packageName)
      this.dependencyStore.setPackageSource(packageName, packageName)
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
  const content = await this.contentFetcher.resolve(packageJsonUrl)
      const packageJson = JSON.parse(content.content || content)

      // Always save package.json for visibility and debugging
      try {
        // Use the actual package name from package.json, not the potentially aliased packageName parameter
        const realPackageName = packageJson.name || packageName
        const targetPath = `.deps/npm/${realPackageName}@${resolvedVersion}/package.json`
          await this.contentFetcher.setFile(targetPath, JSON.stringify(packageJson, null, 2))
        this.log(`[ImportResolver] 💾 Saved package.json to: ${targetPath}`)
      } catch (saveErr) {
        this.log(`[ImportResolver] ⚠️  Failed to save package.json:`, saveErr)
      }

      // Store dependencies for future parent context resolution
  this.dependencyStore.storePackageDependencies(`${packageName}@${resolvedVersion}`, packageJson)

      // Check dependencies for conflicts
      await this.checkPackageDependencies(packageName, resolvedVersion, packageJson)
    } catch (err) {
      // Dependencies are optional, don't fail compilation
      this.log(`[ImportResolver] ℹ️  Could not check dependencies for ${packageName}`)
    }
  }

  public async resolveAndSave(url: string, targetPath?: string, skipResolverMappings = false): Promise<string> {
    const originalUrl = url
    
    // Validate that URL points to a .sol file (unless it's package.json)
    if (!url.endsWith('.sol') && !url.endsWith('package.json')) {
      this.log(`[ImportResolver] ❌ Invalid import: "${url}" does not end with .sol extension`)
      throw new Error(`Invalid import: "${url}" does not end with .sol extension`)
    }
    
    // If this is an external URL, handle normalizations (CDNs, GitHub, etc.)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      this.log(`[ImportResolver] 🌐 External URL detected: ${url}`)

      // GitHub blob → raw
      const blobToRaw = normalizeGithubBlobUrl(url)
      if (blobToRaw) {
        this.log(`[ImportResolver]   🔄 Converting GitHub blob URL to raw: ${blobToRaw}`)
        url = blobToRaw
      }

      // npm CDN → npm path
      const npmRewrite = rewriteNpmCdnUrl(url)
      if (npmRewrite) {
        this.log(`[ImportResolver]   🔄 CDN URL is serving npm package, normalizing:`)
        this.log(`[ImportResolver]      From: ${url}`)
        this.log(`[ImportResolver]      To:   ${npmRewrite.npmPath}`)
        if (!this.resolutions.has(originalUrl)) this.resolutions.set(originalUrl, npmRewrite.npmPath)
        return await this.resolveAndSave(npmRewrite.npmPath, targetPath, skipResolverMappings)
      }

      // raw.githubusercontent.com → normalized save path
      const ghRaw = normalizeRawGithubUrl(url)
      if (ghRaw) {
        this.log(`[ImportResolver]   🔄 Normalizing raw.githubusercontent.com URL:`)
        this.log(`[ImportResolver]      From: ${url}`)
        this.log(`[ImportResolver]      To:   ${ghRaw.normalizedPath}`)

        // Save optional package.json if available
        await this.fetchGitHubPackageJson(ghRaw.owner, ghRaw.repo, ghRaw.ref)

    const content = await this.contentFetcher.resolveAndSave(url, ghRaw.targetPath, false)
        this.log(`[ImportResolver]   ✅ Received content: ${content ? content.length : 0} chars`)
        if (!this.resolutions.has(originalUrl)) this.resolutions.set(originalUrl, ghRaw.normalizedPath)
        return content
      }
    }

    // Handle IPFS URLs: ipfs://QmHash/path or ipfs://ipfs/QmHash/path
    if (url.startsWith('ipfs://')) {
      this.log(`[ImportResolver] 🌐 IPFS URL detected: ${url}`)
      const ipfs = normalizeIpfsUrl(url)
      if (ipfs) {
        this.log(`[ImportResolver]   🔄 Normalizing IPFS URL:`)
        this.log(`[ImportResolver]      From: ${url}`)
        this.log(`[ImportResolver]      To:   ${ipfs.normalizedPath}`)
  const content = await this.contentFetcher.resolveAndSave(url, ipfs.targetPath, false)
        this.log(`[ImportResolver]   ✅ Received content: ${content ? content.length : 0} chars`)
        if (!this.resolutions.has(originalUrl)) this.resolutions.set(originalUrl, ipfs.normalizedPath)
        return content
      }
    }

    // Handle Swarm URLs: bzz-raw://hash/path or bzz://hash/path
    if (url.startsWith('bzz-raw://') || url.startsWith('bzz://')) {
      this.log(`[ImportResolver] 🌐 Swarm URL detected: ${url}`)
      const swarm = normalizeSwarmUrl(url)
      if (swarm) {
        this.log(`[ImportResolver]   🔄 Normalizing Swarm URL:`)
        this.log(`[ImportResolver]      From: ${url}`)
        this.log(`[ImportResolver]      To:   ${swarm.normalizedPath}`)
  const content = await this.contentFetcher.resolveAndSave(url, swarm.targetPath, false)
        this.log(`[ImportResolver]   ✅ Received content: ${content ? content.length : 0} chars`)
        if (!this.resolutions.has(originalUrl)) this.resolutions.set(originalUrl, swarm.normalizedPath)
        return content
      }
    }

    // For other external HTTP/HTTPS URLs (not npm CDN, not GitHub raw), fetch directly
    if (url.startsWith('http://') || url.startsWith('https://')) {
      this.log(`[ImportResolver]   ⬇️  Fetching directly from URL: ${url}`)
  const content = await this.contentFetcher.resolveAndSave(url, targetPath, true)
      
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
            if (!this.dependencyStore.hasParent(versionedPackageName)) {
              try {
                const packageJsonUrl = `${packageName}@${requestedVersion}/package.json`
                const content = await this.contentFetcher.resolve(packageJsonUrl)
                const packageJson = JSON.parse(content.content || content)

                const pkgJsonPath = `.deps/npm/${versionedPackageName}/package.json`
                await this.contentFetcher.setFile(pkgJsonPath, JSON.stringify(packageJson, null, 2))
                this.log(`[ImportResolver] 💾 Saved package.json to: ${pkgJsonPath}`)

                // Store dependencies for future parent context resolution
                this.dependencyStore.storePackageDependencies(versionedPackageName, packageJson)
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
              const content = await this.contentFetcher.resolve(packageJsonUrl)
              const packageJson = JSON.parse(content.content || content)

              const targetPath = `.deps/npm/${versionedPackageName}/package.json`
              await this.contentFetcher.setFile(targetPath, JSON.stringify(packageJson, null, 2))
              this.log(`[ImportResolver] 💾 Saved package.json to: ${targetPath}`)

              // Store dependencies for future parent context resolution
              this.dependencyStore.storePackageDependencies(versionedPackageName, packageJson)
            } catch (err) {
              this.log(`[ImportResolver] ⚠️  Failed to fetch/save package.json:`, err)
            }
          }
        }
      }
    }

    this.log(`[ImportResolver] 📥 Fetching: ${url}`)
  const content = await this.contentFetcher.resolveAndSave(url, targetPath, true)

    if (!skipResolverMappings || originalUrl === url) {
      if (!this.resolutions.has(originalUrl)) {
        this.resolutions.set(originalUrl, url)
      }
    }

    return content
  }

  public async saveResolutionsToIndex(): Promise<void> {
    this.log(`[ImportResolver] 💾 Saving ${this.resolutions.size} resolution(s) to index for: ${this.targetFile}`)

    // Lazily initialize the resolution index if needed
    if (!this.resolutionIndex) {
      this.resolutionIndex = new ResolutionIndex(this.pluginApi, this.debug)
    }
    // Ensure it's loaded
    if (!this.resolutionIndexInitialized) {
      await this.resolutionIndex.load()
      this.resolutionIndexInitialized = true
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
