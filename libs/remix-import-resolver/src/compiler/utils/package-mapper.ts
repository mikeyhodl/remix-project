'use strict'

import { Logger } from './logger'
import { ContentFetcher } from './content-fetcher'
import { DependencyStore } from './dependency-store'
import { PackageVersionResolver } from './package-version-resolver'
import { ConflictChecker } from './conflict-checker'

/**
 * Dependencies required by PackageMapper.
 * Consolidates the 8 constructor parameters into a single typed object.
 */
export interface PackageMapperDeps {
  /** Map of import mapping keys to resolved versioned package names */
  importMappings: Map<string, string>
  /** Map of package names to their resolution source */
  packageSources: Map<string, string>
  /** Store for package dependencies */
  dependencyStore: DependencyStore
  /** Resolver for package versions */
  packageVersionResolver: PackageVersionResolver
  /** Fetcher for remote content */
  contentFetcher: ContentFetcher
  /** Logger instance */
  logger: Logger
  /** Function to resolve a package's version */
  resolvePackageVersion: (packageName: string) => Promise<{ version: string | null, source: string }>
  /** Checker for dependency conflicts */
  conflictChecker: ConflictChecker
}

/**
 * PackageMapper
 *
 * Encapsulates mapping a package name to a concrete version and persisting metadata needed for
 * deterministic, context-aware resolution:
 * - Creates an isolated mapping key (__PKG__<name>) → <name>@<version>
 * - Persists the real package.json under .deps/ for transitive resolution (handles npm aliases)
 * - Records dependencies in the DependencyStore and runs ConflictChecker validations
 */
export class PackageMapper {
  private importMappings: Map<string, string>
  private packageSources: Map<string, string>
  private dependencyStore: DependencyStore
  private packageVersionResolver: PackageVersionResolver
  private contentFetcher: ContentFetcher
  private logger: Logger
  private resolvePackageVersion: (packageName: string) => Promise<{ version: string | null, source: string }>
  private conflictChecker: ConflictChecker

  constructor(deps: PackageMapperDeps) {
    this.importMappings = deps.importMappings
    this.packageSources = deps.packageSources
    this.dependencyStore = deps.dependencyStore
    this.packageVersionResolver = deps.packageVersionResolver
    this.contentFetcher = deps.contentFetcher
    this.logger = deps.logger
    this.resolvePackageVersion = deps.resolvePackageVersion
    this.conflictChecker = deps.conflictChecker
  }

  private log(message: string, ...args: any[]): void {
    // The logger handles debug toggling internally
    this.logger.log(message, ...args)
  }

  /**
   * Resolve a version for the given package and record a mapping to the versioned name.
   * Also persists package.json and checks dependency/peer conflicts.
   */
  public async fetchAndMapPackage(packageName: string): Promise<void> {
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
    await this.checkPackageDependenciesIfNeeded(actualPackageName, resolvedVersion)
    this.log(`[ImportResolver] 📊 Total isolated mappings: ${this.importMappings.size}`)
  }

  private async checkPackageDependenciesIfNeeded(packageName: string, resolvedVersion: string): Promise<void> {
    try {
      const targetPathCandidate = `.deps/npm/${packageName}@${resolvedVersion}/package.json`
      let packageJson: any
      if (await this.contentFetcher.exists(targetPathCandidate)) {
        const existing = await this.contentFetcher.readFile(targetPathCandidate)
        packageJson = JSON.parse(existing)
        this.log(`[ImportResolver] 📦 Using cached package.json: ${targetPathCandidate}`)
      } else {
        // Fetch the versioned package.json, not the latest
        const packageJsonUrl = `${packageName}@${resolvedVersion}/package.json`
        const content = await this.contentFetcher.resolve(packageJsonUrl)
        packageJson = JSON.parse((content as any).content || content)
        try {
          const realPackageName = (packageJson as any).name || packageName
          const fetchedVersion = (packageJson as any).version
          const targetPath = `.deps/npm/${realPackageName}@${resolvedVersion}/package.json`

          // Validate that fetched version matches expected version to prevent corruption
          if (fetchedVersion && fetchedVersion !== resolvedVersion) {
            this.log(`[ImportResolver] ⚠️  Version mismatch: expected ${resolvedVersion}, got ${fetchedVersion} for ${packageName}`)
            throw new Error(`Version mismatch: fetched ${fetchedVersion} but expected ${resolvedVersion} for package ${packageName}`)
          }

          await this.contentFetcher.setFile(targetPath, JSON.stringify(packageJson, null, 2))
          this.log(`[ImportResolver] 💾 Saved package.json to: ${targetPath}`)
        } catch (saveErr) { this.log(`[ImportResolver] ⚠️  Failed to save package.json:`, saveErr) }
      }
      this.dependencyStore.storePackageDependencies(`${packageName}@${resolvedVersion}`, packageJson)
      await this.conflictChecker.checkPackageDependencies(packageName, resolvedVersion, packageJson)
    } catch (err) {
      this.log(`[ImportResolver] ℹ️  Could not check dependencies for ${packageName}:`, err)
      // Re-throw if this is a critical fetch error (404, network issue)
      if (err instanceof Error && err.message.includes('Fetch failed')) {
        throw err
      }
    }
  }
}
