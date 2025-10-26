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
    - Workspace/lock-file version hints and package.json persistence (in-file, next step to extract).
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

- Extract package version resolution (workspace/lock/npm) to `utils/package-version-resolver.ts`.
- Extract dependency/peer-dependency conflict checks to `utils/conflict-checker.ts`.
- Add unit tests for the new utils: URL normalization and semver logic.
