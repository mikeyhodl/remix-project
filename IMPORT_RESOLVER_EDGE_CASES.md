# Import Resolver: Edge Cases & Failure Scenarios

## 🔴 Critical Edge Cases That Could Break

### 1. **Circular Dependencies Between Packages**

**Scenario:**
```
Package A@1.0.0 depends on Package B@2.0.0
Package B@2.0.0 depends on Package A@1.5.0
```

**What Could Fail:**
- Infinite recursion in `checkPackageDependencies()`
- Memory exhaustion from loading circular deps
- Version conflict detection might loop

**Current Protection:**
```typescript
// ✅ PROTECTED: We only check dependencies if ALREADY mapped
if (!this.importMappings.has(depMappingKey)) return
```

**Potential Weakness:**
- If both packages are actually imported, we could still generate confusing warnings
- No tracking of which packages we're currently checking (no visited set)

**Fix Needed:**
```typescript
private checkingDependencies = new Set<string>() // Track packages being checked

private async checkPackageDependencies(...) {
  if (this.checkingDependencies.has(packageName)) {
    console.log(`[ImportResolver] 🔁 Circular dependency detected, skipping: ${packageName}`)
    return
  }
  this.checkingDependencies.add(packageName)
  try {
    // ... existing code
  } finally {
    this.checkingDependencies.delete(packageName)
  }
}
```

---

### 2. **Monorepo Packages with Workspace Protocol**

**Scenario:**
```json
// package.json
{
  "dependencies": {
    "@mycompany/shared": "workspace:*",
    "@mycompany/utils": "workspace:^1.0.0"
  }
}
```

**What Could Fail:**
- `workspace:*` is not a valid version string
- `extractVersion()` returns null
- Resolver tries to fetch from npm instead of using local workspace package
- Compilation fails with "package not found on npm"

**Current Handling:**
```typescript
// ❌ NOT HANDLED: workspace protocol not recognized
if (versionRange.match(/^\d+\.\d+\.\d+$/)) {
  this.workspaceResolutions.set(pkg, versionRange)
}
```

**Fix Needed:**
```typescript
// In loadWorkspaceResolutions()
if (versionRange.startsWith('workspace:')) {
  // For workspace packages, need to resolve from local file system
  const localVersion = await this.resolveWorkspacePackageVersion(pkg)
  if (localVersion) {
    this.workspaceResolutions.set(pkg, localVersion)
  }
  continue
}
```

---

### 3. **Lock File Version Ambiguity (Multiple Versions)**

**Scenario:**
```yaml
# yarn.lock
"@openzeppelin/contracts@^4.8.0":
  version "4.8.3"

"@openzeppelin/contracts@^4.9.0":
  version "4.9.6"

"@openzeppelin/contracts@^5.0.0":
  version "5.1.0"
```

**What Could Fail:**
- `parseYarnLock()` overwrites previous entry
- Last version wins (5.1.0) even if workspace package.json specifies ^4.8.0
- User imports old version files, gets new version instead
- Compilation errors due to API changes

**Current Behavior:**
```typescript
// ❌ LAST WRITE WINS
this.lockFileVersions.set(currentPackage, versionMatch[1])
```

**Fix Needed:**
```typescript
// Store ALL versions from lock file
private lockFileVersions: Map<string, string[]> = new Map() // Array of versions!

// Then resolve by matching against workspace package.json range
private resolveLockFileVersion(pkg: string, range?: string): string | null {
  const versions = this.lockFileVersions.get(pkg) || []
  if (versions.length === 0) return null
  if (versions.length === 1) return versions[0]
  
  // If we have a range from package.json, find matching version
  if (range) {
    return this.findMatchingVersion(versions, range)
  }
  
  // Fallback: use highest version
  return versions.sort(semverCompare).pop()
}
```

---

### 4. **NPM Package Name Case Sensitivity**

