# Import Resolver Architecture

## Overview

The Import Resolver is a deterministic dependency resolution system that handles npm package imports in Solidity contracts. It provides lock file support, canonical versioning, and proper handling of transitive dependencies with their own package.json files.

---

## The Problem It Solves

### Before: Inconsistent Resolution
```solidity
// User's contract
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
```

**Problems:**
1. ❌ Same import could resolve to different versions across compilations
2. ❌ No lock file support - couldn't pin dependency versions
3. ❌ No workspace awareness - ignored package.json
4. ❌ Transitive dependencies broke (when ERC20.sol imports other files)
5. ❌ Multiple versions of same package would be downloaded

### After: Deterministic Resolution
```
✅ Respects yarn.lock / package-lock.json
✅ One canonical version per package: @openzeppelin/contracts@4.8.3/
✅ Workspace package.json dependencies honored
✅ Transitive dependencies work correctly
✅ Lock files reloaded dynamically when changed
```

---

## Architecture Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SOLIDITY COMPILATION                        │
│                                                                     │
│  User Contract:                                                     │
│  import "@openzeppelin/contracts/token/ERC20/ERC20.sol";           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      IMPORT RESOLVER                                │
│                   (ImportResolver class)                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
                   ┌───────────────────────┐
                   │ 1. EXTRACT PACKAGE    │
                   │                       │
                   │ "@openzeppelin/       │
                   │  contracts"           │
                   └───────┬───────────────┘
                           │
                           ▼
                   ┌───────────────────────┐
                   │ 2. RESOLVE VERSION    │
                   │                       │
                   │ Priority Order:       │
                   │ a) Workspace resolu-  │
                   │    tions/overrides    │
                   │ b) Workspace deps     │
                   │    (exact versions)   │
                   │ c) Lock files         │
                   │    (FRESH reload)     │
                   │ d) NPM (fallback)     │
                   └───────┬───────────────┘
                           │
                           ▼
                   ┌───────────────────────┐
                   │ 3. CANONICAL VERSION  │
                   │                       │
                   │ "@openzeppelin/       │
                   │  contracts@4.8.3"     │
                   └───────┬───────────────┘
                           │
                           ▼
                   ┌───────────────────────┐
                   │ 4. FETCH & STORE      │
                   │                       │
                   │ .deps/npm/            │
                   │  @openzeppelin/       │
                   │   contracts@4.8.3/    │
                   │    ├── token/...      │
                   │    └── package.json   │
                   └───────┬───────────────┘
                           │
                           ▼
                   ┌───────────────────────┐
                   │ 5. REWRITE IMPORT     │
                   │                       │
                   │ ".deps/npm/           │
                   │  @openzeppelin/       │
                   │   contracts@4.8.3/    │
                   │    token/ERC20/       │
                   │     ERC20.sol"        │
                   └───────┬───────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TRANSITIVE DEPENDENCIES                          │
│                                                                     │
│  ERC20.sol contains:                                                │
│  import "../../utils/Context.sol";                                  │
│  import "../IERC20.sol";                                            │
│                                                                     │
│  ✅ Resolved relative to:                                           │
│     .deps/npm/@openzeppelin/contracts@4.8.3/token/ERC20/           │
│                                                                     │
│  ✅ Each dependency's package.json is preserved                     │
│  ✅ Compiler can find all imports correctly                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Why Transitive Dependencies Work

### The Magic: Package.json Preservation

When we fetch `@openzeppelin/contracts@4.8.3`, we store its **entire package.json**:

```
.deps/npm/@openzeppelin/contracts@4.8.3/
├── package.json          ← CRITICAL: Preserved from npm
├── token/
│   └── ERC20/
│       ├── ERC20.sol
│       └── IERC20.sol
├── utils/
│   └── Context.sol
└── access/
    └── Ownable.sol
```

### Why This Matters

**Scenario:** ERC20.sol imports other files from the same package

```solidity
// Inside .deps/npm/@openzeppelin/contracts@4.8.3/token/ERC20/ERC20.sol
import "../../utils/Context.sol";      // Relative import
import "../IERC20.sol";                 // Relative import
```

