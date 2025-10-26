// Thin, Node-focused entry for import resolving & flattening
// Primary exports live in this package; ImportResolver is consumed from remix-solidity.

export type { IOAdapter } from './compiler/adapters/io-adapter'
export { NodeIOAdapter } from './compiler/adapters/node-io-adapter'
export { RemixPluginAdapter } from './compiler/adapters/remix-plugin-adapter'

export { ImportResolver } from '@remix-project/remix-solidity'
export { DependencyResolver } from './compiler/dependency-resolver'

export { SourceFlattener } from './compiler/source-flattener'
export type { FlattenOptions, FlattenResult } from './compiler/source-flattener'

export { parseRemappingsFileContent, normalizeRemappings } from './compiler/utils/remappings'
