# Import Resolver: Test Coverage Overview

This document catalogs what our resolver tests cover today, why each area matters, and how to extend coverage. It’s organized by strategies and patterns we care about in real projects, with direct pointers to the spec files.

> Primary focus: We prefer explicit versioned imports like `@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol`. These are deterministic and make dependency graphs reproducible. We also verify that package.json files for dependent packages are fetched and persisted so transitive imports work reliably.

## Goals and success criteria

- Deterministic resolution and saving for all import shapes we support
- Correct version selection based on precedence rules
- Persist real package.json of imported packages for transitive dependency resolution (including alias cases)
- Accurate per-target resolution index for IDE navigation (Go to Definition, etc.)
- Helpful guidance on error-prone situations (e.g., duplicate files from different versions)

## Strategies and patterns covered

### 1) Explicit versioned imports (preferred)
- Why: avoids ambiguity and flakiness; makes builds reproducible.
- What we assert:
  - Versioned paths save under versioned folders
  - Resolution mappings record the exact versioned path
  - Real package.json is fetched and saved under `.deps/npm/<pkg@version>/package.json`
- Specs:
  - `import-resolver-groups1-6.spec.ts` (Group 1, 3, 4)
  - `import-resolver-standalone.spec.ts`
  - `package-version-resolver.spec.ts`
  - `source-flattener.spec.ts`

### 2) Unversioned imports with workspace/lockfile resolution
- Why: many users depend on workspace package.json or lockfiles.
- What we assert:
  - Workspace `dependencies`/`resolutions` take priority over lockfiles and npm registry
  - Lockfile (yarn.lock / package-lock.json) is used when workspace doesn’t pin
  - First resolve in a session establishes the canonical version for later unversioned imports
- Specs:
  - `workspace-resolutions-precedence.spec.ts`
  - `version-precedence-parent-context.spec.ts`
  - `import-resolver-groups1-6.spec.ts` (Group 2, 5, 6)
  - `package-version-resolver.spec.ts`

### 3) npm alias and module remapping
- Why: workspaces often use alias keys (e.g., `npm:@scope/pkg@x.y.z`). Transitives must still work.
- What we assert:
  - Alias keys resolve to the real npm package, and the real `package.json` is saved
  - Alias and canonical imports can co-exist with independent versions
  - Resolution index records mappings for both alias and canonical forms
- Specs:
  - `import-resolver-groups10-22.spec.ts` (Group 13, 18)
  - `npm-alias-index.spec.ts`

### 4) URL routing and normalization
- Why: users paste CDN/GitHub/IPFS/Swarm URLs; we normalize to deterministic save paths.
- What we assert:
  - CDN (unpkg/jsDelivr) → npm path rewrite; saved under versioned folders; `package.json` saved
  - GitHub blob → raw; raw normalized to `github/<org>/<repo>@<ref>/...`; try to fetch `package.json` too
  - IPFS/Swarm normalize to `ipfs/...` and `swarm/...` (content saved; index recorded)
- Specs:
  - `cdn-and-github.spec.ts`
  - `import-resolver-groups10-22.spec.ts` (Group 12, 16, 17, 19)
  - `url-normalizer.spec.ts`
  - `github-raw-routing.spec.ts`

### 5) Per-target resolution index (Go to Definition)
- Why: IDE navigation relies on an index mapping original → resolved per target file.
- What we assert:
  - Entries are isolated by target file
  - Alias vs canonical imports are both recorded as separate keys
  - Persisted index is stored deterministically
- Specs:
  - `multi-root-resolution-index.spec.ts`
  - `npm-alias-index.spec.ts`
  - `import-resolver-groups7-9.spec.ts` (Group 9)

### 6) Duplicate file detection across versions
- Why: importing the same file from different versions leads to compilation errors.
- What we assert:
  - The resolver emits a clear error with actionable fixes when a file is imported from conflicting versions in one session
- Specs:
  - `duplicate-file-detection.spec.ts`

### 7) Flattener e2e and remappings
- Why: common workflows flatten sources with remappings (e.g., OZ shortcuts).
- What we assert:
  - End-to-end flattening includes dependencies in deterministic order
  - Inline remappings override file remappings; both are supported
- Specs:
  - `source-flattener.spec.ts`

### 8) Dependency conflict checks
- Why: dependency/peerDependency mismatches can break transitive imports.
- What we assert:
  - Warnings/error guidance when peerDeps or transitive versions are incompatible
- Specs:
  - `conflict-checker.spec.ts`

## Where we test package.json persistence

Ensuring the real `package.json` is saved is critical for transitive dependency resolution (especially with aliases). These tests explicitly cover it:

- CDN → npm path: `.deps/npm/@openzeppelin/contracts@<ver>/package.json`
  - `import-resolver-groups10-22.spec.ts` Group 12 (unpkg/jsDelivr, versioned and unversioned)