**How it resolves:**

1. **Compiler sees relative import** `../../utils/Context.sol`
2. **Resolves relative to current file location:**
   - Current: `.deps/npm/@openzeppelin/contracts@4.8.3/token/ERC20/ERC20.sol`
   - Target: `.deps/npm/@openzeppelin/contracts@4.8.3/utils/Context.sol`
3. **File exists!** ✅ Because we stored the entire package structure

### What If Context.sol Has Dependencies?

```solidity
// Inside .deps/npm/@openzeppelin/contracts@4.8.3/utils/Context.sol
// (Hypothetically, if it had external deps)
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
```

**The resolver handles this too:**

1. Detects new npm import `@openzeppelin/contracts-upgradeable`
2. Resolves version (using same priority system)
3. Fetches to `.deps/npm/@openzeppelin/contracts-upgradeable@4.8.3/`
4. Rewrites import path
5. Compilation continues ✅

---

## Detailed Flow: Real Example

### User's Contract
```solidity
// contracts/MyToken.sol
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    constructor() ERC20("MyToken", "MTK") {}
}
```

### Workspace Setup
```json
// package.json
{
  "name": "my-project",
  "dependencies": {
    "@openzeppelin/contracts": "4.8.3"
  }
}
```

### Step-by-Step Resolution

#### Step 1: Extract Package Name
```typescript
extractPackageName("@openzeppelin/contracts/token/ERC20/ERC20.sol")
// Returns: "@openzeppelin/contracts"
```

#### Step 2: Resolve Version
```typescript
async resolvePackageVersion("@openzeppelin/contracts") {
  // Priority 1: Check workspace resolutions/overrides
  if (this.workspaceResolutions.has(packageName)) {
    // Not found in resolutions
  }
  
  // Priority 2: Reload lock files FRESH
  await this.loadLockFileVersions()
  this.lockFileVersions.clear()  // Clear stale cache
  
  // Parse yarn.lock or package-lock.json
  // Not found: no lock file exists
  
  // Priority 3: Check workspace dependencies
  // Found! package.json has "4.8.3" (exact version)
  return { version: "4.8.3", source: "workspace" }
}
```

**Result:** Version `4.8.3` from workspace package.json

#### Step 3: Fetch Package from NPM
```typescript
await fetchPackageVersionFromNpm("@openzeppelin/contracts")
// GET https://unpkg.com/@openzeppelin/contracts@4.8.3/package.json
// Download entire package structure
```

#### Step 4: Store with Version Suffix
```
.deps/npm/@openzeppelin/contracts@4.8.3/
├── package.json              ← Full metadata
├── token/
│   └── ERC20/
│       ├── ERC20.sol        ← Target file
│       ├── IERC20.sol       ← Dependency of ERC20.sol
│       └── extensions/
│           └── IERC20Metadata.sol
├── utils/
│   └── Context.sol          ← Dependency of ERC20.sol
└── access/
    └── Ownable.sol
```

#### Step 5: Rewrite Import
```typescript
// Original import
"@openzeppelin/contracts/token/ERC20/ERC20.sol"

// Rewritten to
".deps/npm/@openzeppelin/contracts@4.8.3/token/ERC20/ERC20.sol"
```

#### Step 6: Compilation Continues
```solidity
// Compiler now reads:
// .deps/npm/@openzeppelin/contracts@4.8.3/token/ERC20/ERC20.sol

// Which contains:
import "../../utils/Context.sol";  // Resolves to:
// .deps/npm/@openzeppelin/contracts@4.8.3/utils/Context.sol ✅

import "./IERC20.sol";  // Resolves to:
// .deps/npm/@openzeppelin/contracts@4.8.3/token/ERC20/IERC20.sol ✅
```

**✅ All dependencies resolved correctly!**

---

## Key Design Decisions

### 1. Versioned Folder Names: `@openzeppelin/contracts@4.8.3/`

**Why?**
- **Canonical versioning:** One version per package
- **No conflicts:** Multiple major versions can coexist (e.g., `@4.8.3` and `@5.0.0`)
- **Deterministic:** Same version = same folder every time
- **Debugging:** Easy to see which version is being used