**Scenario:**
```solidity
import "@OpenZeppelin/Contracts/token/ERC20/ERC20.sol";
// Actual package name: @openzeppelin/contracts (lowercase)
```

**What Could Fail:**
- `extractPackageName()` returns `@OpenZeppelin/Contracts`
- npm fetch fails (404 - package not found)
- Compilation fails
- `.deps/npm/@OpenZeppelin/Contracts@...` created with wrong casing
- File system case-insensitive (macOS/Windows) but mapping keys case-sensitive

**Current Handling:**
```typescript
// ❌ NO CASE NORMALIZATION
const packageName = this.extractPackageName(url) // Keeps original casing
```

**Fix Needed:**
```typescript
private extractPackageName(url: string): string | null {
  const scopedMatch = url.match(/^(@[^/]+\/[^/@]+)/)
  if (scopedMatch) {
    return scopedMatch[1].toLowerCase() // ✅ Normalize to lowercase
  }
  
  const regularMatch = url.match(/^([^/@]+)/)
  if (regularMatch) {
    return regularMatch[1].toLowerCase() // ✅ Normalize to lowercase
  }
  
  return null
}
```

---

### 5. **Git Dependencies in package.json**

**Scenario:**
```json
{
  "dependencies": {
    "@openzeppelin/contracts": "git+https://github.com/OpenZeppelin/openzeppelin-contracts.git#v4.8.3"
  }
}
```

**What Could Fail:**
- `versionRange.match(/^\d+\.\d+\.\d+$/)` fails (not a version)
- Not recognized as exact version
- Lock file might have actual version "4.8.3" but package.json has git URL
- Resolver tries to fetch from npm, gets different version
- Version mismatch warnings

**Current Handling:**
```typescript
// ❌ NOT HANDLED: git URLs skipped
if (versionRange.match(/^\d+\.\d+\.\d+$/)) {
  this.workspaceResolutions.set(pkg, versionRange)
}
```

**Fix Needed:**
```typescript
// Parse git dependencies
if (versionRange.startsWith('git+') || versionRange.includes('github.com')) {
  // Extract version from git tag/branch if possible
  const tagMatch = versionRange.match(/#v?(\d+\.\d+\.\d+)/)
  if (tagMatch) {
    this.workspaceResolutions.set(pkg, tagMatch[1])
    console.log(`[ImportResolver] 📦 Git dependency detected: ${pkg}@${tagMatch[1]}`)
  } else {
    console.warn(`[ImportResolver] ⚠️  Git dependency without version tag: ${pkg}`)
  }
}
```

---

### 6. **Package Scopes with Slashes in Name**

**Scenario:**
```solidity
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
```

**What Could Fail:**
- Package name extraction might stop at first slash: `@openzeppelin/contracts-upgradeable` vs `@openzeppelin/contracts`
- Regex might not handle hyphens in package name properly

**Current Handling:**
```typescript
// ✅ SEEMS OK
const scopedMatch = url.match(/^(@[^/]+\/[^/@]+)/)
// Matches: @openzeppelin/contracts-upgradeable
```

**Potential Issue:**
- If package name has multiple slashes (unlikely but possible)
- Example: `@scope/sub/package` (not valid npm, but might exist)

---

### 7. **Unpkg CDN Failures / Rate Limiting**

**Scenario:**
- User imports 20 different packages rapidly
- unpkg.com returns 429 (Too Many Requests)
- Or 503 (Service Unavailable)

**What Could Fail:**
```typescript
// ❌ NO RETRY LOGIC
const content = await this.pluginApi.call('contentImport', 'resolve', packageJsonUrl)
// Throws on HTTP error, compilation fails
```

**Fix Needed:**
```typescript
private async fetchWithRetry(url: string, maxRetries = 3): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const content = await this.pluginApi.call('contentImport', 'resolve', url)
      return content
    } catch (err) {
      if (i === maxRetries - 1) throw err
      
      // Exponential backoff
      const delay = Math.pow(2, i) * 1000
      console.log(`[ImportResolver] ⏳ Retry ${i + 1}/${maxRetries} after ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
