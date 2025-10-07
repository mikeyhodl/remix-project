# Import Callback with Target File Information

## Overview

When the Solidity compiler encounters missing imports, it calls the `handleImportCall` callback to resolve them. This callback now receives information about which file is being compiled when the missing import was detected.

## Callback Signature

```typescript
(fileurl: string, cb: Function, target?: string | null) => void
```

### Parameters:
- **fileurl** (string): The path of the missing import that needs to be resolved
- **cb** (Function): Callback function to call with the resolved content: `(error, content) => void`
- **target** (string | null | undefined): The file that was being compiled when this import was requested

## Usage Example

### Basic Example

```typescript
import { Compiler } from '@remix-project/remix-solidity'

const compiler = new Compiler((url, cb, target) => {
  console.log(`Resolving import: ${url}`)
  console.log(`Requested by file: ${target}`)
  
  // Your resolution logic here
  resolveImport(url)
    .then(content => cb(null, content))
    .catch(error => cb(error.message))
})
```

### Real-world Example from Remix IDE

```typescript
import { Compiler } from '@remix-project/remix-solidity'

const compiler = new Compiler((url, cb, target) => {
  // Log which file triggered the import
  if (target) {
    console.log(`File ${target} is importing ${url}`)
  }
  
  // Call the content import plugin to resolve and save the import
  api.call('contentImport', 'resolveAndSave', url)
    .then((result) => cb(null, result))
    .catch((error) => cb(error.message))
})
```

### Advanced Example with Import Tracking

```typescript
import { Compiler } from '@remix-project/remix-solidity'

class CompilerWithImportTracking {
  private importMap: Map<string, Set<string>> = new Map()
  private compiler: Compiler
  
  constructor(contentResolver: (url: string) => Promise<string>) {
    this.compiler = new Compiler((url, cb, target) => {
      // Track which file imports which dependency
      if (target) {
        if (!this.importMap.has(target)) {
          this.importMap.set(target, new Set())
        }
        this.importMap.get(target)!.add(url)
        
        console.log(`Import graph: ${target} -> ${url}`)
      }
      
      // Resolve the import
      contentResolver(url)
        .then(content => cb(null, content))
        .catch(error => cb(error.message))
    })
  }
  
  getImportsForFile(filePath: string): Set<string> | undefined {
    return this.importMap.get(filePath)
  }
  
  getAllImports(): Map<string, Set<string>> {
    return this.importMap
  }
}
```

## Flow Diagram

```
1. User compiles file: "contracts/MyContract.sol"
   ↓
2. Compiler.compile(sources, "contracts/MyContract.sol")
   ↓
3. state.target = "contracts/MyContract.sol"
   ↓
4. Solidity compiler detects missing import: "@openzeppelin/contracts/token/ERC20/ERC20.sol"
   ↓
5. handleImportCall is invoked with:
   - url: "@openzeppelin/contracts/token/ERC20/ERC20.sol"
   - cb: callback function
   - target: "contracts/MyContract.sol"  ← NEW!
   ↓
6. Your resolver loads the content and calls: cb(null, content)
   ↓
7. Compiler re-runs with all sources included
```

## Use Cases

### 1. Debugging Import Issues
```typescript
const compiler = new Compiler((url, cb, target) => {
  if (target) {
    console.log(`[DEBUG] ${target} requires ${url}`)
  }
  resolveImport(url).then(c => cb(null, c)).catch(e => cb(e.message))
})
```

### 2. Conditional Import Resolution
```typescript
const compiler = new Compiler((url, cb, target) => {
  // Use different resolution strategies based on the importing file
  const strategy = target?.includes('test/') 
    ? 'test-dependencies' 
    : 'production-dependencies'
  
  resolveWithStrategy(url, strategy)
    .then(c => cb(null, c))
    .catch(e => cb(e.message))
})
```

### 3. Import Analytics
```typescript
const importStats = { count: 0, byFile: {} }

const compiler = new Compiler((url, cb, target) => {
  importStats.count++
  if (target) {
    importStats.byFile[target] = (importStats.byFile[target] || 0) + 1
  }
  
  resolveImport(url).then(c => cb(null, c)).catch(e => cb(e.message))
})
```

## Notes

- The `target` parameter is optional and may be `null` or `undefined` in some edge cases
- The target represents the file that initiated the compilation, not necessarily the direct parent of the import
- During re-compilation after resolving imports, the same target is maintained
- You can access `compiler.state.target` at any time to get the current compilation target

## See Also

- [Compiler API Documentation](./README.md)
- [Import Resolution in Remix](../remix-url-resolver/README.md)
