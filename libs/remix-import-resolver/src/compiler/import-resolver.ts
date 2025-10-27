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
import type { IOAdapter } from './adapters/io-adapter'
import { RemixPluginAdapter } from './adapters/remix-plugin-adapter'
import { FileResolutionIndex } from './file-resolution-index'

export class ImportResolver implements IImportResolver {
  private importMappings: Map<string, string>
  private pluginApi: Plugin | null
  private targetFile: string
  private resolutions: Map<string, string> = new Map()
  private packageVersionResolver: PackageVersionResolver
  private contentFetcher: ContentFetcher
  private dependencyStore: DependencyStore
  private logger: Logger
  private conflictChecker: ConflictChecker
  private io: IOAdapter
  private conflictWarnings: Set<string> = new Set()
  private importedFiles: Map<string, string> = new Map()
  private packageSources: Map<string, string> = new Map()
  private debug: boolean = false

  private resolutionIndex: ResolutionIndex | null = null
  private resolutionIndexInitialized: boolean = false

  constructor(pluginApi: Plugin, targetFile: string, debug?: boolean)
  constructor(io: IOAdapter, targetFile: string, debug?: boolean)
  constructor(pluginOrIo: Plugin | IOAdapter, targetFile: string, debug: boolean = false) {
    const isPlugin = typeof (pluginOrIo as any)?.call === 'function'
    this.pluginApi = isPlugin ? (pluginOrIo as Plugin) : null
    this.targetFile = targetFile
    this.debug = debug
    this.importMappings = new Map()
    this.resolutions = new Map()
    this.conflictWarnings = new Set()
    this.importedFiles = new Map()
    this.packageSources = new Map()
    this.io = isPlugin ? new RemixPluginAdapter(this.pluginApi as Plugin) : (pluginOrIo as IOAdapter)
    this.packageVersionResolver = new PackageVersionResolver(this.io, debug)
    this.logger = new Logger(this.pluginApi || undefined, debug)
    this.contentFetcher = new ContentFetcher(this.io, debug)
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

  private log(message: string, ...args: any[]): void { if (this.debug) console.log(message, ...args) }

  public setPackageContext(context: string | null): void {
    if (context) this.importMappings.set('__CONTEXT__', context)
    else this.importMappings.delete('__CONTEXT__')
  }

  public logMappings(): void {
    this.log(`[ImportResolver] 📊 Current import mappings for: "${this.targetFile}"`)
    if (this.importMappings.size === 0) this.log(`[ImportResolver] ℹ️  No mappings defined`)
    else this.importMappings.forEach((value, key) => this.log(`[ImportResolver]   ${key} → ${value}`))
  }

  private extractPackageName(url: string): string | null {
    // Prefer known workspace resolution keys (supports npm alias keys like "@module_remapping")
    if (url.startsWith('@')) {
      const resolutions = this.packageVersionResolver.getWorkspaceResolutions()
      if (resolutions && resolutions.size > 0) {
        // Find the longest key that is a prefix of the url (followed by "/" or end)
        const keys = Array.from(resolutions.keys())
        // Sort by length desc to prefer the most specific match
        keys.sort((a, b) => b.length - a.length)
        for (const key of keys) {
          if (url === key || url.startsWith(`${key}/`) || url.startsWith(`${key}@`)) {
            return key
          }
        }
      }
    }
    const scopedMatch = url.match(/^(@[^/]+\/[^/@]+)/)
    if (scopedMatch) return scopedMatch[1]
    const regularMatch = url.match(/^([^/@]+)/)
    if (regularMatch) return regularMatch[1]
    return null
  }

  private extractVersion(url: string): string | null {
    const match = url.match(/@(\d+(?:\.\d+)?(?:\.\d+)?[^\s\/]*)/)
    return match ? match[1] : null
  }

  private extractRelativePath(url: string, packageName: string): string | null {
    const versionedPattern = new RegExp(`^${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}@[^/]+/(.+)$`)
    const versionedMatch = url.match(versionedPattern)
    if (versionedMatch) return versionedMatch[1]
    const unversionedPattern = new RegExp(`^${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(.+)$`)
    const unversionedMatch = url.match(unversionedPattern)
    if (unversionedMatch) return unversionedMatch[1]
    return null
  }

  private isPotentialVersionConflict(requestedRange: string, resolvedVersion: string): boolean {
    return isPotentialVersionConflict(requestedRange, resolvedVersion)
  }

  private isBreakingVersionConflict(requestedRange: string, resolvedVersion: string): boolean {
    return isBreakingVersionConflict(requestedRange, resolvedVersion)
  }

  private async checkPackageDependencies(packageName: string, resolvedVersion: string, packageJson: any): Promise<void> {
    await this.conflictChecker.checkPackageDependencies(packageName, resolvedVersion, packageJson)
  }

  private async checkDependencyConflict(
    packageName: string,
    packageVersion: string,
    dep: string,
    requestedRange: string,
    peerDependencies: any
  ): Promise<void> {
    const isPeerDep = peerDependencies && dep in peerDependencies
    const depMappingKey = `__PKG__${dep}`
    let resolvedDepVersion: string | null = null

    if (this.importMappings.has(depMappingKey)) {
      const resolvedDepPackage = this.importMappings.get(depMappingKey)
      resolvedDepVersion = this.extractVersion(resolvedDepPackage!)
    } else if (isPeerDep) {
      if (this.packageVersionResolver.hasWorkspaceResolution(dep)) resolvedDepVersion = this.packageVersionResolver.getWorkspaceResolution(dep)!
      else if (this.packageVersionResolver.hasLockFileVersion(dep)) resolvedDepVersion = this.packageVersionResolver.getLockFileVersion(dep)!
    } else {
      return
    }

    if (!resolvedDepVersion || typeof requestedRange !== 'string') return

    const conflictKey = `${isPeerDep ? 'peer' : 'dep'}:${packageName}→${dep}:${requestedRange}→${resolvedDepVersion}`
    if (this.conflictWarnings.has(conflictKey) || !this.isPotentialVersionConflict(requestedRange, resolvedDepVersion)) return
    this.conflictWarnings.add(conflictKey)

    let resolvedFrom = 'npm registry'
    const sourcePackage = this.packageSources.get(dep)
    if (this.packageVersionResolver.hasWorkspaceResolution(dep)) resolvedFrom = 'workspace package.json'
    else if (this.packageVersionResolver.hasLockFileVersion(dep)) resolvedFrom = 'lock file'
    else if (sourcePackage && sourcePackage !== dep && sourcePackage !== 'workspace') resolvedFrom = `${sourcePackage}/package.json`

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

    await this.logger.terminal(severity as any, warningMsg)
  }

  private findParentPackageContext(): string | null {
    const explicitContext = this.importMappings.get('__CONTEXT__')
    if (explicitContext && this.dependencyStore.hasParent(explicitContext)) {
      this.log(`[ImportResolver]    📍 Using explicit context: ${explicitContext}`)
      return explicitContext
    }
    const mappedPackages = Array.from(this.importMappings.values())
      .filter(v => v !== explicitContext && v.includes('@'))
      .map(v => { const match = v.match(/^(@?[^@]+)@(.+)$/); return match ? `${match[1]}@${match[2]}` : null })
      .filter(Boolean) as string[]
    for (let i = mappedPackages.length - 1; i >= 0; i--) {
      const pkg = mappedPackages[i]
      if (pkg && this.dependencyStore.hasParent(pkg)) return pkg
    }
    return null
  }

  private checkForConflictingParentDependencies(packageName: string): void {
    const conflictingParents: Array<{ parent: string, version: string }> = []
    for (const [parentPkg, deps] of this.dependencyStore.entries()) {
      if (deps.has(packageName)) {
        conflictingParents.push({ parent: parentPkg, version: deps.get(packageName)! })
      }
    }
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
          this.logger.terminal('warn', warningMsg)
        }
      }
    }
  }

  private async resolvePackageVersion(packageName: string): Promise<{ version: string | null, source: string }> {
    this.log(`[ImportResolver] 🔍 Resolving version for: ${packageName}`)
    this.checkForConflictingParentDependencies(packageName)
    const parentPackage = this.findParentPackageContext()
    const parentDeps = parentPackage ? this.dependencyStore.getParentPackageDeps(parentPackage) : undefined
    return await this.packageVersionResolver.resolveVersion(packageName, parentDeps, parentPackage || undefined)
  }

  private async fetchPackageVersionFromNpm(packageName: string): Promise<{ version: string | null, source: string }> {
    try {
      this.log(`[ImportResolver] 📦 Fetching package.json for: ${packageName}`)
      const packageJsonUrl = `${packageName}/package.json`
      const content = await (this.pluginApi as any).call('contentImport', 'resolve', packageJsonUrl)
      const packageJson = JSON.parse(content.content || content)
      if (!packageJson.version) return { version: null, source: 'fetched' }
      const realPackageName = packageJson.name || packageName
      try {
        const targetPath = `.deps/npm/${realPackageName}@${packageJson.version}/package.json`
        await (this.pluginApi as any).call('fileManager', 'setFile', targetPath, JSON.stringify(packageJson, null, 2))
        this.log(`[ImportResolver] 💾 Saved package.json to: ${targetPath}`)
      } catch (saveErr) { this.log(`[ImportResolver] ⚠️  Failed to save package.json:`, saveErr) }
      this.dependencyStore.storePackageDependencies(`${packageName}@${packageJson.version}`, packageJson)
      return { version: packageJson.version, source: 'package-json' }
    } catch (err) {
      this.log(`[ImportResolver] ⚠️  Failed to fetch package.json for ${packageName}:`, err)
      return { version: null, source: 'fetched' }
    }
  }

  private async fetchGitHubPackageJson(owner: string, repo: string, ref: string): Promise<void> {
    try {
      const packageJsonUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/package.json`
      this.log(`[ImportResolver] 📦 Attempting to fetch GitHub package.json: ${packageJsonUrl}`)
      const content = await this.contentFetcher.resolve(packageJsonUrl)
      const packageJson = JSON.parse(content.content || content)
      if (packageJson && packageJson.name) {
        const targetPath = `.deps/github/${owner}/${repo}@${ref}/package.json`
        await this.contentFetcher.setFile(targetPath, JSON.stringify(packageJson, null, 2))
        this.log(`[ImportResolver] ✅ Saved GitHub package.json to: ${targetPath}`)
        this.log(`[ImportResolver]    Package: ${packageJson.name}@${packageJson.version || 'unknown'}`)
        if (packageJson.version) {
          const packageKey = `${owner}/${repo}@${ref}`
          this.dependencyStore.storePackageDependencies(packageKey, packageJson)
        }
      }
    } catch (err) {
      this.log(`[ImportResolver] ℹ️  No package.json found for ${owner}/${repo}@${ref} (this is normal for non-npm repos)`)
    }
  }

  private async fetchAndMapPackage(packageName: string): Promise<void> {
    const mappingKey = `__PKG__${packageName}`
    if (this.importMappings.has(mappingKey)) return
  const { version: resolvedVersion, source } = await this.resolvePackageVersion(packageName)
    if (!resolvedVersion) return
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
    if (source === 'workspace-resolution' || source === 'lock-file') {
      this.packageSources.set(packageName, 'workspace')
      this.dependencyStore.setPackageSource(packageName, 'workspace')
    } else {
      this.packageSources.set(packageName, packageName)
      this.dependencyStore.setPackageSource(packageName, packageName)
    }
    this.log(`[ImportResolver] ✅ Mapped ${packageName} → ${versionedPackageName} (source: ${source})`)
  // When resolving via npm alias (e.g. "@module_remapping": "npm:@openzeppelin/contracts@4.9.0"),
  // ensure we fetch and save the REAL package's package.json, not the alias name.
  await this.checkPackageDependenciesIfNeeded(actualPackageName, resolvedVersion, source)
    this.log(`[ImportResolver] 📊 Total isolated mappings: ${this.importMappings.size}`)
  }

  private async checkPackageDependenciesIfNeeded(packageName: string, resolvedVersion: string, source: string): Promise<void> {
    try {
      const packageJsonUrl = `${packageName}/package.json`
      const content = await this.contentFetcher.resolve(packageJsonUrl)
      const packageJson = JSON.parse(content.content || content)
      try {
        const realPackageName = packageJson.name || packageName
        const targetPath = `.deps/npm/${realPackageName}@${resolvedVersion}/package.json`
        await this.contentFetcher.setFile(targetPath, JSON.stringify(packageJson, null, 2))
        this.log(`[ImportResolver] 💾 Saved package.json to: ${targetPath}`)
      } catch (saveErr) { this.log(`[ImportResolver] ⚠️  Failed to save package.json:`, saveErr) }
      this.dependencyStore.storePackageDependencies(`${packageName}@${resolvedVersion}`, packageJson)
      await this.checkPackageDependencies(packageName, resolvedVersion, packageJson)
    } catch (err) {
      this.log(`[ImportResolver] ℹ️  Could not check dependencies for ${packageName}`)
    }
  }

  public async resolveAndSave(url: string, targetPath?: string, skipResolverMappings = false): Promise<string> {
    const originalUrl = url
    if (!url.endsWith('.sol') && !url.endsWith('package.json')) {
      this.log(`[ImportResolver] ❌ Invalid import: "${url}" does not end with .sol extension`)
      throw new Error(`Invalid import: "${url}" does not end with .sol extension`)
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      this.log(`[ImportResolver] 🌐 External URL detected: ${url}`)
      const blobToRaw = normalizeGithubBlobUrl(url)
      if (blobToRaw) {
        this.log(`[ImportResolver]   🔄 Converting GitHub blob URL to raw: ${blobToRaw}`)
        url = blobToRaw
      }
      const npmRewrite = rewriteNpmCdnUrl(url)
      if (npmRewrite) {
        this.log(`[ImportResolver]   🔄 CDN URL is serving npm package, normalizing:`)
        this.log(`[ImportResolver]      From: ${url}`)
        this.log(`[ImportResolver]      To:   ${npmRewrite.npmPath}`)
        if (!this.resolutions.has(originalUrl)) this.resolutions.set(originalUrl, npmRewrite.npmPath)
        return await this.resolveAndSave(npmRewrite.npmPath, targetPath, skipResolverMappings)
      }
      const ghRaw = normalizeRawGithubUrl(url)
      if (ghRaw) {
        this.log(`[ImportResolver]   🔄 Normalizing raw.githubusercontent.com URL:`)
        this.log(`[ImportResolver]      From: ${url}`)
        this.log(`[ImportResolver]      To:   ${ghRaw.normalizedPath}`)
        await this.fetchGitHubPackageJson(ghRaw.owner, ghRaw.repo, ghRaw.ref)
        const content = await this.contentFetcher.resolveAndSave(url, ghRaw.targetPath, false)
        this.log(`[ImportResolver]   ✅ Received content: ${content ? content.length : 0} chars`)
        if (!this.resolutions.has(originalUrl)) this.resolutions.set(originalUrl, ghRaw.normalizedPath)
        return content
      }
    }

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

    if (url.startsWith('http://') || url.startsWith('https://')) {
      this.log(`[ImportResolver]   ⬇️  Fetching directly from URL: ${url}`)
      const content = await this.contentFetcher.resolveAndSave(url, targetPath, true)
      this.log(`[ImportResolver]   ✅ Received content: ${content ? content.length : 0} chars`)
      if (!content) this.log(`[ImportResolver]   ⚠️  WARNING: Empty content returned from contentImport`)
      else if (content.length < 200) this.log(`[ImportResolver]   ⚠️  WARNING: Suspiciously short content: "${content.substring(0, 100)}"`)
      if (!this.resolutions.has(originalUrl)) this.resolutions.set(originalUrl, url)
      return content
    }

    if (url.startsWith('npm:')) {
      this.log(`[ImportResolver] 🔗 Detected npm: alias in URL, normalizing: ${url}`)
      url = url.substring(4)
    }

    // Ensure workspace resolutions (including npm alias keys) are loaded before extracting package names
    try { await this.packageVersionResolver.loadWorkspaceResolutions() } catch {}

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
          const versionedPackageName = this.importMappings.get(mappingKey)!
          const mappedUrl = url.replace(packageName, versionedPackageName)
          this.log(`[ImportResolver] 🔀 Mapped: ${packageName} → ${versionedPackageName}`)
          finalUrl = mappedUrl
          this.resolutions.set(originalUrl, finalUrl)
          return this.resolveAndSave(mappedUrl, targetPath, true)
        } else {
          this.log(`[ImportResolver] ⚠️  No mapping available for ${mappingKey}`)
        }
      } else {
        const requestedVersion = this.extractVersion(url)
        const mappingKey = `__PKG__${packageName}`
        if (this.importMappings.has(mappingKey)) {
          const versionedPackageName = this.importMappings.get(mappingKey)!
          const resolvedVersion = this.extractVersion(versionedPackageName)!
          if (requestedVersion && resolvedVersion && requestedVersion !== resolvedVersion) {
            const relativePath = this.extractRelativePath(url, packageName)
            const fileKey = relativePath ? `${packageName}/${relativePath}` : null
            const previousVersion = fileKey ? this.importedFiles.get(fileKey) : null
            if (previousVersion && previousVersion !== requestedVersion) {
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
                await this.logger.terminal('error', warningMsg)
              }
            }
            if (fileKey) {
              this.importedFiles.set(fileKey, requestedVersion!)
              this.log(`[ImportResolver] 📝 Tracking: ${fileKey} @ ${requestedVersion}`)
            }
            this.log(`[ImportResolver] ✅ Explicit version: ${packageName}@${requestedVersion}`)
            const versionedPackageName = `${packageName}@${requestedVersion}`
            if (!this.dependencyStore.hasParent(versionedPackageName)) {
              try {
                const packageJsonUrl = `${packageName}@${requestedVersion}/package.json`
                const content = await this.contentFetcher.resolve(packageJsonUrl)
                const packageJson = JSON.parse(content.content || content)
                const pkgJsonPath = `.deps/npm/${versionedPackageName}/package.json`
                await this.contentFetcher.setFile(pkgJsonPath, JSON.stringify(packageJson, null, 2))
                this.log(`[ImportResolver] 💾 Saved package.json to: ${pkgJsonPath}`)
                this.dependencyStore.storePackageDependencies(versionedPackageName, packageJson)
              } catch (err) { this.log(`[ImportResolver] ⚠️  Failed to fetch/save package.json:`, err) }
            }
            finalUrl = url
            this.resolutions.set(originalUrl, finalUrl)
            return this.resolveAndSave(url, targetPath, true)
          } else if (requestedVersion && resolvedVersion && requestedVersion === resolvedVersion) {
            const mappedUrl = url.replace(`${packageName}@${requestedVersion}`, versionedPackageName)
            if (mappedUrl !== url) {
              finalUrl = mappedUrl
              this.resolutions.set(originalUrl, finalUrl)
              return this.resolveAndSave(mappedUrl, targetPath, true)
            }
          }
        } else {
          if (requestedVersion) {
            const versionedPackageName = `${packageName}@${requestedVersion}`
            this.importMappings.set(mappingKey, versionedPackageName)
            try {
              const packageJsonUrl = `${packageName}@${requestedVersion}/package.json`
              const content = await this.contentFetcher.resolve(packageJsonUrl)
              const packageJson = JSON.parse(content.content || content)
              const targetPath = `.deps/npm/${versionedPackageName}/package.json`
              await this.contentFetcher.setFile(targetPath, JSON.stringify(packageJson, null, 2))
              this.log(`[ImportResolver] 💾 Saved package.json to: ${targetPath}`)
              this.dependencyStore.storePackageDependencies(versionedPackageName, packageJson)
            } catch (err) { this.log(`[ImportResolver] ⚠️  Failed to fetch/save package.json:`, err) }
          }
        }
      }
    }

    this.log(`[ImportResolver] 📥 Fetching: ${url}`)
    const content = await this.contentFetcher.resolveAndSave(url, targetPath, true)
    if (!skipResolverMappings || originalUrl === url) {
      if (!this.resolutions.has(originalUrl)) this.resolutions.set(originalUrl, url)
    }
    return content
  }

  public async saveResolutionsToIndex(): Promise<void> {
    this.log(`[ImportResolver] 💾 Saving ${this.resolutions.size} resolution(s) to index for: ${this.targetFile}`)
    if (!this.resolutionIndex) {
      this.resolutionIndex = this.pluginApi
        ? new ResolutionIndex(this.pluginApi, this.debug)
        : (new FileResolutionIndex(this.io, this.debug) as unknown as ResolutionIndex)
    }
    if (!this.resolutionIndexInitialized) { await this.resolutionIndex.load(); this.resolutionIndexInitialized = true }
    this.resolutionIndex.clearFileResolutions(this.targetFile)
    this.resolutions.forEach((resolvedPath, originalImport) => { this.resolutionIndex!.recordResolution(this.targetFile, originalImport, resolvedPath) })
    await this.resolutionIndex.save()
  }

  public getTargetFile(): string { return this.targetFile }
  public getResolution(originalImport: string): string | null { return this.resolutions.get(originalImport) || null }
}