**Alternative considered:** Non-versioned paths
- ❌ Version conflicts
- ❌ Cache invalidation issues
- ❌ Unclear which version is active

### 2. Dynamic Lock File Reloading

**Why reload on every resolution?**
```typescript
private async resolvePackageVersion(packageName: string) {
  // ...
  await this.loadLockFileVersions()  // FRESH reload every time
  // ...
}
```

**Benefits:**
- ✅ Changes to lock files picked up immediately
- ✅ No stale cache issues
- ✅ Supports workflow: add lock file → recompile → works

**Cost:**
- File read operation (~100KB)
- Parsing (~10ms)
- **Negligible overhead** compared to npm fetch

### 3. Package.json Preservation

**Why store the entire package.json?**
```
.deps/npm/@openzeppelin/contracts@4.8.3/package.json
```

**Reasons:**
1. **Metadata:** Name, version, dependencies visible
2. **Debugging:** Easy to inspect what was downloaded
3. **Future features:** Could analyze peer dependencies
4. **Standard practice:** Matches node_modules structure

### 4. Priority-Based Resolution

**Why this order?**
```
1. Workspace resolutions/overrides  (highest)
2. Workspace dependencies (exact)
3. Lock files
4. NPM registry (fallback)
```

**Rationale:**
- **Developer intent:** Explicit overrides take precedence
- **Team collaboration:** Lock files ensure consistency
- **Fallback:** NPM works even without lock files (backward compatible)

---

## Edge Cases Handled

### 1. Multiple Imports of Same Package

**Scenario:**
```solidity
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
```

**Resolution:**
- ✅ Detects same package name
- ✅ Uses cached version resolution
- ✅ Both imports rewritten to same versioned folder
- ✅ Package fetched only once

### 2. Explicit Version in Import

**Scenario:**
```solidity
import "@openzeppelin/contracts@5.0.0/token/ERC20/ERC20.sol";
```

**Resolution:**
- ✅ Extracts explicit version: `5.0.0`
- ✅ Bypasses workspace package.json
- ✅ Fetches requested version
- ✅ Stores in separate folder: `@openzeppelin/contracts@5.0.0/`

### 3. Lock File Changes During Session

**Scenario:**
1. User compiles (no lock file) → uses latest from npm
2. User adds yarn.lock with version 4.9.6
3. User recompiles

**Resolution:**
- ✅ Lock file reloaded fresh on second compilation
- ✅ New version 4.9.6 detected
- ✅ New folder created: `@openzeppelin/contracts@4.9.6/`
- ✅ Import rewritten to new version

### 4. Transitive Dependencies with Different Versions

**Scenario:**
```
MyContract imports @openzeppelin/contracts@4.8.3
  └─ ERC20.sol imports @openzeppelin/contracts-upgradeable@4.8.3
       └─ ERC20Upgradeable.sol imports @openzeppelin/contracts@4.8.3
```

**Resolution:**
- ✅ Each package resolves independently
- ✅ Same version = same folder (deduplication)
- ✅ Different packages = different folders
- ✅ No circular dependency issues (compiler handles)

---

## Performance Characteristics

### Time Complexity
- **Package name extraction:** O(1)
- **Version resolution:** O(1) - Map lookups
- **Lock file parsing:** O(n) where n = lock file lines (~100-1000)
- **NPM fetch:** O(network) - varies by package size

### Space Complexity
- **In-memory maps:** O(p) where p = unique packages
- **Disk storage:** O(p × s) where s = package size

### Caching Strategy
- **Version resolutions:** Cached per ImportResolver instance
- **Package files:** Cached on disk (`.deps/npm/`)
- **Lock files:** Re-parsed on each resolution (by design)

### Optimization Opportunities
- ✅ **Already optimized:** Map-based lookups
- ✅ **Already optimized:** Disk caching
- 🔄 **Possible:** In-memory lock file cache with file watcher
- 🔄 **Possible:** Parallel npm fetches for multiple packages

---

## Comparison with Other Systems

