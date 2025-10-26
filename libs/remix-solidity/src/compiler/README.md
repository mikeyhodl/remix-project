# Compiler Orchestration (SmartCompiler → DependencyResolver → ImportResolver)

This folder contains the orchestration for dependency-aware Solidity compilation.

High-level flow:

- SmartCompiler
  - Thin wrapper around the core Compiler.
  - Builds the full dependency graph first, then hands a flat sources map to the compiler.
  - Logs import graph when debug=true.
- DependencyResolver
  - Walks Solidity imports from the entry file.
  - Tracks who imported what (requesting file) and the package/URL context of each file.
  - Delegates fetching and path normalization to ImportResolver.
- ImportResolver
  - The single point that resolves any non-local import.
  - Responsibilities, now split with small utils:
    - URL normalization in `utils/url-normalizer.ts` (GitHub, npm CDNs, IPFS, Swarm).
    - Semver checks in `utils/semver-utils.ts`.
    - Workspace/lock-file version hints and package.json persistence via `utils/package-version-resolver.ts`.
  - Records original → resolved paths into a ResolutionIndex for "Go to Definition".

Debugging tips:

- Enable debug by passing `debug: true` to SmartCompiler/DependencyResolver.
- Look for these prefixes in the console:
  - [SmartCompiler] … overall orchestration
  - [DependencyResolver] … traversal and local/relative resolution
  - [ImportResolver] … URL normalization, version mapping, and fetches
- For GitHub/URL imports, normalized targets are saved under `.deps/` (e.g. `.deps/github/<owner>/<repo>@<ref>/…`).
- All original → final resolution mappings are stored per target file via `ResolutionIndex` to power navigation.

Key contracts:

- `IImportResolver`
  - resolveAndSave(url: string): Promise<string>
  - saveResolutionsToIndex(): Promise<void>
  - getTargetFile(): string

Next refactors (safe to do incrementally):

- Extract dependency/peer-dependency conflict checks to `utils/conflict-checker.ts`.
- Add unit tests for the new utils: URL normalization and semver logic.

Standalone/adapter-friendly usage:

- IO boundary is abstracted by `adapters/io-adapter.ts` with a tiny interface for file ops and content fetching.
  - Default app adapter: `adapters/remix-plugin-adapter.ts` (delegates to Remix plugin APIs).
  - Core utilities like `ContentFetcher` and `PackageVersionResolver` now depend on `IOAdapter`, not the app.
- To run outside the app (Node script, tests), provide your own adapter implementing:
  - readFile(path), writeFile(path), setFile(path), exists(path), mkdir(path)
  - fetch(url) → string content
  - optionally resolveAndSave(url, targetPath?, useOriginal?) → string

Example sketch for a Node adapter (pseudo):

```ts
import { IOAdapter } from './adapters/io-adapter'
import { promises as fs } from 'fs'
import { dirname } from 'path'

export class NodeIOAdapter implements IOAdapter {
  async readFile(p: string) { return fs.readFile(p, 'utf8') }
  async writeFile(p: string, c: string) { await fs.writeFile(p, c, 'utf8') }
  async setFile(p: string, c: string) { await fs.mkdir(dirname(p), { recursive: true }); await fs.writeFile(p, c, 'utf8') }
  async exists(p: string) { try { await fs.stat(p); return true } catch { return false } }
  async mkdir(p: string) { await fs.mkdir(p, { recursive: true }) }
  async fetch(url: string) { const res = await fetch(url); if (!res.ok) throw new Error(`${res.status} ${url}`); return await res.text() }
}
```

With such adapter, you can instantiate `ContentFetcher` and `PackageVersionResolver` and (via `ImportResolver`) resolve imports without the Remix app. In tests, implement a tiny in-memory adapter to avoid network/filesystem calls.

## SourceFlattener (parsing + resolving + flattening)

For a full end-to-end flow that starts from a local entry Solidity file, parses imports, resolves them contextually (npm, CDN, GitHub raw, IPFS/Swarm), and produces a single flattened source, use `SourceFlattener`:

```ts
import { NodeIOAdapter } from './adapters/node-io-adapter'
import { SourceFlattener } from './source-flattener'

const io = new NodeIOAdapter()
const flattener = new SourceFlattener(io, /* debug */ true)

const { flattened, order } = await flattener.flatten('contracts/MyToken.sol')

// flattened: string with a single SPDX and pragma; no import statements
// order: topologically ordered list of files (dependencies first)
```

Notes:
- The flattener delegates to `DependencyResolver` + `ImportResolver` and honors parent/package contexts.
- A per-file resolution index (for Go-to-Definition) is saved when there are normalized mappings to record.

