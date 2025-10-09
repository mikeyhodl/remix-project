# Import Resolver: Visual Flow Diagrams

## 1. High-Level Resolution Flow

```mermaid
graph TB
    A[Solidity Import] --> B{Extract Package Name}
    B --> C[Resolve Version]
    C --> D{Check Priority}
    
    D -->|1. Highest| E[Workspace Resolutions]
    D -->|2. High| F[Workspace Dependencies]
    D -->|3. Medium| G[Lock Files]
    D -->|4. Fallback| H[NPM Registry]
    
    E --> I{Found?}
    F --> I
    G --> I
    H --> I
    
    I -->|Yes| J[Canonical Version]
    I -->|No| K[Try Next Priority]
    K --> D
    
    J --> L[Fetch & Store]
    L --> M[.deps/npm/package@version/]
    M --> N[Rewrite Import Path]
    N --> O[Compilation Continues]
```

## 2. Detailed Resolution Priority

```
┌─────────────────────────────────────────────────────────┐
│              IMPORT: @openzeppelin/contracts            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  PRIORITY 1: Workspace     │
        │  resolutions/overrides     │
        │                            │
        │  package.json:             │
        │  {                         │
        │    "resolutions": {        │
        │      "@openzeppelin/       │
        │       contracts": "4.9.0"  │
        │    }                       │
        │  }                         │
        └────────┬───────────────────┘
                 │
                 │ Found? ────Yes────┐
                 │                   │
                 No                  │
                 │                   │
                 ▼                   │
        ┌────────────────────────────┐│
        │  PRIORITY 2: Workspace     ││
        │  dependencies (exact)      ││
        │                            ││
        │  package.json:             ││
        │  {                         ││
        │    "dependencies": {       ││
        │      "@openzeppelin/       ││
        │       contracts": "4.8.3"  ││ <- Exact version!
        │    }                       ││
        │  }                         ││
        └────────┬───────────────────┘│
                 │                    │
                 │ Found? ────Yes─────┤
                 │                    │
                 No                   │
                 │                    │
                 ▼                    │
        ┌────────────────────────────┐│
        │  PRIORITY 3: Lock Files    ││
        │  (FRESH reload)            ││
        │                            ││
        │  yarn.lock:                ││
        │  "@openzeppelin/contracts@ ││
        │   ^4.9.0":                 ││
        │    version "4.9.6"         ││
        │                            ││
        │  OR                        ││
        │                            ││
        │  package-lock.json:        ││
        │  "node_modules/@openzep... ││
        │    version": "4.9.6"       ││
        └────────┬───────────────────┘│
                 │                    │
                 │ Found? ────Yes─────┤
                 │                    │
                 No                   │
                 │                    │
                 ▼                    │
        ┌────────────────────────────┐│
        │  PRIORITY 4: NPM Registry  ││
        │  (fallback)                ││
        │                            ││
        │  GET unpkg.com/            ││
        │   @openzeppelin/contracts@ ││
        │    latest/package.json     ││
        │                            ││
        │  Returns: "5.1.0"          ││
        └────────┬───────────────────┘│
                 │                    │
                 │ Always succeeds    │
                 │                    │
                 └────────────────────┤
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │  CANONICAL VERSION SELECTED     │
                    │                                 │
                    │  @openzeppelin/contracts@4.8.3  │
                    └─────────────────────────────────┘
```

## 3. Transitive Dependency Resolution

```
User Contract (MyToken.sol)
│
├─ import "@openzeppelin/contracts/token/ERC20/ERC20.sol"
│   │
│   │ [IMPORT RESOLVER]
│   │ 1. Extract: "@openzeppelin/contracts"
│   │ 2. Resolve: version "4.8.3"
│   │ 3. Fetch from npm
│   │ 4. Store: .deps/npm/@openzeppelin/contracts@4.8.3/
│   │ 5. Rewrite: ".deps/npm/@openzeppelin/contracts@4.8.3/token/ERC20/ERC20.sol"
│   │
│   └─► .deps/npm/@openzeppelin/contracts@4.8.3/token/ERC20/ERC20.sol
       │
       ├─ import "../../utils/Context.sol"  [RELATIVE]
       │   │
       │   │ [COMPILER RESOLUTION - No Import Resolver]
       │   │ Base: .deps/npm/@openzeppelin/contracts@4.8.3/token/ERC20/
       │   │ Target: ../../utils/Context.sol
       │   │ Result: .deps/npm/@openzeppelin/contracts@4.8.3/utils/Context.sol
       │   │
       │   └─► ✅ File exists! (We stored entire package)
       │
       ├─ import "./IERC20.sol"  [RELATIVE]
       │   │
       │   │ [COMPILER RESOLUTION]
       │   │ Base: .deps/npm/@openzeppelin/contracts@4.8.3/token/ERC20/
       │   │ Target: ./IERC20.sol
       │   │ Result: .deps/npm/@openzeppelin/contracts@4.8.3/token/ERC20/IERC20.sol
       │   │
       │   └─► ✅ File exists!
       │
       └─ import "./extensions/IERC20Metadata.sol"  [RELATIVE]
           │
           │ [COMPILER RESOLUTION]
           │ Result: .deps/npm/@openzeppelin/contracts@4.8.3/token/ERC20/extensions/IERC20Metadata.sol
           │
           └─► ✅ File exists!

All imports resolved! Compilation succeeds! 🎉
```