```

---

### 8. **Version String Edge Cases**

**Scenario:**
```json
{
  "dependencies": {
    "package-a": "latest",
    "package-b": "*",
    "package-c": "next",
    "package-d": "4.x",
    "package-e": "~4.8",
    "package-f": "4.8.x"
  }
}
```

**What Could Fail:**
- `extractVersion()` expects `\d+\.\d+\.\d+` format
- Returns null for "latest", "*", "next", "4.x", "~4.8"
- These are valid npm version ranges but not handled
- Resolver fetches from npm multiple times instead of deduplicating

**Current Handling:**
```typescript
// ❌ ONLY MATCHES FULL VERSION
if (versionRange.match(/^\d+\.\d+\.\d+$/)) {
  this.workspaceResolutions.set(pkg, versionRange)
}
```

**Fix Needed:**
- Must rely on lock file for these ranges
- Or fetch package.json from npm to resolve "latest"/"next"

---

### 9. **Lock File Format Variations**

**Scenario:**
```yaml
# yarn.lock v2 (Berry) format - DIFFERENT!
"@openzeppelin/contracts@npm:^4.8.0":
  version: 4.8.3
  resolution: "@openzeppelin/contracts@npm:4.8.3"
```

**What Could Fail:**
```typescript
// ❌ REGEX MIGHT NOT MATCH v2 FORMAT
const packageMatch = line.match(/^"?(@?[^"@]+(?:\/[^"@]+)?)@[^"]*"?:/)
// v2 has "npm:" prefix that might break extraction
```

**Fix Needed:**
```typescript
// Handle both yarn v1 and v2 formats
const packageMatch = line.match(/^"?(@?[^"@]+(?:\/[^"@]+)?)@(?:npm:)?[^"]*"?:/)
//                                                                ^^^^^^^ Optional npm: prefix
```

---

### 10. **Transitive Dependency Version Conflicts (Diamond Problem)**

**Scenario:**
```
Your Contract
├─ PackageA@1.0.0
│  └─ PackageC@2.0.0
└─ PackageB@1.0.0
   └─ PackageC@3.0.0
```

#### Case 1: Relative Imports (✅ SAFE - No Problem!)

**PackageA@1.0.0/TokenWrapper.sol:**
```solidity
import "../PackageC/ERC20.sol";  // Relative path
```

**What Happens:**
1. Solidity compiler resolves relative path from PackageA's location
2. Never triggers import resolver (it's a relative import!)
3. Looks for: `.deps/npm/PackageA@1.0.0/../PackageC/ERC20.sol`
4. File doesn't exist (PackageC is separate package)
5. ❌ Compilation fails with "File not found"

**Conclusion:** This is NOT how packages work in practice. PackageA won't have relative imports to external dependencies.

---

#### Case 2: NPM-style Imports - DIFFERENT FILES (✅ PROBABLY SAFE!)

**PackageA@1.0.0/TokenWrapper.sol:**
```solidity
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
```

**PackageB@1.0.0/Manager.sol:**
```solidity
import "@openzeppelin/contracts/access/Ownable.sol";  // DIFFERENT FILE!
```

**What Happens:**
1. First import triggers resolver → maps to `@openzeppelin/contracts@4.8.0`
2. Files fetched:
   - `.deps/npm/@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol`
   - `.deps/npm/@openzeppelin/contracts@4.8.0/access/Ownable.sol`
3. Second import (from PackageB) → sees package already mapped to 4.8.0
4. Uses existing mapping! (deduplication)
5. Files fetched:
   - `.deps/npm/@openzeppelin/contracts@4.8.0/access/Ownable.sol` (same folder!)

**Solidity Compiler:**
- Compiles `ERC20.sol` (from v4.8.0)
- Compiles `Ownable.sol` (from v4.8.0)
- Different files, no duplicate declarations
- ✅ **Compilation succeeds!**

**Conclusion:** If PackageA and PackageB import DIFFERENT files from PackageC, there's NO conflict because they're different compilation units.

---

#### Case 3: NPM-style Imports - SAME FILE (🟡 DEPENDS!)

**PackageA@1.0.0/TokenWrapper.sol:**
```solidity
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
```

**PackageB@1.0.0/Manager.sol:**
```solidity
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";  // SAME FILE!
```

**Your Contract.sol:**
```solidity
import "./PackageA/TokenWrapper.sol";
import "./PackageB/Manager.sol";
```

**What Happens:**

**Scenario A: Same Version Resolved (✅ SAFE)**
1. Both imports map to `@openzeppelin/contracts@4.8.0`
2. File path: `.deps/npm/@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol`
3. Solidity compiler sees SAME file imported twice
4. **Solidity deduplicates automatically!** (imports are idempotent)
5. `ERC20` contract defined only once in compilation
6. ✅ **Compilation succeeds!**

**Scenario B: Different Versions Resolved (🚨 BREAKS!)**
1. PackageA import → maps to `@openzeppelin/contracts@4.8.0`
2. PackageB import → maps to `@openzeppelin/contracts@5.0.0` (different version!)
3. Two files:
   - `.deps/npm/@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol`
   - `.deps/npm/@openzeppelin/contracts@5.0.0/token/ERC20/ERC20.sol`
4. Solidity compiler compiles BOTH files (different paths = different files)
5. Both define `contract ERC20 { ... }`
6. ❌ **Compilation fails: "DeclarationError: Identifier already declared"**

---

#### Case 4: Transitive Imports from Package's Internal Code (🟡 COMPLEX!)

**PackageA@1.0.0/TokenWrapper.sol:**
```solidity
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
```

**Inside @openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol:**
```solidity
import "../../utils/Context.sol";  // RELATIVE - stays within 4.8.0 folder ✅
import "./IERC20.sol";              // RELATIVE - stays within 4.8.0 folder ✅
```

**What Happens:**
1. Your contract imports PackageA
2. PackageA imports ERC20 from @openzeppelin/contracts → resolver maps to 4.8.0
3. ERC20.sol has RELATIVE imports
4. Relative imports resolved by compiler, NOT by import resolver
5. Stays within `.deps/npm/@openzeppelin/contracts@4.8.0/` folder
6. ✅ **No conflict! Works perfectly!**

**Why This Works:**
- We store ENTIRE package structure
- Relative imports never leave the package folder
- Each version is completely isolated

---

#### Case 5: Package Uses NPM-style Import for Its Own Dependency (🚨 POTENTIAL ISSUE!)

**Real-world example:**
```solidity
// PackageA@1.0.0/TokenWrapper.sol
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
```

**Inside contracts-upgradeable@4.8.0:**
```solidity
// ERC20Upgradeable.sol
import "@openzeppelin/contracts/utils/Context.sol";  // NPM import, NOT relative!
```

**PackageA's package.json:**
```json
{
  "dependencies": {
    "@openzeppelin/contracts": "4.8.0",      // PackageA wants 4.8.0
    "@openzeppelin/contracts-upgradeable": "4.8.0"
  }
}
```

**Your workspace package.json:**
```json
{
  "dependencies": {
    "@openzeppelin/contracts": "5.0.0"       // You want 5.0.0!
  }
}
```

**What Happens:**
1. Your contract imports PackageA → OK
2. PackageA imports `contracts-upgradeable@4.8.0` → OK
3. Inside `contracts-upgradeable`, it imports `@openzeppelin/contracts/utils/Context.sol`
4. 🚨 **Import resolver triggered!** (NPM-style import)
5. Resolver checks: workspace has `contracts@5.0.0`
6. Maps to: `.deps/npm/@openzeppelin/contracts@5.0.0/utils/Context.sol`
7. But `ERC20Upgradeable` expects 4.8.0 API!
8. ❌ **Compilation might fail if API changed between versions!**

**This IS the Real Diamond Problem:**
- PackageA needs `@openzeppelin/contracts@4.8.0` (transitive dependency)
- Your workspace has `@openzeppelin/contracts@5.0.0`
- When resolver is triggered from WITHIN PackageA's dependencies, it uses YOUR workspace version
- **Version mismatch!**

---

### 🎯 ACTUAL Risk Assessment

| Scenario | Risk Level | Compiler Behavior | Our Resolver |
|----------|-----------|-------------------|--------------|
| Different files imported | 🟢 SAFE | No conflict | Works perfectly |
| Same file, same version | 🟢 SAFE | Deduplicates | Works perfectly |
| Same file, different versions | 🔴 BREAKS | Duplicate declaration | Detectable by us |
| Relative imports in packages | 🟢 SAFE | Never triggers resolver | Works perfectly |
| NPM imports in packages | 🟡 RISKY | Triggers resolver → wrong version | **Not handled!** |

---

### ✅ When Solidity Compiler Saves Us

**Solidity WILL throw errors for:**
1. ✅ Same contract defined twice (different files)
   ```
   DeclarationError: Identifier already declared.
   ```
2. ✅ ABI incompatibility (wrong function signatures)
   ```
   TypeError: Member "transfer" not found or not visible
   ```
3. ✅ Missing imports
   ```
   ParserError: Source "..." not found
   ```

---

### 🚨 When Compiler WON'T Save Us

**Silent failures / runtime bugs:**
1. ❌ Logic changes between versions (same interface, different behavior)
2. ❌ Internal contract changes that compile but break at runtime
3. ❌ Gas cost changes
4. ❌ Security fixes missed (using vulnerable version)

---

### 💡 The Real Fix

**We NEED to track compilation context:**

```typescript
// Before compiling each file, set context
resolver.setCompilationContext(currentFilePath)

// In resolvePackageVersion():
private async resolvePackageVersion(packageName: string): Promise<...> {
  // If compiling code INSIDE a dependency package
  if (this.compilationContext?.startsWith('.deps/npm/')) {
    const parentPackage = this.extractPackageFromPath(this.compilationContext)
    const parentVersion = this.extractVersionFromPath(this.compilationContext)
    
    // Read parent package's package.json
    const parentPackageJson = await this.getPackageJson(parentPackage, parentVersion)
    
    // If parent declares this dependency, use ITS version
    if (parentPackageJson.dependencies?.[packageName]) {
      const version = await this.resolveVersionFromParent(packageName, parentPackageJson)
      console.log(`[ImportResolver] 🔗 Respecting parent dependency: ${parentPackage} → ${packageName}@${version}`)
      return { version, source: 'parent-package' }
    }
  }
  
  // Otherwise use workspace resolution (normal priority)
  // ...
}
```

**This ensures:**
- When compiling YOUR code → uses workspace package.json
- When compiling PackageA's code → uses PackageA's package.json
- When compiling PackageA's dependencies → uses PackageA's declared versions
- ✅ Each package gets its expected dependency versions!

---

### 11. **File System Path Length Limits (Windows)**

**Scenario:**
```
.deps/npm/@openzeppelin/contracts-upgradeable@5.0.2/token/ERC20/extensions/ERC20Burnable.sol
```

**What Could Fail:**
- Windows has 260 character path limit
- Deep nested packages might exceed limit
- File writes fail silently or throw errors

**Current Handling:**
```typescript
// ❌ NO PATH LENGTH CHECK
await this.pluginApi.call('fileManager', 'setFile', targetPath, content)
```

**Fix Needed:**
```typescript
if (process.platform === 'win32' && targetPath.length > 250) {
  console.error(`[ImportResolver] 🚨 Path too long for Windows: ${targetPath.length} chars`)
  // Use shorter hashed path?
  const hash = crypto.createHash('md5').update(targetPath).digest('hex').substring(0, 8)
  targetPath = `.deps/npm/_${hash}/${filename}`
}
```

---

### 12. **Package.json Malformed or Missing**

**Scenario:**
- User has `package.json` but it's invalid JSON
- Or package.json exists but is empty
- Or has `null` values

**What Could Fail:**
```typescript
// ❌ NO ERROR HANDLING FOR PARSE FAILURE
const packageJson = JSON.parse(content)
const resolutions = packageJson.resolutions || packageJson.overrides || {}
```

**Fix Needed:**
```typescript
try {
  const packageJson = JSON.parse(content)
  if (!packageJson || typeof packageJson !== 'object') {
    console.warn(`[ImportResolver] ⚠️  Invalid package.json: not an object`)
    return
  }
  // ... rest of code
} catch (err) {
  console.warn(`[ImportResolver] ⚠️  Failed to parse package.json:`, err.message)
  return
}
```

---

### 13. **Race Conditions in Parallel Compilation**

**Scenario:**
- User compiles multiple files simultaneously
- All import same package
- Multiple `fetchAndMapPackage()` calls in parallel
- All try to write to same `.deps/npm/package@version/` folder

**What Could Fail:**
```typescript
// ❌ NO MUTEX/LOCK
if (this.importMappings.has(mappingKey)) {
  return // Early return if already mapped
}

// But between check and fetch, another thread might also fetch!
await this.fetchAndMapPackage(packageName)
```

**Fix Needed:**
```typescript
private fetchPromises = new Map<string, Promise<void>>()

private async fetchAndMapPackage(packageName: string): Promise<void> {
  const mappingKey = `__PKG__${packageName}`
  
  if (this.importMappings.has(mappingKey)) {
    return
  }
  
  // Check if already fetching
  if (this.fetchPromises.has(mappingKey)) {
    console.log(`[ImportResolver] ⏳ Already fetching ${packageName}, waiting...`)
    return await this.fetchPromises.get(mappingKey)
  }
  
  // Create fetch promise
  const promise = this._fetchAndMapPackageImpl(packageName)
  this.fetchPromises.set(mappingKey, promise)
  
  try {
    await promise
  } finally {
    this.fetchPromises.delete(mappingKey)
  }
}
```

---

### 14. **Pre-release Versions / Build Metadata**

**Scenario:**
```json
{
  "dependencies": {
    "@openzeppelin/contracts": "5.0.0-rc.1",
    "hardhat": "2.19.0+build.123"
  }
}
```

**What Could Fail:**
```typescript
// ❌ REGEX ONLY MATCHES STABLE VERSIONS
const match = url.match(/@(\d+(?:\.\d+)?(?:\.\d+)?[^\s/]*)/)
// Might partially match but version comparison breaks
```

**Fix Needed:**
```typescript
// Support full semver including pre-release and build metadata
const match = url.match(/@(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?(?:\+[a-zA-Z0-9.]+)?)/)
//                                          ^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^
//                                          pre-release     build metadata
```

---

### 15. **Lock File Changes Mid-Compilation**

**Scenario:**
1. User starts compilation
2. File A imports package@4.8.0 (from lock file)
3. User runs `yarn install` (lock file updated to 4.9.0)
4. File B imports same package (now gets 4.9.0)
5. **Two versions in same compilation!**

**What Could Fail:**
- Inconsistent state across compilation
- Duplicate declarations
- Symbol conflicts

**Current "Protection":**
```typescript
// ⚠️ PARTIAL: We reload on each resolve()
await this.loadLockFileVersions()
```

**But:**
- If File A resolves before lock file changes
- And File B resolves after lock file changes
- They get different versions in same compilation!

**Better Fix:**
```typescript
// Lock version resolution at compilation START
private lockFileSnapshot: Map<string, string> | null = null

public lockVersions(): void {
  this.lockFileSnapshot = new Map(this.lockFileVersions)
  console.log(`[ImportResolver] 🔒 Locked versions for this compilation`)
}

private async resolvePackageVersion(packageName: string): Promise<...> {
  // Use snapshot if available
  const versions = this.lockFileSnapshot || this.lockFileVersions
  if (versions.has(packageName)) {
    return { version: versions.get(packageName), source: 'lock-file' }
  }
  // ...
}
```

---

## 🟡 Medium Priority Edge Cases

### 16. **Subpath Exports (package.json exports field)**

Many modern packages use `exports` field:
```json
{
  "exports": {
    "./token/*": "./contracts/token/*.sol",
    "./access": "./contracts/access/index.sol"
  }
}
```

Our resolver doesn't respect this - we directly map to filesystem paths.

---

### 17. **Peer Dependency Conflicts**

Package A requires `"hardhat": "^2.0.0"` (peer)
Package B requires `"hardhat": "^3.0.0"` (peer)

Both can't be satisfied - but we might not detect this properly.

---

### 18. **Very Large Packages (node_modules size issues)**

Fetching a 50MB package from unpkg might timeout or fail.
No size limit checks.

---

### 19. **Special Characters in Package Names**

Package names can contain: `@`, `/`, `-`, `.`, `_`, `~`

What about:
- `@my.company/my-package` (dot in scope)
- `my_package` (underscore)
- `my.package` (dot in name)

Regex might need adjustment.

---

### 20. **Missing Files in Package**

User imports `@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol`
But package 4.8.0 doesn't have that file (wrong path or removed file).

Our resolver will successfully map the import, but compilation will fail with "file not found".

---

## 🟢 Low Priority / Unlikely Edge Cases

21. **Unicode in package names** (rare but allowed)
22. **Symbolic links in .deps folder** (filesystem confusion)
23. **Package published then unpublished from npm** (404 from unpkg)
24. **Time-based version resolution** (npm registry returns different version over time)
25. **Package name squatting** (malicious package with similar name)

---

## ✅ What's Already Protected

1. ✅ **Deduplication**: Same version only downloaded once
2. ✅ **Canonical paths**: All imports normalized to `@version` format
3. ✅ **Transitive deps**: Entire package structure preserved
4. ✅ **Version conflicts**: Warning system for major version mismatches
5. ✅ **Dynamic reload**: Lock files re-parsed on each compilation
6. ✅ **Priority system**: Clear resolution order (workspace > lock > npm)

---

## 🎯 Recommended Fixes (Priority Order)

1. **HIGH**: Fix multiple lock file versions (#3)
2. **HIGH**: Add retry logic for npm fetches (#7)
3. **HIGH**: Handle workspace protocol (#2)
4. **HIGH**: Add fetch mutex for race conditions (#13)
5. **MEDIUM**: Normalize package name casing (#4)
6. **MEDIUM**: Handle git dependencies (#5)
7. **MEDIUM**: Lock versions at compilation start (#15)
8. **MEDIUM**: Handle pre-release versions (#14)
9. **LOW**: Add circular dependency tracking (#1)
10. **LOW**: Path length limits for Windows (#11)

---

## 🧪 Testing Strategy for Edge Cases

```typescript
describe('Edge Cases', () => {
  it('should handle circular dependencies without infinite loop')
  it('should resolve workspace protocol packages')
  it('should handle multiple versions in lock file')
  it('should normalize package name casing')
  it('should parse git dependencies from package.json')
  it('should retry failed npm fetches')
  it('should handle race conditions in parallel compilation')
  it('should support pre-release versions (5.0.0-rc.1)')
  it('should lock versions during compilation')
  it('should handle malformed package.json gracefully')
})
```

Would you like me to implement fixes for any of these edge cases?
