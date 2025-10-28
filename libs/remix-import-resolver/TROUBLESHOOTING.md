# Troubleshooting: remix-import-resolver

This guide helps diagnose and fix common resolver issues and warnings. The resolver centralizes messaging and only surfaces high-signal warnings by default. Noisy messages can be enabled by setting debug=true in constructors.

- High-signal (always on, deduped):
  - MULTI-PARENT DEPENDENCY CONFLICT
  - DUPLICATE FILE DETECTED (across versions)
  - Error processing import
- Noisy (verbose only):
  - Failed to resolve import
  - Invalid import path (non-.sol)

## Where files are saved

- NPM packages: `.deps/npm/@scope/name@<version>/...`
- GitHub raw/blob: `.deps/github/<org>/<repo>@<ref>/...`
- HTTPS/IPFS/Swarm: `.deps/https`, `.deps/ipfs`, `.deps/swarm`
- Resolution index: `.deps/npm/.resolution-index.json`

If you need a clean slate, delete `.deps/` in your workspace.

## Enable verbose warnings

Verbose warnings are gated behind the `debug` flag. Turn it on during development when you need more context.

```ts
import { DependencyResolver, NodeIOAdapter } from '@remix-project/import-resolver'

const io = new NodeIOAdapter()
const dep = new DependencyResolver(io, 'contracts/Main.sol', true) // debug → verbose warnings
```

## MULTI-PARENT DEPENDENCY CONFLICT

You’ll see this when multiple packages require different versions of the same dependency.

Why
- Two or more parents declare conflicting versions (e.g., A → OZ@4.x, B → OZ@5.x).

Fix
- Prefer a single version via explicit imports or remappings.
- For Solidity sources you control, use explicit versioned imports:

```solidity
// Choose one:
import "@openzeppelin/contracts@4.9.6/access/Ownable.sol";
// or
import "@openzeppelin/contracts@5.0.0/access/Ownable.sol";
```

- Or, apply a remapping so all `@openzeppelin/contracts/` requests resolve to the chosen version:

```ts
resolver.setRemappings([
  { from: '@openzeppelin/contracts/', to: '@openzeppelin/contracts@4.9.6/' }
])
```

## 🚨 DUPLICATE FILE DETECTED - Will cause compilation errors!

You imported the same file from different versions of a package.

Why
- The same relative path (e.g., `utils/Context.sol`) was pulled from two versions, which will duplicate symbols.

Fix
- Use explicit versioned imports in your Solidity files to choose a single version:

```solidity
import "@openzeppelin/contracts@4.9.6/utils/Context.sol";
```

- If both versions are needed across different modules, ensure they do not collide in the final compilation unit (e.g., avoid flattening them together) or refactor to a single version.

## ⚠️ Failed to resolve import (verbose)

Only shown when `debug=true`.

Why
- The resolver couldn’t resolve a path remotely or locally (typo, network hiccup, or missing file).

Fix
- Check for typos in import path.
- Ensure network connectivity for external sources.
- Verify any remappings are correct and applied before the failing import.

## ⚠️ Invalid import path (verbose)

Only shown when `debug=true`.

Why
- Non-Solidity imports (paths not ending in `.sol`) are skipped by the dependency builder.

Fix
- Restrict dependency scanning to Solidity files, or handle non-Solidity files separately.

## Resolution index behavior

- Records only external mappings: original import → resolved versioned path.
- Local relative imports are intentionally not recorded.
- Written to `.deps/npm/.resolution-index.json` per target file.

## Common patterns

- Prefer unversioned imports in application code; the resolver maps to the correct version automatically based on workspace resolution and parent context. For transitive dependency ambiguity, use versioned imports directly.
- Use remappings to reduce churn when bumping versions:

```ts
resolver.setRemappings([
  { from: 'oz/', to: '@openzeppelin/contracts@4.9.6/' }
])
// then in .sol files
// import "oz/access/Ownable.sol";
```

## Still stuck?

- Clear `.deps/` and retry.
- Run with `debug=true` for more detail.
- Check the resolution index for the exact mapping being applied to the file:
  - `.deps/npm/.resolution-index.json`
- If the issue involves GitHub sources, confirm the `ref` and paths exist on GitHub and that `package.json` is present only where expected. The resolver caches GitHub `package.json` by `<org>/<repo>@<ref>`.
