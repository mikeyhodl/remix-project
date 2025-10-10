# Context-Aware Dependency Resolution Strategy

## The Problem

When compiling Solidity contracts with npm package imports, the Solidity compiler provides a "missing imports" callback that only gives us:
- ❌ The missing import path (e.g., `@chainlink/contracts/src/v0.8/token/IERC20.sol`)
- ❌ NO information about which file requested it

This creates ambiguity when:
1. Multiple parent packages depend on different versions of the same package
2. We need to resolve unversioned imports based on their parent's `package.json`

### Real-World Example

```solidity
// MyContract.sol
import "@chainlink/contracts-ccip@1.6.1/src/v0.8/ccip/Router.sol";
import "@chainlink/contracts-ccip@1.6.2/src/v0.8/ccip/libraries/Client.sol";
```

Where:
- `contracts-ccip@1.6.1/package.json` → `"@chainlink/contracts": "^1.4.0"`
- `contracts-ccip@1.6.2/package.json` → `"@chainlink/contracts": "^1.5.0"`

When `Router.sol` imports `@chainlink/contracts/...` (unversioned), should we resolve to 1.4.0 or 1.5.0?

**Old approach:** Use LIFO (most recent parent) → **WRONG!** Might pick the wrong version
**New approach:** Track which file requests what → **CORRECT!** Use the requesting file's package context

---

## The Solution: Pre-Compilation Dependency Tree Builder

Instead of relying on the compiler's missing imports callback, we **build our own dependency tree BEFORE compilation**.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      DependencyResolver                          │
│  (Pre-compilation dependency tree builder)                      │
│                                                                   │
│  1. Start from entry file (e.g., MyContract.sol)                │
│  2. Fetch content                                                │
│  3. Extract imports using regex                                  │
│  4. For each import:                                             │
│     a. Track: "File X requests import Y"                        │
│     b. Determine package context of File X                      │
│     c. Tell ImportResolver: "Use context of File X"             │
│     d. Resolve import Y with full context                       │
│     e. Recursively process imported file                        │
│  5. Build complete source bundle                                │
│  6. Pass to Solidity compiler                                   │
└─────────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      ImportResolver                              │
│  (Context-aware version resolution)                             │
│                                                                   │
│  Priority waterfall:                                             │
│  1. Workspace resolutions (package.json)                        │
│  2. Parent package dependencies ← NOW CONTEXT-AWARE!            │
│  3. Lock files (yarn.lock / package-lock.json)                  │
│  4. NPM registry (fallback)                                     │
│                                                                   │
│  New method: setPackageContext(packageContext)                  │
│  - Called by DependencyResolver before each resolution          │
│  - Tells resolver: "I'm resolving from within package X@Y"      │
│  - findParentPackageContext() uses this for accurate lookup     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. **DependencyResolver** (NEW!)
`libs/remix-solidity/src/compiler/dependency-resolver.ts`

**Purpose:** Pre-compilation import tree walker

**Responsibilities:**
- Walk the import graph manually (before compilation)
- Track: `File A → imports B` (the missing context!)
- Extract package context from file paths
- Set context before resolving each import
- Build complete source bundle
- Provide compiler-ready input

**Key Methods:**
- `buildDependencyTree(entryFile)` - Main entry point
- `processFile(importPath, requestingFile, packageContext)` - Recursive import processor
- `extractImports(content)` - Regex-based import extraction
- `extractPackageContext(path)` - Extract `package@version` from path
- `toCompilerInput()` - Convert to Solidity compiler format

### 2. **ImportResolver** (ENHANCED!)
`libs/remix-solidity/src/compiler/import-resolver.ts`

**Purpose:** Context-aware version resolution

**New Methods:**
- `setPackageContext(packageContext)` - Set explicit resolution context
- `getResolution(originalImport)` - Get resolved path for import

**Enhanced Methods:**
- `findParentPackageContext()` - Now checks explicit context first
- All existing resolution logic remains unchanged

---

## How It Works: Step-by-Step

### Scenario: Resolving `@chainlink/contracts` from two different parent versions

