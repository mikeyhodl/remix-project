# @remix-project/import-resolver

Standalone, Node-friendly import resolver and flattener for Solidity built from Remix internals.

- Adapterized I/O (no global fs/network): plug in Node or your own adapters
- URL normalization (npm CDNs, GitHub raw/blob, IPFS, Swarm)
- Context-aware dependency resolution with per-file package bases
- Foundry-style remappings (inline or remappings.txt)
- Deterministic flattening with single SPDX/pragma and "// File:" sections
- Optional resolution index for IDE "Go to Definition" parity

## Quick start

```ts
import {
  NodeIOAdapter,
  SourceFlattener,
} from '@remix-project/import-resolver'

const io = new NodeIOAdapter()
const flattener = new SourceFlattener(io)

const { flattened } = await flattener.flatten('contracts/MyToken.sol', {
  remappingsFile: 'remappings.txt',
})
console.log(flattened)
```

## API highlights

- SourceFlattener.flatten(entry, opts) → { entry, order, sources, flattened }
- SourceFlattener.flattenToFile(entry, outFile, opts)
- DependencyResolver: build dependency graph, save resolution index
- NodeIOAdapter: basic fs/network I/O for Node
- parseRemappingsFileContent / normalizeRemappings: manage remappings

See the Remix monorepo tests under `libs/remix-solidity/test` for end-to-end usage.
