// Thin, Node-focused entry that re-exports the adapterized import resolver + flattener API
// from @remix-project/remix-solidity. This keeps a stable, minimal surface for consumers
// who only need resolving, remappings, and flattening in Node environments.

export type { IOAdapter } from '@remix-project/remix-solidity'
export { NodeIOAdapter } from '@remix-project/remix-solidity'

export { ImportResolver } from '@remix-project/remix-solidity'
export { DependencyResolver } from '@remix-project/remix-solidity'

export { SourceFlattener } from '@remix-project/remix-solidity'
export type { FlattenOptions, FlattenResult } from '@remix-project/remix-solidity'

export { FileResolutionIndex } from '@remix-project/remix-solidity'

export { parseRemappingsFileContent, normalizeRemappings } from '@remix-project/remix-solidity'

export { Logger } from '@remix-project/remix-solidity'
export { PackageVersionResolver } from '@remix-project/remix-solidity'

export {
  normalizeGithubBlobUrl,
  normalizeRawGithubUrl,
  normalizeIpfsUrl,
  normalizeSwarmUrl,
  rewriteNpmCdnUrl
} from '@remix-project/remix-solidity'
