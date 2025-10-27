# Import Resolver: High-level Flow

This document outlines the end-to-end flow of the standalone import resolver and its key modules, to make debugging and reviews faster.

## Overview

- Input: original import string (Solidity .sol or package.json)
- Output: content resolved and saved locally, plus a resolution mapping from original import → resolved path
- Determinism: same inputs produce the same resolved paths and saved locations

## Main path

1) URL routing and normalization
   - Component: `utils/url-request-router.ts`
   - What it does:
     - Detects and normalizes
       - npm CDN URLs (unpkg/jsDelivr) → `@pkg[/@version]/path`
       - GitHub blob → raw, raw.githubusercontent.com → `github/owner/repo@ref/path`
       - IPFS `ipfs://` and Swarm `bzz://` → `ipfs/<hash>/...` and `swarm/<hash>/...`
     - Either returns content (for pure external fetches) or a rewritten URL to continue resolution
   - Side-effects: records the original → normalized mapping when appropriate

2) Parse import for npm package info
   - Component: `utils/parser-utils.ts`
   - Extracts: package name, explicit version (if any), and the relative file path inside the package

3) Resolve package version (if unversioned)
   - Component: `utils/package-version-resolver.ts`
   - Priority: workspace resolutions/aliases → parent deps (context) → lockfile → fetch package.json (npm)
   - Logs the source of truth used (useful for audits)

4) Map package and persist metadata
   - Component: `utils/package-mapper.ts`
   - Behavior:
     - Creates isolated mapping `__PKG__<name> → <name>@<version>`
     - Persists real `package.json` under `.deps/...` (handles npm aliases so transitive deps work)
     - Stores dependencies in `DependencyStore` and runs conflict checks via `ConflictChecker`

5) Fetch content and save
   - Component: `utils/content-fetcher.ts`
   - Saves under deterministic paths (npm, github, ipfs, swarm) and returns content

6) Index mapping
   - Component: `ResolutionIndex` (browser) or `FileResolutionIndex` (Node)
   - Records mappings per target file: `original → resolved`

## Supporting utilities

- `utils/conflict-checker.ts`
  - Validates dependency and peerDependency conflicts; emits structured warnings
- `utils/semver-utils.ts`
  - Helpers for potential/breaking version conflicts
- `utils/dependency-store.ts`
  - Tracks parent→deps and package sources (workspace vs external)
- `utils/logger.ts`
  - Structured logs to terminal/plugin channels; debug switch-friendly

## Call graph (simplified)

ImportResolver.resolveAndSave → url-request-router
  ↳ (rewrite) continue
  ↳ (content) return
→ parser-utils (pkg, version, relPath)
→ PackageMapper.fetchAndMapPackage
  ↳ PackageVersionResolver.resolveVersion (with parent deps)
  ↳ ContentFetcher.resolve(package.json) → save + DependencyStore + ConflictChecker
→ ContentFetcher.resolveAndSave(file)
→ ResolutionIndex/FileResolutionIndex.save

## Notes

- CDN rewrite behavior preserves the original unversioned mapping entry for clarity while saving under the versioned folder
- npm aliases are resolved to their real package for metadata persistence to keep transitive imports working
- Parent context is derived from previous mappings and DependencyStore to select consistent versions across a graph

## See also

- URLs and routing details: `docs/IMPORT_RESOLVER_URLS.md`
- Version precedence and sources of truth: `docs/IMPORT_RESOLVER_VERSIONING.md`
 - Test coverage overview: `docs/IMPORT_RESOLVER_TESTS_OVERVIEW.md`
