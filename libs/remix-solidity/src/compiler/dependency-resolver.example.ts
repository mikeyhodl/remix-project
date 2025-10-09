/**
 * Example usage of DependencyResolver
 * 
 * This shows how to use the new pre-compilation dependency tree builder
 * to resolve imports with full context awareness.
 */

import { DependencyResolver } from './dependency-resolver'

// Example usage in a compilation flow:
export async function exampleUsage(pluginApi: any, contractFile: string) {
  console.log('🎯 Starting context-aware dependency resolution...')
  
  // 1. Create a DependencyResolver for the entry file
  const depResolver = new DependencyResolver(pluginApi, contractFile)
  
  // 2. Build the complete dependency tree
  //    This will recursively resolve all imports, tracking which file requests which dependency
  const sourceBundle = await depResolver.buildDependencyTree(contractFile)
  
  // 3. Get the complete source bundle for compilation
  const compilerInput = depResolver.toCompilerInput()
  
  console.log(`✅ Built source bundle with ${sourceBundle.size} files`)
  
  // 4. Optional: Inspect the import graph
  const importGraph = depResolver.getImportGraph()
  console.log('📊 Import graph:')
  importGraph.forEach((imports, file) => {
    console.log(`  ${file} imports:`)
    imports.forEach(imp => console.log(`    - ${imp}`))
  })
  
  // 5. Optional: Check package contexts
  for (const [file] of sourceBundle) {
    const context = depResolver.getPackageContext(file)
    if (context) {
      console.log(`📦 ${file} belongs to ${context}`)
    }
  }
  
  // 6. Pass the source bundle to the Solidity compiler
  // const compilerOutput = await compile(compilerInput, ...)
  
  return compilerInput
}

/**
 * Example scenario: Resolving contracts from multiple parent packages
 * 
 * File structure:
 * 
 * MyContract.sol
 *   ├─ import "@chainlink/contracts-ccip@1.6.1/src/v0.8/ccip/Router.sol"
 *   │    └─ import "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/token/ERC20/IERC20.sol"
 *   │         (This should resolve using contracts-ccip@1.6.1's package.json, which specifies contracts@1.4.0)
 *   │
 *   └─ import "@chainlink/contracts-ccip@1.6.2/src/v0.8/ccip/libraries/Client.sol"
 *        └─ import "@chainlink/contracts/src/v0.8/shared/access/OwnerIsCreator.sol"
 *             (This should resolve using contracts-ccip@1.6.2's package.json, which specifies contracts@1.5.0)
 * 
 * With the old approach (compiler's missing imports callback):
 * - ❌ We don't know which file requested @chainlink/contracts
 * - ❌ We can't determine if it should be 1.4.0 or 1.5.0
 * - ❌ LIFO approach picks the most recent parent (might be wrong!)
 * 
 * With the new approach (DependencyResolver):
 * - ✅ We know Router.sol (from contracts-ccip@1.6.1) requests IERC20.sol
 * - ✅ We check contracts-ccip@1.6.1's package.json → contracts@1.4.0
 * - ✅ We resolve to @chainlink/contracts@1.4.0/...
 * - ✅ Similarly for Client.sol → contracts@1.5.0
 * - ✅ Both versions coexist peacefully (different files, no conflict)
 */
