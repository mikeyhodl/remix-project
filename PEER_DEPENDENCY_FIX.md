# Peer Dependency Warning Fix

## 🐛 Problem Identified

**Original Code:**
```typescript
private async checkDependencyConflict(...) {
  const depMappingKey = `__PKG__${dep}`
  if (!this.importMappings.has(depMappingKey)) return  // ❌ Exits early!
  // ... rest of check
}
```

**Issue:**
When you import `@openzeppelin/contracts-upgradeable@5.4.0`:
1. Resolver checks its peer dependencies
2. Sees: `"peerDependencies": { "@openzeppelin/contracts": "5.4.0" }`
3. But `@openzeppelin/contracts` hasn't been imported yet
4. ❌ **Returns early without warning!**
5. Compilation fails later with cryptic error
6. User doesn't know it's a peer dependency issue

**Real-World Example:**
```json
// Your workspace
"@openzeppelin/contracts": "^5.0.0"

// contracts-upgradeable@5.4.0/package.json
"peerDependencies": { "@openzeppelin/contracts": "5.4.0" }

// Result: Compilation fails, but NO WARNING about peer deps!
```

---

## ✅ Solution

**New Code:**
```typescript
private async checkDependencyConflict(...) {
  const isPeerDep = peerDependencies && dep in peerDependencies
  const depMappingKey = `__PKG__${dep}`
  let resolvedDepVersion: string | null = null
  
  if (this.importMappings.has(depMappingKey)) {
    // Already imported - get mapped version
    const resolvedDepPackage = this.importMappings.get(depMappingKey)
    resolvedDepVersion = this.extractVersion(resolvedDepPackage)
  } else if (isPeerDep) {
    // ✅ NEW: Peer dep not yet imported - check what version would be resolved
    if (this.workspaceResolutions.has(dep)) {
      resolvedDepVersion = this.workspaceResolutions.get(dep)!
    } else if (this.lockFileVersions.has(dep)) {
      resolvedDepVersion = this.lockFileVersions.get(dep)!
    }
  } else {
    // Regular dependency not imported - skip
    return
  }
  
  // Continue with version conflict check...
}
```

**Key Changes:**
1. **For peer dependencies:** Check workspace/lock file even if not yet imported
2. **For regular dependencies:** Still skip if not imported (avoid fetching entire tree)
3. **Don't fetch from npm:** Too expensive for peer dep checking

---

## 📊 Behavior Comparison

### Before Fix:

```
User imports: contracts-upgradeable@5.4.0

Resolver:
  ✓ Fetch package
  ✓ Read package.json
  ✓ Check peerDependencies: { "@openzeppelin/contracts": "5.4.0" }
  ? Is @openzeppelin/contracts already mapped? NO
  ↪ Skip check, no warning ❌

Compilation:
  ✓ Compile contracts-upgradeable code
  ✓ Import @openzeppelin/contracts internally
  ✓ Resolver maps to 5.0.0 (from workspace)
  ✗ Compilation fails - API mismatch!
  
User sees: "TypeError: Member not found" (unclear!)
```

### After Fix:

```
User imports: contracts-upgradeable@5.4.0

Resolver:
  ✓ Fetch package
  ✓ Read package.json
  ✓ Check peerDependencies: { "@openzeppelin/contracts": "5.4.0" }
  ? Is @openzeppelin/contracts already mapped? NO
  ✓ Check workspace: Found 5.0.0 ✅
  ✓ Compare: 5.4.0 required, 5.0.0 found → MISMATCH!
  ✓ Show warning! ✅

Terminal Output:
  🚨 Peer Dependency version mismatch detected:
     Package @openzeppelin/contracts-upgradeable@5.4.0 requires in peerDependencies:
       "@openzeppelin/contracts": "5.4.0"
  
     But your workspace will resolve to: @openzeppelin/contracts@5.0.0
       (from workspace package.json)
  
     ⚠️  PEER DEPENDENCY MISMATCH - This WILL cause compilation failures!
  
     💡 To fix, update your workspace package.json:
         "@openzeppelin/contracts": "5.4.0"
       (Peer dependencies must be satisfied for @openzeppelin/contracts-upgradeable to work correctly)

Compilation:
  ✗ Still fails (as expected)
  
User sees: Clear warning BEFORE compilation + compiler error
           Now understands it's a peer dependency issue!
```

---

## 🎯 Benefits

### 1. **Early Warning**
- Shows warning **immediately** when package is fetched
- User knows about peer dep issue **before** compilation fails

### 2. **Clear Guidance**
- Explains what's wrong (peer dependency mismatch)
- Shows exact versions (required vs. found)
- Provides fix (update package.json to match)

### 3. **Distinguishes Peer Deps from Regular Deps**
- Peer deps checked proactively (will definitely be needed)
- Regular deps only checked if already imported (avoid fetching entire tree)

