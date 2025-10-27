import type { IOAdapter } from '../adapters/io-adapter'

export type ResolvedVersion = { version: string | null; source: string }

/**
 * PackageVersionResolver
 *
 * Resolves a concrete version for a package using precedence:
 * 1) Workspace resolutions/overrides and aliases
 * 2) Parent package.json dependencies (from current context)
 * 3) Lockfiles (yarn.lock, package-lock.json)
 * 4) Fetched package.json from npm
 */
export class PackageVersionResolver {
  private workspaceResolutions: Map<string, string> = new Map()
  private lockFileVersions: Map<string, string> = new Map()

  constructor(private io: IOAdapter, private debug = false) {}

  private log(msg: string, ...args: any[]) { if (this.debug) console.log(msg, ...args) }

  public getWorkspaceResolutions(): ReadonlyMap<string, string> { return this.workspaceResolutions }
  public hasWorkspaceResolution(name: string): boolean { return this.workspaceResolutions.has(name) }
  public getWorkspaceResolution(name: string): string | undefined { return this.workspaceResolutions.get(name) }
  public hasLockFileVersion(name: string): boolean { return this.lockFileVersions.has(name) }
  public getLockFileVersion(name: string): string | undefined { return this.lockFileVersions.get(name) }

  /** Load workspace resolutions (resolutions/overrides, deps incl. npm: aliases). */
  public async loadWorkspaceResolutions(): Promise<void> {
    try {
      const exists = await this.io.exists('package.json')
      if (!exists) return
      const content = await this.io.readFile('package.json')
      const packageJson = JSON.parse(content)
      const resolutions = packageJson.resolutions || packageJson.overrides || {}
      for (const [pkg, version] of Object.entries(resolutions)) {
        if (typeof version === 'string') {
          this.workspaceResolutions.set(pkg, version)
          this.log(`[PkgVer] 📌 Workspace resolution: ${pkg} → ${version}`)
        }
      }
      const allDeps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.peerDependencies || {}),
        ...(packageJson.devDependencies || {})
      }
      for (const [pkg, versionRange] of Object.entries(allDeps)) {
        if (!this.workspaceResolutions.has(pkg) && typeof versionRange === 'string') {
          if (versionRange.startsWith('npm:')) {
            const npmAlias = versionRange.substring(4)
            const match = npmAlias.match(/^(@?[^@]+)@(.+)$/)
            if (match) {
              const [, realPackage, version] = match
              this.workspaceResolutions.set(pkg, `alias:${realPackage}@${version}`)
              this.log(`[PkgVer] 🔗 NPM alias: ${pkg} → ${realPackage}@${version}`)
            } else {
              this.log(`[PkgVer] ⚠️ Invalid npm alias format: ${pkg} → ${versionRange}`)
            }
          } else if (versionRange.match(/^\d+\.\d+\.\d+$/)) {
            this.workspaceResolutions.set(pkg, versionRange)
            this.log(`[PkgVer] 📦 Workspace dependency (exact): ${pkg} → ${versionRange}`)
          } else {
            this.log(`[PkgVer] 📦 Workspace dependency (range): ${pkg}@${versionRange}`)
          }
        }
      }
    } catch {
      this.log(`[PkgVer] ℹ️ No workspace package.json or resolutions`)
    }
  }

  /** Parse lockfiles once to populate exact versions. */
  public async loadLockFileVersions(): Promise<void> {
    if (this.lockFileVersions.size > 0) return
    try {
      const yarnLockExists = await this.io.exists('yarn.lock')
      if (yarnLockExists) { await this.parseYarnLock(); return }
    } catch {}
    try {
      const npmLockExists = await this.io.exists('package-lock.json')
      if (npmLockExists) { await this.parsePackageLock(); return }
    } catch {}
  }

  /** Best-effort yarn.lock parser to capture concrete versions. */
  private async parseYarnLock(): Promise<void> {
    try {
      const content = await this.io.readFile('yarn.lock')
      const lines = content.split('\n')
      let currentPackage: string | null = null
      for (const line of lines) {
        const packageMatch = line.match(/^"?(@?[^"@]+(?:\/[^"@]+)?)@[^"]*"?:/)
        if (packageMatch) currentPackage = packageMatch[1]
        const versionMatch = line.match(/^\s+version\s+"([^"]+)"/)
        if (versionMatch && currentPackage) {
          this.lockFileVersions.set(currentPackage, versionMatch[1])
          currentPackage = null
        }
      }
      this.log(`[PkgVer] 🔒 Loaded ${this.lockFileVersions.size} versions from yarn.lock`)
    } catch (err) {
      this.log(`[PkgVer] ⚠️ Failed to parse yarn.lock:`, err)
    }
  }

  /** Best-effort package-lock.json parser to capture concrete versions. */
  private async parsePackageLock(): Promise<void> {
    try {
      const content = await this.io.readFile('package-lock.json')
      const lockData = JSON.parse(content)
      if (lockData.dependencies) {
        for (const [pkg, data] of Object.entries(lockData.dependencies)) {
          if (data && typeof data === 'object' && 'version' in data) {
            this.lockFileVersions.set(pkg, (data as any).version)
          }
        }
      }
      if (lockData.packages) {
        for (const [path, data] of Object.entries(lockData.packages)) {
          if (data && typeof data === 'object' && 'version' in data) {
            if (path === '') continue
            const pkg = (path as string).replace(/^node_modules\//, '')
            if (pkg) this.lockFileVersions.set(pkg, (data as any).version)
          }
        }
      }
      this.log(`[PkgVer] 🔒 Loaded ${this.lockFileVersions.size} versions from package-lock.json`)
    } catch (err) {
      this.log(`[PkgVer] ⚠️ Failed to parse package-lock.json:`, err)
    }
  }

  /** Resolve a version for a package given optional parent dependency context. */
  public async resolveVersion(
    packageName: string,
    parentDeps?: Map<string, string>,
    parentPackage?: string
  ): Promise<ResolvedVersion> {
    this.log(`[PkgVer] 🔍 Resolving version for: ${packageName}`)
    await this.loadWorkspaceResolutions()
    if (this.workspaceResolutions.has(packageName)) {
      const resolution = this.workspaceResolutions.get(packageName)!
      if (resolution.startsWith('alias:')) {
        const aliasTarget = resolution.substring(6)
        const match = aliasTarget.match(/^(@?[^@]+)@(.+)$/)
        if (match) {
          const [, realPackage, version] = match
          this.log(`[PkgVer] ✅ PRIORITY 1 - Alias: ${packageName} → ${realPackage}@${version}`)
          return { version, source: `alias:${packageName}→${realPackage}` }
        }
      }
      this.log(`[PkgVer] ✅ PRIORITY 1 - Workspace resolution: ${packageName} → ${resolution}`)
      return { version: resolution, source: 'workspace-resolution' }
    }
    this.log(`[PkgVer] ⏭️ Priority 1: Not found`)

    if (parentDeps && parentDeps.has(packageName)) {
      const version = parentDeps.get(packageName)!
      this.log(`[PkgVer] ✅ PRIORITY 2 - Parent dependency: ${packageName} → ${version}${parentPackage ? ` (from ${parentPackage})` : ''}`)
      return { version, source: parentPackage ? `parent-${parentPackage}` : 'parent' }
    }
    this.log(`[PkgVer] ⏭️ Priority 2: Not found`)

    await this.loadLockFileVersions()
    if (this.lockFileVersions.has(packageName)) {
      const version = this.lockFileVersions.get(packageName)!
      this.log(`[PkgVer] ✅ PRIORITY 3 - Lock file: ${packageName} → ${version}`)
      return { version, source: 'lock-file' }
    }
    this.log(`[PkgVer] ⏭️ Priority 3: Not found`)

    this.log(`[PkgVer] 🌐 Priority 4 - Fetch package.json: ${packageName}`)
    try {
      const packageJsonUrl = `${packageName}/package.json`
      const content = await this.io.fetch(packageJsonUrl)
      const packageJson = JSON.parse(content)
      const version = packageJson.version || null
      return { version, source: 'package-json' }
    } catch (err) {
      this.log(`[PkgVer] ⚠️ Failed to fetch package.json for ${packageName}:`, err)
      return { version: null, source: 'fetched' }
    }
  }
}
