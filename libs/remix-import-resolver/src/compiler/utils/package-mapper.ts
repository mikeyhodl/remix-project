'use strict'

import { Logger } from './logger'
import { ContentFetcher } from './content-fetcher'
import { DependencyStore } from './dependency-store'
import { PackageVersionResolver } from './package-version-resolver'
import { ConflictChecker } from './conflict-checker'

export class PackageMapper {
  constructor(
    private importMappings: Map<string, string>,
    private packageSources: Map<string, string>,
    private dependencyStore: DependencyStore,
    private packageVersionResolver: PackageVersionResolver,
    private contentFetcher: ContentFetcher,
    private logger: Logger,
    private resolvePackageVersion: (packageName: string) => Promise<{ version: string | null, source: string }>,
    private conflictChecker: ConflictChecker
  ) {}

  private log(message: string, ...args: any[]): void {
    // The logger handles debug toggling internally
    this.logger.log(message, ...args)
  }

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
      const packageJsonUrl = `${packageName}/package.json`
      const content = await this.contentFetcher.resolve(packageJsonUrl)
      const packageJson = JSON.parse((content as any).content || content)
      try {
        const realPackageName = (packageJson as any).name || packageName
        const targetPath = `.deps/npm/${realPackageName}@${resolvedVersion}/package.json`
        await this.contentFetcher.setFile(targetPath, JSON.stringify(packageJson, null, 2))
        this.log(`[ImportResolver] 💾 Saved package.json to: ${targetPath}`)
      } catch (saveErr) { this.log(`[ImportResolver] ⚠️  Failed to save package.json:`, saveErr) }
      this.dependencyStore.storePackageDependencies(`${packageName}@${resolvedVersion}`, packageJson)
      await this.conflictChecker.checkPackageDependencies(packageName, resolvedVersion, packageJson)
    } catch {
      this.log(`[ImportResolver] ℹ️  Could not check dependencies for ${packageName}`)
    }
  }
}
