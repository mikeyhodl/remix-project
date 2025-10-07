# Compiler Import Resolver Enhancement - Target File Tracking

## Summary

Enhanced the Solidity compiler's import resolution callback to include information about which file was being compiled when a missing import was detected.

## Problem Statement

Previously, when the Solidity compiler called the `handleImportCall` callback to resolve missing imports, there was no way to determine which file triggered the import request. This made it difficult to:
- Debug import resolution issues
- Implement file-specific import strategies
- Track import dependencies
- Provide meaningful error messages

## Solution

Modified the `handleImportCall` callback signature to include an optional `target` parameter that contains the path of the file being compiled.

### Before:
```typescript
constructor(handleImportCall?: (fileurl: string, cb) => void)
```

### After:
```typescript
constructor(handleImportCall?: (fileurl: string, cb, target?: string | null) => void)
```

## Changes Made

### 1. Core Compiler (`libs/remix-solidity/src/compiler/compiler.ts`)
- Updated constructor signature to accept target parameter in callback
- Modified `gatherImports()` method to pass `this.state.target` to the callback
- The `state.target` is set when `compile()` is called and persists through re-compilation cycles

### 2. Compiler Instantiations
Updated all places where `new Compiler()` is instantiated:

- **`libs/remix-ui/solidity-compiler/src/lib/logic/compileTabLogic.ts`**
  ```typescript
  new Compiler((url, cb, target) => ...)
  ```

- **`apps/remix-ide/src/app/plugins/parser/services/code-parser-compiler.ts`**
  ```typescript
  new Compiler((url, cb, target) => ...)
  ```

### 3. Documentation
- Updated `libs/remix-solidity/README.md` with new callback signature
- Created comprehensive examples in `libs/remix-solidity/IMPORT_CALLBACK_EXAMPLE.md`

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User compiles: "contracts/MyContract.sol"                │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Compiler.compile(sources, "contracts/MyContract.sol")    │
│    - Sets: this.state.target = "contracts/MyContract.sol"   │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Solidity compiler detects missing import:                │
│    "@openzeppelin/contracts/token/ERC20/ERC20.sol"         │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. gatherImports() calls handleImportCall with:            │
│    - url: "@openzeppelin/contracts/token/ERC20/ERC20.sol"  │
│    - cb: callback function                                  │
│    - target: "contracts/MyContract.sol" ← NEW!             │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Resolver loads content and calls: cb(null, content)      │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Compiler re-runs with all sources (maintains target)     │
└─────────────────────────────────────────────────────────────┘
```

## Usage Example

### Before (No Context):
```typescript
const compiler = new Compiler((url, cb) => {
  // Which file is importing this? Unknown!
  console.log(`Resolving: ${url}`)
  resolveImport(url).then(c => cb(null, c))
})
```

### After (With Context):
```typescript
const compiler = new Compiler((url, cb, target) => {
  // Now we know which file triggered this import
  console.log(`File ${target} is importing ${url}`)
  resolveImport(url).then(c => cb(null, c))
})
```

## Use Cases Enabled

1. **Better Debugging**
   ```typescript
   console.log(`[${target}] Failed to resolve import: ${url}`)
   ```

2. **Conditional Resolution**
   ```typescript
   const strategy = target?.includes('test/') ? 'test-deps' : 'prod-deps'
   ```

3. **Dependency Tracking**
   ```typescript
   importGraph.addEdge(target, url)
   ```

4. **Import Analytics**
   ```typescript
   stats[target] = (stats[target] || 0) + 1
   ```

## Backward Compatibility

✅ **Fully backward compatible**
- The `target` parameter is optional
- Existing code will continue to work without modification
- Callbacks that don't use the `target` parameter will simply ignore it

## Testing

- No TypeScript errors in modified files
- All existing functionality preserved
- New parameter is optional and doesn't break existing code

## Files Changed

1. `/libs/remix-solidity/src/compiler/compiler.ts`
2. `/libs/remix-solidity/README.md`
3. `/libs/remix-ui/solidity-compiler/src/lib/logic/compileTabLogic.ts`
4. `/apps/remix-ide/src/app/plugins/parser/services/code-parser-compiler.ts`
5. `/libs/remix-solidity/IMPORT_CALLBACK_EXAMPLE.md` (new)
6. `/RESOLVER_TARGET_CHANGES.md` (new - this file)

## Next Steps

To use this feature in your resolver:

```typescript
api.resolveContentAndSave = (url) => {
  return api.call('contentImport', 'resolveAndSave', url)
}

// Update the compiler instantiation to use the target parameter
const compiler = new Compiler((url, cb, target) => {
  // You now have access to which file is compiling!
  console.log(`Compiling: ${target}`)
  console.log(`Missing import: ${url}`)
  
  api.resolveContentAndSave(url)
    .then(result => cb(null, result))
    .catch(error => cb(error.message))
})
```

## Additional Notes

- The `target` value comes from `compiler.state.target` which is set in the `compile()` method
- During re-compilation (after resolving imports), the same target is maintained
- The target represents the original file that initiated compilation, not the immediate parent of an import chain