```
Step 1: DependencyResolver starts with MyContract.sol
  └─ Extracts imports:
     - "@chainlink/contracts-ccip@1.6.1/src/v0.8/ccip/Router.sol"
     - "@chainlink/contracts-ccip@1.6.2/src/v0.8/ccip/libraries/Client.sol"

Step 2: Process Router.sol
  └─ Package context: "@chainlink/contracts-ccip@1.6.1"
  └─ Set context: resolver.setPackageContext("@chainlink/contracts-ccip@1.6.1")
  └─ Fetch content
  └─ Extract imports: "@chainlink/contracts/src/v0.8/token/IERC20.sol"
  
Step 3: Resolve IERC20.sol (requested by Router.sol)
  └─ Current context: "@chainlink/contracts-ccip@1.6.1"
  └─ ImportResolver checks parent deps: contracts-ccip@1.6.1 → contracts@1.4.0
  └─ Resolves to: "@chainlink/contracts@1.4.0/src/v0.8/token/IERC20.sol" ✅

Step 4: Process Client.sol
  └─ Package context: "@chainlink/contracts-ccip@1.6.2"
  └─ Set context: resolver.setPackageContext("@chainlink/contracts-ccip@1.6.2")
  └─ Fetch content
  └─ Extract imports: "@chainlink/contracts/src/v0.8/shared/access/OwnerIsCreator.sol"

Step 5: Resolve OwnerIsCreator.sol (requested by Client.sol)
  └─ Current context: "@chainlink/contracts-ccip@1.6.2"
  └─ ImportResolver checks parent deps: contracts-ccip@1.6.2 → contracts@1.5.0
  └─ Resolves to: "@chainlink/contracts@1.5.0/src/v0.8/shared/access/OwnerIsCreator.sol" ✅

Step 6: Build source bundle
  └─ MyContract.sol
  └─ @chainlink/contracts-ccip@1.6.1/src/v0.8/ccip/Router.sol
  └─ @chainlink/contracts@1.4.0/src/v0.8/token/IERC20.sol
  └─ @chainlink/contracts-ccip@1.6.2/src/v0.8/ccip/libraries/Client.sol
  └─ @chainlink/contracts@1.5.0/src/v0.8/shared/access/OwnerIsCreator.sol

Step 7: Pass to Solidity compiler
  └─ Compilation succeeds! ✅
  └─ No duplicate declarations (different files from different versions)
```

---

## Migration Guide

### Old Approach (Compiler Callback)
```typescript
// Compiler calls missing imports callback
compiler.compile(sources, {
  import: async (path: string) => {
    // ❌ We don't know which file requested this import!
    const content = await importResolver.resolveAndSave(path)
    return { contents: content }
  }
})
```

### New Approach (Pre-Compilation Builder)
```typescript
import { DependencyResolver } from './dependency-resolver'

// 1. Build dependency tree BEFORE compilation
const depResolver = new DependencyResolver(pluginApi, entryFile)
const sourceBundle = await depResolver.buildDependencyTree(entryFile)

// 2. Get compiler-ready input
const compilerInput = depResolver.toCompilerInput()

// 3. Compile with complete source bundle (no missing imports!)
const output = await compiler.compile({
  sources: compilerInput,
  settings: { ... }
})
```

---

## Benefits

1. ✅ **Context-Aware Resolution**
   - Know exactly which file requests each import
   - Use the requesting file's package context
   - Accurate parent dependency resolution

2. ✅ **Multi-Version Support**
   - Different parent packages can use different versions of the same dependency
   - No conflicts as long as they import different files
   - Compiler receives the correct version for each import

3. ✅ **Better Error Messages**
   - Can warn when multiple parent packages conflict
   - Show user exactly which file needs which version
   - Suggest actionable solutions

4. ✅ **Predictable Behavior**
   - No LIFO heuristics (which might be wrong)
   - Deterministic resolution based on actual package dependencies
   - Same result every time

5. ✅ **Full Import Graph Visibility**
   - Track complete dependency tree
   - Debug import issues easily
   - Understand what the compiler will receive

---

## Edge Cases Handled

### Case 1: Two parent packages, same child dependency, different versions
**Solution:** Context-aware resolution uses the correct parent's package.json

### Case 2: Circular imports
**Solution:** `processedFiles` Set prevents infinite loops

### Case 3: Missing files
**Solution:** Graceful error handling, continues processing other imports

### Case 4: Workspace overrides
**Solution:** Priority 1 in resolution waterfall (overrides everything)

---

## Future Enhancements

1. **Parallel Processing**
   - Process independent imports concurrently
   - Faster build times for large projects

2. **Caching**
   - Cache processed files across compilations
   - Only re-process changed files

3. **Conflict Detection**
   - Warn when same file imported from multiple versions
   - Suggest refactoring strategies

4. **Visualization**
   - Generate import graph visualizations
   - Show dependency tree in IDE

---

## Testing

See `importResolver.test.ts` for test cases including:
- ✅ Basic resolution
- ✅ Explicit versioned imports
- ✅ Parent dependency resolution
- ✅ Chainlink CCIP scenario (multi-parent)
- ✅ Workspace resolutions
- ✅ Lock file versions

---

## Files Changed

1. **NEW:** `libs/remix-solidity/src/compiler/dependency-resolver.ts`
   - Pre-compilation dependency tree builder

2. **ENHANCED:** `libs/remix-solidity/src/compiler/import-resolver.ts`
   - Added `setPackageContext()` method
   - Enhanced `findParentPackageContext()` to check explicit context
   - Added `getResolution()` method
   - Added conflict warning for multi-parent dependencies

3. **NEW:** `libs/remix-solidity/src/compiler/dependency-resolver.example.ts`
   - Example usage documentation

---

## Summary

The new **DependencyResolver** gives us the missing piece: **which file requests which import**.

By building the dependency tree ourselves (instead of relying on the compiler), we can:
- Track the full import graph
- Resolve imports with complete context
- Support multiple versions of parent packages
- Provide better error messages
- Ensure deterministic, predictable behavior

This is a **game-changer** for complex dependency scenarios! 🎉
