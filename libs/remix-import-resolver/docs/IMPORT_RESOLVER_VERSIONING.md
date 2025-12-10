# Import Resolver Versioning and Precedence

This document details how the resolver chooses a concrete version when an import is unversioned, and what sources are considered authoritative.

## Precedence (highest to lowest)

1) Workspace resolutions and remappings
   - Explicit alias/remappings in the workspace take top priority.
   - Example: remapping `@oz/contracts` → `@openzeppelin/contracts@5.0.0` pins version 5.0.0.

2) Parent dependency context (graph-consistency)
   - If a parent package already brought in `@pkg@X` in the current graph, the same `X` is preferred for stability.
   - Prevents mixing `@pkg@X` and `@pkg@Y` across different imports of the same graph.

3) Lockfiles (package-lock.json / yarn.lock)
   - If the workspace uses a lockfile and a concrete version is recorded, the resolver uses it as the source of truth.
   - Ensures reproducible resolution aligned with the developer's environment.

4) npm registry metadata (package.json at tag/dist)
   - As a last resort, fetches package.json for a tag or the latest version and selects a semver-compatible version.

## Contract

- Input: package name, optional version/range, and relative file path inside the package.
- Output: concrete version string and mapped package folder path (`<name>@<version>`).
- Error modes: missing package, forbidden range, or incompatible semver constraints.

## Examples

- Unversioned CDN import
  - Original: https://unpkg.com/@openzeppelin/contracts/token/ERC20/ERC20.sol
  - Workspace lockfile contains `@openzeppelin/contracts@5.0.1`
  - Chosen: 5.0.1 (lockfile source)

- Parent context wins over latest
  - Parent brought `@openzeppelin/contracts@4.9.6`
  - Import is `@openzeppelin/contracts/token/ERC721/ERC721.sol` (unversioned)
  - Chosen: 4.9.6 to avoid graph divergence, even if 5.x exists

- Range with lockfile
  - Import specifies `@openzeppelin/contracts@^4.8.0`
  - Lockfile has `4.9.2`; chosen version: 4.9.2

## Notes

- The resolver persists the real package.json under `.deps/...` to preserve transitive dependency info for subsequent imports.
- Alias remappings are recorded so that transitive imports inside the package resolve against the real package name.
- Conflict checks warn if two incompatible versions are required in the same graph (see ConflictChecker docs).