## 4. Lock File Dynamic Reloading

```
TIME: T0 (Initial Compilation)
────────────────────────────────────────────────
Workspace:
  ├─ MyToken.sol
  └─ [No lock file]

Import Resolver:
  1. Extract: "@openzeppelin/contracts"
  2. Check priorities:
     ☐ Workspace resolutions: Not found
     ☐ Workspace dependencies: Not found
     ☐ Lock files: loadLockFileVersions()
                   → No yarn.lock ❌
                   → No package-lock.json ❌
     ☑ NPM: Fetch latest → "5.1.0"
  
  3. Store: .deps/npm/@openzeppelin/contracts@5.1.0/

Result: Uses version 5.1.0 ✅


TIME: T1 (User adds lock file)
────────────────────────────────────────────────
Workspace:
  ├─ MyToken.sol
  └─ yarn.lock  ← NEW!
      "@openzeppelin/contracts@^4.9.0":
        version "4.9.6"

[No recompilation yet - lock file not used]


TIME: T2 (User recompiles)
────────────────────────────────────────────────
Import Resolver:
  1. Extract: "@openzeppelin/contracts"
  2. Check priorities:
     ☐ Workspace resolutions: Not found
     ☐ Workspace dependencies: Not found
     ☑ Lock files: loadLockFileVersions()
                   → Clear cache! (stale versions removed)
                   → Read yarn.lock from disk
                   → Parse: "4.9.6" found! ✅
  
  3. Store: .deps/npm/@openzeppelin/contracts@4.9.6/

Result: Uses version 4.9.6 from lock file! 🎉


TIME: T3 (User modifies lock file)
────────────────────────────────────────────────
Workspace:
  ├─ MyToken.sol
  └─ yarn.lock  ← MODIFIED!
      "@openzeppelin/contracts@^4.7.0":
        version "4.7.3"  ← Changed!

[Recompilation triggered]

Import Resolver:
  1. Extract: "@openzeppelin/contracts"
  2. Check priorities:
     ☑ Lock files: loadLockFileVersions()
                   → Clear cache!
                   → Read yarn.lock from disk ← FRESH!
                   → Parse: "4.7.3" found! ✅
  
  3. Store: .deps/npm/@openzeppelin/contracts@4.7.3/

Result: Uses NEW version 4.7.3! 🚀
No cache staleness! Dynamic reload works!
```

## 5. Deduplication Strategy

```
Scenario: Multiple imports of same package
───────────────────────────────────────────────

Contract1.sol:
  import "@openzeppelin/contracts@4.8.3/token/ERC20/ERC20.sol"
  
Contract2.sol:
  import "@openzeppelin/contracts/token/ERC20/ERC20.sol"
  (workspace package.json specifies 4.8.3)
  
Contract3.sol:
  import "@openzeppelin/contracts@4.8.3/access/Ownable.sol"


Resolution Flow:
────────────────

1. Contract1.sol compiled:
   ┌─────────────────────────────────┐
   │ Import with explicit @4.8.3     │
   │ Extract: "@openzeppelin/         │
   │          contracts"              │
   │ Explicit version: "4.8.3"       │
   │                                  │
   │ Skip resolution priorities!      │
   │ Use explicit: "4.8.3"            │
   │                                  │
   │ Store: .deps/npm/@openzeppelin/  │
   │        contracts@4.8.3/          │
   └─────────────────────────────────┘

2. Contract2.sol compiled:
   ┌─────────────────────────────────┐
   │ Import without version           │
   │ Extract: "@openzeppelin/         │
   │          contracts"              │
   │                                  │
   │ Check priorities:                │
   │ ☑ Workspace deps: "4.8.3" ✅     │
   │                                  │
   │ Target: .deps/npm/@openzeppelin/ │
   │         contracts@4.8.3/         │
   │                                  │
   │ Already exists! ✅               │
   │ Reuse existing folder!           │
   └─────────────────────────────────┘

3. Contract3.sol compiled:
   ┌─────────────────────────────────┐
   │ Import with explicit @4.8.3     │
   │ Different file path but same     │
   │ package and version              │
   │                                  │
   │ Target: .deps/npm/@openzeppelin/ │
   │         contracts@4.8.3/         │
   │                                  │
   │ Already exists! ✅               │
   │ Reuse existing folder!           │
   └─────────────────────────────────┘


Final State:
────────────
.deps/
└── npm/
    └── @openzeppelin/
        └── contracts@4.8.3/  ← ONE folder
            ├── token/ERC20/ERC20.sol
            ├── access/Ownable.sol
            └── package.json

✅ Deduplication successful!
✅ One version, one folder, multiple imports
✅ Disk space saved
✅ Compilation faster (no duplicate fetches)
```

## 6. Version Conflict Handling

