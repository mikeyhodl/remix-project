# Quick Start: Using Target File in Import Resolver

## Simple Example

Here's how to use the new `target` parameter in your import resolver:

```typescript
import { Compiler } from '@remix-project/remix-solidity'

// Before - you didn't know which file triggered the import
const oldCompiler = new Compiler((url, cb) => {
  console.log(`Resolving: ${url}`)
  // Which file needs this? Unknown! 🤷
  resolveImport(url)
    .then(content => cb(null, content))
    .catch(error => cb(error.message))
})

// After - you know exactly which file is importing
const newCompiler = new Compiler((url, cb, target) => {
  console.log(`File: ${target} is importing: ${url}`)
  // Now you know! 🎉
  resolveImport(url)
    .then(content => cb(null, content))
    .catch(error => cb(error.message))
})
```

## Real Example from Remix

In `compileTabLogic.ts`, the change is minimal:

```typescript
// Old code
this.compiler = new Compiler((url, cb) => 
  api.resolveContentAndSave(url)
    .then((result) => cb(null, result))
    .catch((error) => cb(error.message))
)

// New code - just add the target parameter
this.compiler = new Compiler((url, cb, target) => 
  api.resolveContentAndSave(url)
    .then((result) => cb(null, result))
    .catch((error) => cb(error.message))
)
```

## What You Get

When compiling `contracts/MyToken.sol`:
```solidity
// contracts/MyToken.sol
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    constructor() ERC20("MyToken", "MTK") {}
}
```

Your callback receives:
- **url**: `"@openzeppelin/contracts/token/ERC20/ERC20.sol"`
- **target**: `"contracts/MyToken.sol"` ← This is new!
- **cb**: The callback to return the resolved content

## Use Cases

### 1. Better Error Messages
```typescript
new Compiler((url, cb, target) => {
  resolveImport(url)
    .then(content => cb(null, content))
    .catch(error => {
      console.error(`Error in ${target}: Failed to import ${url}`)
      cb(error.message)
    })
})
```

### 2. Logging & Debugging
```typescript
new Compiler((url, cb, target) => {
  console.log(`[IMPORT] ${target} → ${url}`)
  resolveImport(url)
    .then(content => cb(null, content))
    .catch(error => cb(error.message))
})
```

Output:
```
[IMPORT] contracts/MyToken.sol → @openzeppelin/contracts/token/ERC20/ERC20.sol
[IMPORT] contracts/MyToken.sol → @openzeppelin/contracts/token/ERC20/IERC20.sol
[IMPORT] contracts/MyToken.sol → @openzeppelin/contracts/utils/Context.sol
```

### 3. Conditional Resolution
```typescript
new Compiler((url, cb, target) => {
  // Use different NPM registries based on the importing file
  const isTestFile = target?.includes('/test/')
  const registry = isTestFile ? 'test-registry' : 'prod-registry'
  
  resolveImport(url, { registry })
    .then(content => cb(null, content))
    .catch(error => cb(error.message))
})
```

### 4. Import Tracking
```typescript
const imports = new Map<string, string[]>()

new Compiler((url, cb, target) => {
  // Track which file imports what
  if (target) {
    if (!imports.has(target)) {
      imports.set(target, [])
    }
    imports.get(target)!.push(url)
  }
  
  resolveImport(url)
    .then(content => cb(null, content))
    .catch(error => cb(error.message))
})

// Later: see what a file imports
console.log('MyToken.sol imports:', imports.get('contracts/MyToken.sol'))
// Output: ['@openzeppelin/contracts/token/ERC20/ERC20.sol', ...]
```

## Important Notes

1. **Optional Parameter**: The `target` parameter is optional. It may be `null` or `undefined` in edge cases.

2. **Backward Compatible**: Existing code continues to work. The parameter is ignored if not used.

3. **Persistent During Re-compilation**: When the compiler re-runs after resolving imports, the same `target` value is maintained.

4. **Access Anytime**: You can also access `compiler.state.target` directly if needed.

## Testing Your Changes

```typescript
const compiler = new Compiler((url, cb, target) => {
  if (target) {
    console.log(`✓ Target parameter is working: ${target}`)
  } else {
    console.log(`✗ Target is missing`)
  }
  
  resolveImport(url)
    .then(content => cb(null, content))
    .catch(error => cb(error.message))
})

// Compile a file
await compiler.compile(
  { 'test.sol': { content: 'import "./other.sol";' } },
  'test.sol'
)

// You should see: ✓ Target parameter is working: test.sol
```

## Summary

The change is small but powerful:
- **Before**: No context about which file triggered the import
- **After**: You know exactly which file is being compiled

This enables better error messages, debugging, analytics, and conditional import resolution strategies.
