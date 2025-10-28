import { Logger } from './logger'

export type ParentRequirement = { parent: string; version: string }

export class WarningSystem {
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  /**
   * Emit a multi-parent dependency conflict warning where different parents require different versions.
   */
  public async emitMultiParentConflictWarn(
    packageName: string,
    conflictingParents: ParentRequirement[]
  ): Promise<void> {
    const uniqueVersions = Array.from(new Set(conflictingParents.map(p => p.version))).sort()
    const lines: string[] = [
      `⚠️  MULTI-PARENT DEPENDENCY CONFLICT`,
      ``,
      `   Multiple parent packages require different versions of: ${packageName}`,
      ``,
      ...conflictingParents.map(p => `   • ${p.parent} requires ${packageName}@${p.version}`),
      uniqueVersions.length ? `` : ``
    ]
    await this.logger.terminal('warn', lines.join('\n'))
  }

  /**
   * Emit an error when the same file is imported from different versions of the same package.
   */
  public async emitDuplicateFileError(args: {
    packageName: string
    relativePath: string | null
    previousVersion: string
    requestedVersion: string
  }): Promise<void> {
    const { packageName, relativePath, previousVersion, requestedVersion } = args
    const lines: string[] = [
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
    ]
    await this.logger.terminal('error', lines.join('\n'))
  }
}