```
Scenario: Same package, different versions
───────────────────────────────────────────

workspace package.json:
  "@openzeppelin/contracts": "4.8.3"

Contract.sol:
  import "@openzeppelin/contracts@5.0.0/token/ERC20/IERC20.sol"


Resolution:
───────────

User Import (explicit @5.0.0):
  ┌────────────────────────────────┐
  │ Explicit version takes priority│
  │ Version: "5.0.0"               │
  │ Fetch from npm                 │
  │                                │
  │ Store: .deps/npm/@openzeppelin/│
  │        contracts@5.0.0/        │
  └────────────────────────────────┘

Background Dependencies (from package.json):
  ┌────────────────────────────────┐
  │ Different import path          │
  │ Version: "4.8.3"               │
  │                                │
  │ Store: .deps/npm/@openzeppelin/│
  │        contracts@4.8.3/        │
  └────────────────────────────────┘


Final State:
────────────
.deps/
└── npm/
    └── @openzeppelin/
        ├── contracts@4.8.3/  ← Workspace version
        │   └── ...
        └── contracts@5.0.0/  ← Explicit version
            └── ...

✅ Both versions coexist peacefully!
✅ No conflicts (different folders)
✅ User gets what they asked for
⚠️  Warning logged about version mismatch
```

## 7. Class Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ImportResolver                         │
│                                                             │
│  Properties:                                                │
│  ├─ workspaceResolutions: Map<pkg, version>                │
│  ├─ lockFileVersions: Map<pkg, version>                    │
│  ├─ importMappings: Map<pkg, versionedPkg>                 │
│  ├─ importedFiles: Map<path, version>                      │
│  └─ packageSources: Map<pkg, source>                       │
│                                                             │
│  Methods:                                                   │
│  ├─ initializeWorkspaceResolutions()                       │
│  │   └─> loadWorkspaceResolutions()                        │
│  │   └─> loadLockFileVersions()                            │
│  │       ├─> parseYarnLock()                               │
│  │       └─> parsePackageLock()                            │
│  │                                                          │
│  ├─ resolve(url: string)  [Main entry point]               │
│  │   └─> extractPackageName()                              │
│  │   └─> resolvePackageVersion()                           │
│  │       └─> loadLockFileVersions()  [FRESH reload]        │
│  │   └─> fetchAndMapPackage()                              │
│  │   └─> rewriteImportPath()                               │
│  │                                                          │
│  └─ Static:                                                 │
│      └─ resolutionIndex: ResolutionIndex  [Shared]         │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ Uses
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      ResolutionIndex                        │
│                                                             │
│  Manages .deps/ folder structure                            │
│  ├─ Tracks loaded packages                                  │
│  ├─ Handles file system operations                          │
│  └─ Watches for workspace changes                           │
└─────────────────────────────────────────────────────────────┘
```

## 8. Data Flow

```
┌─────────┐
│  User   │
│ Contract│
└────┬────┘
     │ import "@openzeppelin/contracts/..."
     ▼
┌─────────────────┐
│   Compiler      │
│   (solc)        │
└────┬────────────┘
     │ callback: resolve import
     ▼
┌─────────────────────────────────────────────┐
│           Import Resolver                   │
│  resolve(url)                               │
│    ├─ extractPackageName(url)               │
│    │   Input: "@openzeppelin/contracts/..." │
│    │   Output: "@openzeppelin/contracts"    │
│    │                                         │
│    ├─ resolvePackageVersion(pkg)            │
│    │   │                                     │
│    │   ├─ Check workspaceResolutions        │
│    │   │   ├─ Read: package.json            │
│    │   │   └─ resolutions/overrides          │
│    │   │                                     │
│    │   ├─ loadLockFileVersions()            │
│    │   │   ├─ Clear lockFileVersions Map    │
│    │   │   ├─ Read: yarn.lock               │
│    │   │   └─ Read: package-lock.json       │
│    │   │                                     │
│    │   └─ fetchPackageVersionFromNpm()      │
│    │       └─ GET unpkg.com/.../package.json│
│    │                                         │
│    ├─ fetchAndMapPackage(pkg, version)      │
│    │   ├─ Download from unpkg.com           │
│    │   ├─ Store: .deps/npm/pkg@version/     │
│    │   └─ Save package.json                 │
│    │                                         │
│    └─ rewriteImportPath(url, version)       │
│        Input: "@openzeppelin/contracts/..." │
│        Output: ".deps/npm/@openzeppelin/    │
│                 contracts@4.8.3/..."         │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│           Compiler                          │
│  Reads: .deps/npm/@openzeppelin/            │
│         contracts@4.8.3/token/ERC20/        │
│         ERC20.sol                           │
│                                             │
│  Finds relative imports:                    │
│    ../../utils/Context.sol                  │
│    → .deps/npm/@openzeppelin/contracts@    │
│       4.8.3/utils/Context.sol ✅            │
└─────────────────────────────────────────────┘
```

---

These diagrams provide a visual representation of the Import Resolver's architecture and behavior. Use them to explain the system to your colleagues!
