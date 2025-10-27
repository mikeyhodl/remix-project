'use strict'

import { Plugin } from '@remixproject/engine'
import { ResolutionIndex } from './resolution-index'
import { IImportResolver } from './import-resolver-interface'
import { normalizeGithubBlobUrl, normalizeIpfsUrl, normalizeRawGithubUrl, normalizeSwarmUrl, rewriteNpmCdnUrl } from './utils/url-normalizer'
import { extractPackageName as parsePkgName, extractVersion as parseVersion, extractRelativePath as parseRelPath } from './utils/parser-utils'
import { routeUrl } from './utils/url-request-router'
import { isBreakingVersionConflict, isPotentialVersionConflict } from './utils/semver-utils'
import { PackageVersionResolver } from './utils/package-version-resolver'
import { Logger } from './utils/logger'
import { ContentFetcher } from './utils/content-fetcher'
import { DependencyStore } from './utils/dependency-store'
import { ConflictChecker } from './utils/conflict-checker'
import { PackageMapper } from './utils/package-mapper'
import type { IOAdapter } from './adapters/io-adapter'
import { RemixPluginAdapter } from './adapters/remix-plugin-adapter'
import { FileResolutionIndex } from './file-resolution-index'

/**
 * ImportResolver
 *
 * Orchestrates import resolution for Solidity and package.json files with adapterized I/O.
 * Responsibilities:
 * - Normalize and route external URLs (CDN, GitHub, IPFS, Swarm)
 * - Resolve npm package versions with precedence (workspace → parent deps → lockfile → npm)
 * - Map packages to isolated versioned namespaces and persist real package.json for transitive deps
 * - Fetch content and save to deterministic paths; record original → resolved mappings
 * - Persist mappings to a resolution index to power IDE features like Go-to-Definition
 */
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
  private packageMapper: PackageMapper

  private resolutionIndex: ResolutionIndex | null = null
  private resolutionIndexInitialized: boolean = false

  /**
   * Create a resolver for a given target file. The target file name scopes the resolution index.
   *
   * Inputs:
   * - pluginApi or io: Remix plugin API or Node IO adapter
   * - targetFile: the file whose imports are being resolved (used for index scoping)
   * - debug: when true, emits verbose logs to aid debugging
   */
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
    this.packageMapper = new PackageMapper(
      this.importMappings,
      this.packageSources,
      this.dependencyStore,
      this.packageVersionResolver,
      this.contentFetcher,
      this.logger,
      this.resolvePackageVersion.bind(this),
      this.conflictChecker
    )
    this.resolutionIndex = null
    this.resolutionIndexInitialized = false
  }

  private log(message: string, ...args: any[]): void { if (this.debug) console.log(message, ...args) }

  /**
   * Set the current package context for dependency-aware resolution.
   * Pass a versioned package (e.g., "@openzeppelin/contracts@4.9.6") to influence child resolves.
   */
  public setPackageContext(context: string | null): void {
    if (context) this.importMappings.set('__CONTEXT__', context)
    else this.importMappings.delete('__CONTEXT__')
  }

  /** Log current package and import mappings for this resolver's session. */
  public logMappings(): void {
    this.log(`[ImportResolver] 📊 Current import mappings for: "${this.targetFile}"`)
    if (this.importMappings.size === 0) this.log(`[ImportResolver] ℹ️  No mappings defined`)
    else this.importMappings.forEach((value, key) => this.log(`[ImportResolver]   ${key} → ${value}`))
  }

  // parsing helpers are provided by utils/parser-utils for clarity

  private isPotentialVersionConflict(requestedRange: string, resolvedVersion: string): boolean {
    return isPotentialVersionConflict(requestedRange, resolvedVersion)
  }

  private isBreakingVersionConflict(requestedRange: string, resolvedVersion: string): boolean {
    return isBreakingVersionConflict(requestedRange, resolvedVersion)
  }

  private async checkPackageDependencies(packageName: string, resolvedVersion: string, packageJson: any): Promise<void> {
    await this.conflictChecker.checkPackageDependencies(packageName, resolvedVersion, packageJson)
  }

  // Removed an unused checkDependencyConflict method; conflict detection lives in ConflictChecker

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

  // Package mapping/version logic moved to PackageMapper

  /**
   * Resolve an import and save its content to a deterministic path.
   *
   * Inputs:
   * - url: original import (npm path, CDN URL, GitHub URL, ipfs://, etc.)
   * - targetPath: optional override for where to save the content
   * - skipResolverMappings: internal flag to avoid infinite remap recursion
   *
   * Output: string content of the fetched file (throws on invalid import types)
   */
  public async resolveAndSave(url: string, targetPath?: string, skipResolverMappings = false): Promise<string> {
    const originalUrl = url
    if (!url.endsWith('.sol') && !url.endsWith('package.json')) {
      this.log(`[ImportResolver] ❌ Invalid import: "${url}" does not end with .sol extension`)
      throw new Error(`Invalid import: "${url}" does not end with .sol extension`)
    }
    // Delegate URL handling and normalization to the router
    const routed = await routeUrl(originalUrl, url, targetPath, {
      contentFetcher: this.contentFetcher,
      logger: this.logger,
      resolutions: this.resolutions,
      fetchGitHubPackageJson: this.fetchGitHubPackageJson.bind(this)
    })
    if (routed.action === 'content') return routed.content
    if (routed.action === 'rewrite') url = routed.url

    // Ensure workspace resolutions (including npm alias keys) are loaded before extracting package names
    try { await this.packageVersionResolver.loadWorkspaceResolutions() } catch {}

    let finalUrl = url
    const packageName = parsePkgName(url, this.packageVersionResolver.getWorkspaceResolutions())
    if (!skipResolverMappings && packageName) {
      const hasVersion = url.includes(`${packageName}@`)
      if (!hasVersion) {
        const mappingKey = `__PKG__${packageName}`
        if (!this.importMappings.has(mappingKey)) {
          this.log(`[ImportResolver] 🔍 First import from ${packageName}, resolving version...`)
          await this.packageMapper.fetchAndMapPackage(packageName)
        }
        if (this.importMappings.has(mappingKey)) {
          const versionedPackageName = this.importMappings.get(mappingKey)!
          const mappedUrl = url.replace(packageName, versionedPackageName)
          this.log(`[ImportResolver] 🔀 Mapped: ${packageName} → ${versionedPackageName}`)
          finalUrl = mappedUrl
          if (!this.resolutions.has(originalUrl)) this.resolutions.set(originalUrl, finalUrl)
          return this.resolveAndSave(mappedUrl, targetPath, true)
        } else {
          this.log(`[ImportResolver] ⚠️  No mapping available for ${mappingKey}`)
        }
      } else {
        const requestedVersion = parseVersion(url)
        const mappingKey = `__PKG__${packageName}`
        if (this.importMappings.has(mappingKey)) {
          const versionedPackageName = this.importMappings.get(mappingKey)!
          const resolvedVersion = parseVersion(versionedPackageName)!
          if (requestedVersion && resolvedVersion && requestedVersion !== resolvedVersion) {
            const relativePath = parseRelPath(url, packageName)
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
            if (!this.resolutions.has(originalUrl)) this.resolutions.set(originalUrl, finalUrl)
            return this.resolveAndSave(url, targetPath, true)
          } else if (requestedVersion && resolvedVersion && requestedVersion === resolvedVersion) {
            const mappedUrl = url.replace(`${packageName}@${requestedVersion}`, versionedPackageName)
            if (mappedUrl !== url) {
              finalUrl = mappedUrl
              if (!this.resolutions.has(originalUrl)) this.resolutions.set(originalUrl, finalUrl)
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

  /** Persist the original → resolved mappings for this target file into the resolution index. */
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

  /** Return the target file this resolver is associated with. */
  public getTargetFile(): string { return this.targetFile }
  /** Lookup an original import and return its resolved path, if recorded in this session. */
  public getResolution(originalImport: string): string | null { return this.resolutions.get(originalImport) || null }
}