### 4. **No Performance Impact**
- Only checks workspace/lock file (already in memory)
- Doesn't fetch from npm for peer dep checks
- Same performance as before for regular dependencies

---

## 📝 Warning Message Format

### For Already Imported Dependencies:
```
⚠️  Dependency version mismatch detected:
   Package PackageA@1.0.0 requires in dependencies:
     "PackageC": "^2.0.0"

   But actual imported version is: PackageC@3.0.0
     (from workspace package.json)

   💡 To fix, update your workspace package.json:
       "PackageC": "^2.0.0"
```

### For Peer Dependencies (Not Yet Imported):
```
🚨 Peer Dependency version mismatch detected:
   Package @openzeppelin/contracts-upgradeable@5.4.0 requires in peerDependencies:
     "@openzeppelin/contracts": "5.4.0"

   But your workspace will resolve to: @openzeppelin/contracts@5.0.0
     (from workspace package.json)

   ⚠️  PEER DEPENDENCY MISMATCH - This WILL cause compilation failures!

   💡 To fix, update your workspace package.json:
       "@openzeppelin/contracts": "5.4.0"
     (Peer dependencies must be satisfied for @openzeppelin/contracts-upgradeable to work correctly)
```

**Key Differences:**
- "actual imported version" vs. "will resolve to" (clarity)
- Stronger warning for peer deps ("WILL cause failures")
- Extra explanation about peer dependencies

---

## 🧪 Testing

### Test Case 1: Peer Dep Mismatch (Your Case)

**Setup:**
```json
// workspace package.json
"@openzeppelin/contracts": "^5.0.0"

// Import in Solidity:
import "@openzeppelin/contracts-upgradeable@5.4.0/token/ERC20/ERC20Upgradeable.sol";
```

**Expected:**
1. ✅ Warning shown in terminal about peer dep mismatch
2. ✅ Compilation fails with API error
3. ✅ User understands it's a peer dependency issue

### Test Case 2: Peer Dep Satisfied

**Setup:**
```json
// workspace package.json
"@openzeppelin/contracts": "5.4.0"

// Import in Solidity:
import "@openzeppelin/contracts-upgradeable@5.4.0/token/ERC20/ERC20Upgradeable.sol";
```

**Expected:**
1. ✅ No warning (versions match)
2. ✅ Compilation succeeds

### Test Case 3: Regular Dep Not Imported

**Setup:**
```json
// PackageA depends on PackageC (regular dependency)
// PackageC not imported anywhere

// Import only PackageA:
import "PackageA/Contract.sol";
```

**Expected:**
1. ✅ No warning about PackageC (not imported, not checked)
2. ✅ No unnecessary npm fetches

### Test Case 4: Regular Dep Already Imported

**Setup:**
```json
// PackageA depends on PackageC@2.0.0 (regular dependency)
// User already imported PackageC@3.0.0

import "PackageC@3.0.0/Contract.sol";
import "PackageA/Contract.sol";  // Depends on PackageC@2.0.0
```

**Expected:**
1. ✅ Warning shown (version mismatch)
2. ⚠️  Might compile or fail depending on API compatibility

---

## 🚀 Deployment

**Files Changed:**
- `libs/remix-solidity/src/compiler/import-resolver.ts`
  - Modified: `checkDependencyConflict()` method
  - ~30 lines changed

**Breaking Changes:**
- None! Only adds warnings that weren't shown before

**Migration:**
- None needed

**Rollout:**
1. Merge to `resolver2` branch
2. Test with real-world examples
3. Include in PR to main

---

## 📚 Related Documentation

- **DIAMOND_DEPENDENCY_ANALYSIS.md** - Explains when/why peer dep mismatches occur
- **IMPORT_RESOLVER_EDGE_CASES.md** - Edge case #10 covers this scenario
- **IMPORT_RESOLVER_ARCHITECTURE.md** - Overall system design

---

## 🎯 Future Enhancements

### Option 1: Auto-Fix Suggestion
```typescript
// Could generate npm/yarn command:
console.log(`Run: npm install @openzeppelin/contracts@5.4.0`)
console.log(`Or:  yarn add @openzeppelin/contracts@5.4.0`)
```

### Option 2: Interactive Fix
```typescript
// Could prompt user to update package.json:
this.pluginApi.call('notification', 'confirm', {
  title: 'Fix Peer Dependency?',
  message: 'Update package.json to satisfy peer dependency?',
  ok: () => this.updatePackageJson(dep, requestedRange)
})
```

### Option 3: Lock File Generation
```typescript
// Could suggest adding to yarn.lock/package-lock.json:
console.log(`Add to resolutions in package.json:`)
console.log(`  "resolutions": { "${dep}": "${requestedRange}" }`)
```

But for v1, **clear warnings are sufficient!** The fix is simple (update package.json), and users should understand their dependencies.