- Alias key resolves to real package:
  - `import-resolver-groups10-22.spec.ts` Group 13 (`@module_remapping` → real `@openzeppelin/contracts@4.9.0`)
- Multiple versions via alias and canonical names:
  - `import-resolver-groups10-22.spec.ts` Group 18 (both v4 and v5 persisted)
- GitHub raw: best-effort `.deps/github/<org>/<repo>@<ref>/package.json` when present
  - `import-resolver-groups10-22.spec.ts` Group 16 (OpenZeppelin upgradeable)

When using explicit versioned imports (our preferred path), the resolver also fetches and saves `package.json` for the exact version on first touch (npm packages).

## Test catalog (by file)

- `import-resolver-groups1-6.spec.ts`
  - Group 1: versioned folders on first import
  - Group 2: workspace package.json version resolution
  - Group 3: explicit versioned imports deduplicate to canonical version
  - Group 4: explicit version override
  - Group 5: yarn.lock version resolution
  - Group 6: package-lock.json version resolution
- `import-resolver-groups7-9.spec.ts`
  - Group 7: Chainlink CCIP parent dependency resolution
  - Group 8: npm alias and external URL normalization
  - Group 9: resolution index mapping for Go to Definition
- `import-resolver-groups10-22.spec.ts` (subset enabled)
  - Group 12: CDN imports normalization (unpkg/jsDelivr → npm)
  - Group 13: workspace module remapping alias saves real package.json
  - Group 16: GitHub raw imports; save under `github/<org>/<repo>@<ref>/...`; fetch package.json when available
  - Group 17: refs/heads/master/main normalization → `@master/@main`
  - Group 18: npm alias with multiple versions
  - Group 19: jsDelivr multi-version imports and index recording
- `import-resolver-standalone.spec.ts`: core resolver behavior via NodeIOAdapter
- `source-flattener.spec.ts`: flattening e2e with remappings
- `cdn-and-github.spec.ts`: focused CDN/GitHub flows
- `url-normalizer.spec.ts`: pure-function normalization checks (blob→raw, raw paths, ipfs/swarm, CDN)
- `package-version-resolver.spec.ts`: standalone version resolution with precedence
- `version-precedence-parent-context.spec.ts`: parent-context mapping within a session
- `workspace-resolutions-precedence.spec.ts`: workspace `resolutions` and overrides precedence
- `multi-root-resolution-index.spec.ts`: per-target index isolation
- `npm-alias-index.spec.ts`: index recording for alias + canonical
- `duplicate-file-detection.spec.ts`: duplicate file error across versions
- `github-raw-routing.spec.ts`: saving normalized GitHub raw content and index mapping
- `extract-package-name.spec.ts`: alias-aware parsing for npm package extraction
- `deep-package-json-usage.spec.ts`: parent deps drive child version for unversioned imports

## Conventions we follow in tests

- Use explicit versions where possible for determinism (`@pkg@x.y.z/path.sol`)
- Save locations are deterministic:
  - npm: `.deps/npm/@scope/pkg@version/...`
  - GitHub content: `github/<org>/<repo>@<ref>/...`
  - GitHub package.json (when available): `.deps/github/<org>/<repo>@<ref>/package.json`
  - IPFS/Swarm: `ipfs/<hash>/...`, `swarm/<hash>/...`
- Resolution index lives at `.deps/npm/.resolution-index.json` (Node adapter)

## Adding new cases (playbook)

- Start from a minimal, explicit versioned import; assert:
  - Non-empty content
  - `package.json` persisted for the exact version
  - Mapping recorded in the resolution index after `saveResolutionsToIndex()`
- To test precedence, add a local `package.json` with:
  - `dependencies` (pin) and/or `resolutions`/alias keys
  - Re-run the same unversioned import; assert the pinned version is used
- For aliases, import via both canonical and alias keys; assert coexistence and separate index entries
- For duplicate detection, import the same file from two different explicit versions in a single session; assert the error guidance

## Coverage gaps and next candidates

- Stronger transitive checks: read the saved `package.json` and verify a known transitive import resolves without extra fetches
- Multi-parent dependency conflicts: build a small fixture where two parents require different ranges of the same child; assert the warning and the chosen version
- Negative paths: invalid extensions, missing files, and malformed URLs with helpful error messages
- IPFS in Node: gated behind a stable gateway; until then, skip or use local fixtures (no reliance on public gateways)

## How to run (optional)

```bash
# All resolver tests
yarn nx test remix-import-resolver
```

## See also

- Flow: `docs/IMPORT_RESOLVER_FLOW.md`
- URLs and routing: `docs/IMPORT_RESOLVER_URLS.md`
- Version precedence: `docs/IMPORT_RESOLVER_VERSIONING.md`
