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
import { WarningSystem } from './utils/warning-system'
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
  // Cache to avoid refetching the same GitHub package.json multiple times per session
  private fetchedGitHubPackages: Set<string> = new Set()
  private warnings: WarningSystem

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
    this.fetchedGitHubPackages = new Set()
  this.warnings = new WarningSystem(this.logger)
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

  /** Ensure the dependency graph for a versioned package context is loaded from its package.json. */
  public async ensurePackageContextLoaded(context: string): Promise<void> {
    try {
      if (!context) return
      if (this.dependencyStore.hasParent(context)) return
      const m = context.match(/^(@?[^@]+)@(.+)$/)
      if (!m) return
      const packageName = m[1]
      const version = m[2]
      const packageJsonUrl = `${packageName}@${version}/package.json`
      const content = await this.contentFetcher.resolve(packageJsonUrl)
      const packageJson = JSON.parse(content.content || content)
      const pkgJsonPath = `.deps/npm/${packageName}@${version}/package.json`
      await this.contentFetcher.setFile(pkgJsonPath, JSON.stringify(packageJson, null, 2))
      this.log(`[ImportResolver] 💾 Loaded context package.json → ${pkgJsonPath}`)
      this.dependencyStore.storePackageDependencies(context, packageJson)
    } catch (err) {
      this.log(`[ImportResolver] ℹ️  Could not load package.json for context ${context}:`, err)
    }
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
          this.warnings.emitMultiParentConflictWarn(packageName, conflictingParents)
        }
      }
    }
  }

  /**
   * Ensure a versioned npm package has its real package.json fetched and saved under .deps.
   * Idempotent: skips if already captured in the dependency store.
   */
  private async ensurePackageJsonSaved(versionedPackageName: string): Promise<void> {
    if (this.dependencyStore.hasParent(versionedPackageName)) return
    try {
      const packageJsonUrl = `${versionedPackageName}/package.json`
      const content = await this.contentFetcher.resolve(packageJsonUrl)
      const packageJson = JSON.parse((content as any).content || (content as any))
      const pkgJsonPath = `.deps/npm/${versionedPackageName}/package.json`
      await this.contentFetcher.setFile(pkgJsonPath, JSON.stringify(packageJson, null, 2))
      this.log(`[ImportResolver] 💾 Saved package.json to: ${pkgJsonPath}`)
      this.dependencyStore.storePackageDependencies(versionedPackageName, packageJson)
    } catch (err) {
      this.log(`[ImportResolver] ⚠️  Failed to fetch/save package.json:`, err)
    }
  }

  /**
   * Handle an unversioned npm import by mapping it to the isolated versioned namespace and recursing.
   * Returns string content if it performed a remap (early return path), otherwise null to continue.
   */
  private async mapUnversionedImport(
    url: string,
    packageName: string,
    originalUrl: string,
    targetPath?: string
  ): Promise<string | null> {
    const mappingKey = `__PKG__${packageName}`
    if (!this.importMappings.has(mappingKey)) {
      this.log(`[ImportResolver] 🔍 First import from ${packageName}, resolving version...`)
      await this.packageMapper.fetchAndMapPackage(packageName)
    }
    if (this.importMappings.has(mappingKey)) {
      const versionedPackageName = this.importMappings.get(mappingKey)!
      const mappedUrl = url.replace(packageName, versionedPackageName)
      this.log(`[ImportResolver] 🔀 Mapped: ${packageName} → ${versionedPackageName}`)
      if (!this.resolutions.has(originalUrl)) this.resolutions.set(originalUrl, mappedUrl)
      return this.resolveAndSave(mappedUrl, targetPath, true)
    } else {
      this.log(`[ImportResolver] ⚠️  No mapping available for __PKG__${packageName}`)
      return null
    }
  }

  /**
   * For explicit versioned imports where a workspace/global mapping exists, reconcile versions and recurse if needed.
   * Returns string content if it performed a remap (early return path), otherwise null to continue.
   */
  private async handleExplicitVersionWithMapping(
    url: string,
    packageName: string,
    requestedVersion: string,
    mappedVersionedPackageName: string,
    originalUrl: string,
    targetPath?: string
  ): Promise<string | null> {
    const resolvedVersion = parseVersion(mappedVersionedPackageName)!
    if (requestedVersion && resolvedVersion && requestedVersion !== resolvedVersion) {
      // Detect and warn on duplicate file across versions, and track the chosen version per file
      const relativePath = parseRelPath(url, packageName)
      const fileKey = relativePath ? `${packageName}/${relativePath}` : null
      const previousVersion = fileKey ? this.importedFiles.get(fileKey) : null
      if (previousVersion && previousVersion !== requestedVersion) {
        const conflictKey = `${fileKey}:${previousVersion}↔${requestedVersion}`
        if (!this.conflictWarnings.has(conflictKey)) {
          this.conflictWarnings.add(conflictKey)
          await this.warnings.emitDuplicateFileError({
            packageName,
            relativePath,
            previousVersion,
            requestedVersion
          })
        }
      }
      if (fileKey) {
        this.importedFiles.set(fileKey, requestedVersion)
        this.log(`[ImportResolver] 📝 Tracking: ${fileKey} @ ${requestedVersion}`)
      }
      this.log(`[ImportResolver] ✅ Explicit version: ${packageName}@${requestedVersion}`)
      const versionedPackageName = `${packageName}@${requestedVersion}`
      await this.ensurePackageJsonSaved(versionedPackageName)
      if (!this.resolutions.has(originalUrl)) this.resolutions.set(originalUrl, url)
      return this.resolveAndSave(url, targetPath, true)
    } else if (requestedVersion && resolvedVersion && requestedVersion === resolvedVersion) {
      // Normalize any import to the canonical mapped namespace if different in string form
      const mappedUrl = url.replace(`${packageName}@${requestedVersion}`, mappedVersionedPackageName)
      if (mappedUrl !== url) {
        if (!this.resolutions.has(originalUrl)) this.resolutions.set(originalUrl, mappedUrl)
        return this.resolveAndSave(mappedUrl, targetPath, true)
      }
    }
    return null
  }

  private async resolvePackageVersion(packageName: string): Promise<{ version: string | null, source: string }> {
    this.log(`[ImportResolver] 🔍 Resolving version for: ${packageName}`)
    this.checkForConflictingParentDependencies(packageName)
    const parentPackage = this.findParentPackageContext()
    const parentDeps = parentPackage ? this.dependencyStore.getParentPackageDeps(parentPackage) : undefined
    return await this.packageVersionResolver.resolveVersion(packageName, parentDeps, parentPackage || undefined)
  }

  private async fetchGitHubPackageJson(owner: string, repo: string, ref: string): Promise<void> {
    try {
      const key = `${owner}/${repo}@${ref}`
      const targetPath = `.deps/github/${owner}/${repo}@${ref}/package.json`

      // Skip if we already processed this repo/ref in this session
      if (this.fetchedGitHubPackages.has(key)) {
        this.log(`[ImportResolver] 📦 Skipping GitHub package.json fetch (cached): ${key}`)
        return
      }

      // If file already exists on disk, don't refetch; load into store once
      if (await this.contentFetcher.exists(targetPath)) {
        this.fetchedGitHubPackages.add(key)
        try {
          if (!this.dependencyStore.hasParent(key)) {
            const existing = await this.contentFetcher.readFile(targetPath)
            const pkg = JSON.parse(existing)
            if (pkg && pkg.name) this.dependencyStore.storePackageDependencies(key, pkg)
          }
        } catch {}
        this.log(`[ImportResolver] 📦 GitHub package.json already present: ${targetPath}`)
        return
      }

      const packageJsonUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/package.json`
      this.log(`[ImportResolver] 📦 Attempting to fetch GitHub package.json: ${packageJsonUrl}`)
      const content = await this.contentFetcher.resolve(packageJsonUrl)
      const packageJson = JSON.parse(content.content || content)
      if (packageJson && packageJson.name) {
        await this.contentFetcher.setFile(targetPath, JSON.stringify(packageJson, null, 2))
        this.fetchedGitHubPackages.add(key)
        this.log(`[ImportResolver] ✅ Saved GitHub package.json to: ${targetPath}`)
        this.log(`[ImportResolver]    Package: ${packageJson.name}@${packageJson.version || 'unknown'}`)
        if (packageJson.version) {
          this.dependencyStore.storePackageDependencies(key, packageJson)
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

    const packageName = parsePkgName(url, this.packageVersionResolver.getWorkspaceResolutions())
    if (!skipResolverMappings && packageName) {
      const hasVersion = url.includes(`${packageName}@`)
      if (!hasVersion) {
        const res = await this.mapUnversionedImport(url, packageName, originalUrl, targetPath)
        if (typeof res === 'string') return res
      } else {
        const requestedVersion = parseVersion(url)
        const mappingKey = `__PKG__${packageName}`
        if (this.importMappings.has(mappingKey) && requestedVersion) {
          const versionedPackageName = this.importMappings.get(mappingKey)!
          const res = await this.handleExplicitVersionWithMapping(
            url,
            packageName,
            requestedVersion,
            versionedPackageName,
            originalUrl,
            targetPath
          )
          if (typeof res === 'string') return res
        } else if (requestedVersion) {
          const versionedPackageName = `${packageName}@${requestedVersion}`
          this.importMappings.set(mappingKey, versionedPackageName)
          await this.ensurePackageJsonSaved(versionedPackageName)
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
