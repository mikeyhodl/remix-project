# Import Resolver Test Suite

## Overview
This document describes the E2E tests for the new import resolver functionality, which replaces the old import rewriting system.

## Key Features Being Tested

### 1. Versioned Folder Structure
- ✅ Folders are named with explicit versions: `@openzeppelin/contracts@4.8.3/`
- ✅ Each package version has its own isolated folder
- ✅ No more ambiguous unversioned folders

### 2. Package.json Persistence
- ✅ Every imported package has its `package.json` saved to the filesystem
- ✅ Located at `.deps/npm/<package>@<version>/package.json`
- ✅ Contains full metadata (dependencies, peerDependencies, version info)

### 3. Version Resolution Priority
1. **Workspace package.json** dependencies/resolutions/overrides
2. **Lock files** (yarn.lock or package-lock.json)
3. **NPM registry** (fetched directly)

### 4. Canonical Version Enforcement
- ✅ Only ONE version of each package is used per compilation
- ✅ Explicit versioned imports (`@openzeppelin/contracts@5.0.2/...`) are normalized to canonical version
- ✅ Prevents duplicate declarations

### 5. Dependency Conflict Detection
- ✅ Warns when package dependencies don't match imported versions
- ✅ Shows which package.json is requesting which version
- ✅ Provides actionable fix instructions

## Running the Tests

### Run all import resolver tests:
```bash
yarn build:e2e && yarn nightwatch --config dist/apps/remix-ide-e2e/nightwatch-chrome.js dist/apps/remix-ide-e2e/src/tests/importRewrite.test.js --env=chromeDesktop
```

### Run specific test group:
```bash
# Group 1: Basic versioned folder and package.json tests
yarn build:e2e && yarn nightwatch --config dist/apps/remix-ide-e2e/nightwatch-chrome.js dist/apps/remix-ide-e2e/src/tests/importRewrite.test.js --env=chromeDesktop --testcase="Test NPM Import with Versioned Folders #group1"

# Group 2: Workspace package.json resolution
yarn build:e2e && yarn nightwatch --config dist/apps/remix-ide-e2e/nightwatch-chrome.js dist/apps/remix-ide-e2e/src/tests/importRewrite.test.js --env=chromeDesktop --testcase="Test workspace package.json version resolution #group2"

# Group 3: Explicit versioned imports and deduplication
yarn build:e2e && yarn nightwatch --config dist/apps/remix-ide-e2e/nightwatch-chrome.js dist/apps/remix-ide-e2e/src/tests/importRewrite.test.js --env=chromeDesktop --testcase="Test explicit versioned imports #group3"

# Group 4: Version conflict warnings
yarn build:e2e && yarn nightwatch --config dist/apps/remix-ide-e2e/nightwatch-chrome.js dist/apps/remix-ide-e2e/src/tests/importRewrite.test.js --env=chromeDesktop --testcase="Test version conflict warning in terminal #group4"
```

## Test Cases

### Group 1: Basic Import Resolution
**File:** `UpgradeableNFT.sol`
- Imports OpenZeppelin upgradeable contracts
- **Verifies:**
  - `.deps/npm/@openzeppelin/` folder exists
  - Versioned folder: `contracts-upgradeable@X.Y.Z/`
  - `package.json` is saved in the versioned folder
  - `package.json` contains correct metadata

### Group 2: Workspace Package.json Resolution
**Files:** `package.json`, `TokenWithDeps.sol`
- Creates workspace with explicit version (`@openzeppelin/contracts@4.8.3`)
- Imports from `@openzeppelin/contracts`
- **Verifies:**
  - Version from workspace package.json is used (4.8.3)
  - Folder named `contracts@4.8.3/` exists
  - Canonical version is enforced

### Group 3: Explicit Versioned Imports
**File:** `ExplicitVersions.sol`
- Imports with explicit versions: `@openzeppelin/contracts@4.8.3/...`
- **Verifies:**
  - Deduplication works (only ONE folder per package)
  - Explicit versions are normalized to canonical version
  - Multiple explicit imports don't create duplicate folders

### Group 4: Version Conflict Detection
**Files:** `package.json` (4.8.3), `ConflictingVersions.sol` (@5)
- Workspace specifies one version, code requests another
- **Verifies:**
  - Terminal shows appropriate warnings
  - Compilation still succeeds
  - Canonical version is used

## Expected Folder Structure After Tests

```
.deps/
└── npm/
    └── @openzeppelin/
        ├── contracts@4.8.3/
        │   ├── package.json
        │   └── token/
        │       └── ERC20/
        │           ├── IERC20.sol
        │           └── ERC20.sol
        └── contracts-upgradeable@5.4.0/
            ├── package.json
            └── token/
                └── ERC1155/
                    └── ERC1155Upgradeable.sol
```

## What Changed from Old System

### ❌ OLD (Import Rewriting):
- Unversioned folders: `.deps/npm/@openzeppelin/contracts/`
- Source files were rewritten with version tags
- Difficult to debug version conflicts
- package.json sometimes missing

### ✅ NEW (Import Resolver):
- Versioned folders: `.deps/npm/@openzeppelin/contracts@4.8.3/`
- Source files remain unchanged
- Clear version tracking in folder names
- package.json always saved for visibility
- Smart deduplication
- Actionable conflict warnings

## Debugging Failed Tests

### Test fails to find versioned folder:
1. Check console logs for `[ImportResolver]` messages
2. Verify package.json is valid JSON
3. Check if npm package exists and is accessible

### Test fails on version mismatch:
1. Check workspace package.json dependencies
2. Look for terminal warnings about version conflicts
3. Verify canonical version was resolved correctly

### Test timeout on file operations:
1. Increase wait times in test (e.g., `pause(10000)`)
2. Check network connectivity for npm fetches
3. Verify file system permissions for `.deps/` folder

## Future Test Improvements

- [ ] Test lock file (yarn.lock/package-lock.json) resolution (**Note**: Currently lock files are parsed but may not override npm latest - needs investigation)
- [ ] Test resolutions/overrides in package.json
- [ ] Test peerDependency warnings (logged to console but not terminal)
- [ ] Test circular dependency handling
- [ ] Test with Chainlink CCIP contracts (real-world multi-version scenario)
- [ ] Performance tests for large dependency trees
- [ ] Terminal warning validation (console.log messages don't appear in terminal journal)
