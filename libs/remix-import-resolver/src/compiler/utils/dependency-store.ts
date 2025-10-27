export class DependencyStore {
  private parentPackageDependencies: Map<string, Map<string, string>> = new Map()
  private importedFiles: Map<string, string> = new Map()
  private packageSources: Map<string, string> = new Map()

  setPackageSource(pkg: string, source: string) { this.packageSources.set(pkg, source) }
  getPackageSource(pkg: string): string | undefined { return this.packageSources.get(pkg) }

  setImportedFile(fileKey: string, version: string) { this.importedFiles.set(fileKey, version) }
  getImportedFile(fileKey: string): string | undefined { return this.importedFiles.get(fileKey) }

  storePackageDependencies(packageKey: string, packageJson: any): Map<string, string> | null {
    if (!packageJson) return null
    if (!packageJson.dependencies && !packageJson.peerDependencies) return null
    const deps = new Map<string, string>()
    const addDeps = (obj: Record<string, string>) => {
      for (const [dep, versionRange] of Object.entries(obj)) {
        if (!deps.has(dep)) {
          const clean = (versionRange as string).replace(/^[\^~>=<]+/, '')
          deps.set(dep, clean)
        }
      }
    }
    if (packageJson.dependencies) addDeps(packageJson.dependencies)
    if (packageJson.peerDependencies) addDeps(packageJson.peerDependencies)
    this.parentPackageDependencies.set(packageKey, deps)
    return deps
  }

  getParentPackageDeps(packageKey: string): Map<string, string> | undefined { return this.parentPackageDependencies.get(packageKey) }
  hasParent(packageKey: string): boolean { return this.parentPackageDependencies.has(packageKey) }
  entries(): IterableIterator<[string, Map<string, string>]> { return this.parentPackageDependencies.entries() }
}
