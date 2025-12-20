// Thin, Node-focused entry for import resolving & flattening
// Primary exports live in this package; ImportResolver is consumed from remix-solidity.

export type { IOAdapter } from './compiler/adapters/io-adapter'
export { NodeIOAdapter } from './compiler/adapters/node-io-adapter'
export { RemixPluginAdapter } from './compiler/adapters/remix-plugin-adapter'
export type { IImportResolver } from './compiler/import-resolver-interface'

export { ImportResolver } from './compiler/import-resolver'
export { DependencyResolver } from './compiler/dependency-resolver'
export type { CompilerInputDepedencyResolver } from './compiler/dependency-resolver'

export { SourceFlattener } from './compiler/source-flattener'
export type { FlattenOptions, FlattenResult } from './compiler/source-flattener'
export { FileResolutionIndex } from './compiler/file-resolution-index'
export { ResolutionIndex } from './compiler/resolution-index'

// Import Handler System
export type {
  IImportHandler,
  ImportHandlerContext,
  ImportHandlerResult
} from './compiler/import-handler-interface'
export { ImportHandler } from './compiler/import-handler-interface'
export { ImportHandlerRegistry } from './compiler/import-handler-registry'
export { RemixTestLibsHandler } from './compiler/handlers/remix-test-libs-handler'
export { CustomTemplateHandler } from './compiler/handlers/custom-template-handler'

export { parseRemappingsFileContent, normalizeRemappings } from './compiler/utils/remappings'

// Utils exposed for advanced usage/testing
export { PackageVersionResolver } from './compiler/utils/package-version-resolver'
export { ConflictChecker } from './compiler/utils/conflict-checker'
export { Logger } from './compiler/utils/logger'
export { WarningSystem } from './compiler/utils/warning-system'
export { DependencyStore } from './compiler/utils/dependency-store'
export {
  normalizeGithubBlobUrl,
  normalizeRawGithubUrl,
  rewriteNpmCdnUrl,
  normalizeIpfsUrl,
  normalizeSwarmUrl
} from './compiler/utils/url-normalizer'
export { toHttpUrl } from './compiler/utils/to-http-url'