### vs. Node.js node_modules
| Feature | Import Resolver | node_modules |
|---------|----------------|--------------|
| Versioned paths | ✅ `@4.8.3/` suffix | ❌ Nested in node_modules |
| Lock file support | ✅ yarn.lock, package-lock.json | ✅ Same |
| Workspace overrides | ✅ resolutions/overrides | ✅ Same |
| Transitive deps | ✅ Preserved structure | ✅ Nested or flattened |
| Deduplication | ✅ One version per package | ✅ Hoisting |
| Dynamic reload | ✅ On each resolution | ❌ Requires npm install |

### vs. Hardhat/Foundry
| Feature | Import Resolver | Hardhat | Foundry |
|---------|----------------|---------|---------|
| Lock file support | ✅ Dynamic | ✅ Static | ✅ Static |
| Browser-based | ✅ Yes | ❌ CLI only | ❌ CLI only |
| Version visibility | ✅ Folder names | ⚠️ Hidden | ⚠️ Hidden |
| Online resolution | ✅ NPM on-demand | ❌ Requires install | ❌ Requires install |

---

## Testing Strategy

### Unit Tests
- Extract package name (scoped, unscoped, versioned)
- Parse yarn.lock (v1 format, scoped packages)
- Parse package-lock.json (v1, v2, v3 formats)
- Version resolution priority

### Integration Tests (E2E)
- **Group 1:** Versioned folder structure
- **Group 2:** Workspace package.json + dynamic changes
- **Group 3:** Deduplication of explicit versions
- **Group 4:** Version override (workspace vs explicit)
- **Group 5:** yarn.lock resolution
- **Group 6:** package-lock.json resolution

### Manual Testing
- Add lock file mid-session
- Change lock file version
- Multiple packages with transitive deps
- Version conflicts

---

## Backward Compatibility

### Non-Breaking Changes
- ✅ Works without lock files (NPM fallback)
- ✅ Works without package.json (NPM fallback)
- ✅ Existing imports continue to work
- ✅ `.deps` folder structure backward compatible (just adds `@version`)

### Migration Path
1. **Day 1:** Users see versioned folders (e.g., `@4.8.3/`)
2. **Optional:** Users add lock files for determinism
3. **Optional:** Users add package.json for workspace control
4. **Future:** Could add UI to manage versions

---

## Future Enhancements

### Possible Additions
1. **Version conflict resolution UI**
   - Show which versions are being used
   - Allow user to select preferred version

2. **Peer dependency warnings**
   - Check peer dependencies in package.json
   - Warn if version mismatches detected

3. **Lock file generation**
   - Auto-generate lock file from resolved versions
   - Useful for teams without lock files

4. **Version range resolution**
   - Smart resolution of `^4.8.0` without lock file
   - Could use npm API to find "best" version

5. **Monorepo support**
   - Handle workspace:* protocol
   - Support pnpm workspaces

---

## Conclusion

The Import Resolver provides **deterministic, transparent, and standards-compliant** dependency resolution for Solidity in the browser. It:

1. ✅ Solves the "which version" problem with canonical versioning
2. ✅ Supports modern workflows with lock files
3. ✅ Handles transitive dependencies correctly via package.json preservation
4. ✅ Works seamlessly without configuration (NPM fallback)
5. ✅ Adapts to changes dynamically (lock file reloading)

**The key insight:** By storing packages with version suffixes and preserving their package.json, we create a structure that "just works" for the Solidity compiler while maintaining the benefits of modern JavaScript dependency management.

---

## Quick Reference

### For Users
```
1. Add package.json → pins exact versions
2. Add yarn.lock → ensures team consistency  
3. Explicit @version → overrides everything
```

### For Developers
```typescript
// Resolution flow
extractPackageName() → resolvePackageVersion() → fetchAndStore() → rewriteImport()

// Priority
workspace resolutions > workspace deps > lock files > npm

// Caching
In-memory: version resolutions
On-disk: package files
Fresh: lock files (reloaded each time)
```

### For Reviewers
```
✅ Deterministic builds
✅ Standards-compliant (follows npm/yarn)
✅ Backward compatible
✅ Well-tested (6 E2E test groups)
✅ Clear debugging (versioned folder names)
```
