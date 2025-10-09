'use strict'

import { Plugin } from '@remixproject/engine'
import { Compiler } from './compiler'
import { DependencyResolver } from './dependency-resolver'
import { CompilerState, Source } from './types'

/**
 * SmartCompiler - A wrapper around the standard Compiler that automatically
 * handles dependency resolution before compilation.
 * 
 * This class exposes the exact same interface as Compiler but adds intelligent
 * pre-compilation dependency resolution using DependencyResolver.
 * 
 * Usage:
 *   const smartCompiler = new SmartCompiler(pluginApi)
 *   smartCompiler.compile(sources, target)  // Same interface as Compiler!
 * 
 * What it does:
 * 1. Uses DependencyResolver to build complete source bundle with npm aliases
 * 2. Saves resolution index for "Go to Definition" functionality  
 * 3. Passes pre-built sources to the underlying Compiler
 * 4. Transparently forwards all other method calls to the underlying Compiler
 */
export class SmartCompiler {
  private compiler: Compiler
  private pluginApi: Plugin

  constructor(
    pluginApi: Plugin,
    importCallback?: (url: string, cb: (err: Error | null, result?: any) => void) => void,
    importResolverFactory?: (target: string) => any
  ) {
    this.pluginApi = pluginApi
    
    // Create the underlying compiler
    // Note: We can pass null for importResolverFactory since we handle imports differently
    this.compiler = new Compiler(importCallback, null)
    
    console.log(`[SmartCompiler] 🧠 Created smart compiler wrapper`)
    
    // Create a proxy that transparently forwards all method calls to the underlying compiler
    // except for the ones we explicitly override (compile)
    return new Proxy(this, {
      get(target, prop, receiver) {
        // If the property exists on SmartCompiler, use it
        if (prop in target) {
          return Reflect.get(target, prop, receiver)
        }
        
        // Otherwise, forward to the underlying compiler
        const compilerValue = Reflect.get(target.compiler, prop)
        
        // If it's a method, bind it to the compiler instance
        if (typeof compilerValue === 'function') {
          return compilerValue.bind(target.compiler)
        }
        
        // If it's a property, return it directly
        return compilerValue
      }
    })
  }

  /**
   * Smart compile method - performs dependency resolution first, then compiles
   */
  public compile(sources: Source, target: string): void {
    console.log(`[SmartCompiler] 🚀 Starting smart compilation for: ${target}`)
    
    // Perform dependency resolution asynchronously, then compile
    this.performSmartCompilation(sources, target).catch(error => {
      console.log(`[SmartCompiler] ❌ Smart compilation failed:`, error)
      
      // Fallback: try to compile with original sources if dependency resolution fails  
      console.log(`[SmartCompiler] 🔄 Falling back to direct compilation...`)
      this.compiler.compile(sources, target)
    })
  }

  /**
   * Internal async method to handle dependency resolution and compilation
   */
  private async performSmartCompilation(sources: Source, target: string): Promise<void> {
    try {
      // Step 1: Build dependency tree BEFORE compilation
      console.log(`[SmartCompiler] 🌳 Building dependency tree...`)
      const depResolver = new DependencyResolver(this.pluginApi, target)
      
      // Build complete source bundle with context-aware resolution
      const sourceBundle = await depResolver.buildDependencyTree(target)
      
      console.log(`[SmartCompiler] ✅ Dependency tree built successfully`)
      console.log(`[SmartCompiler] 📦 Source bundle contains ${sourceBundle.size} files`)
      
      // Step 2: Save resolution index for "Go to Definition" functionality
      await depResolver.saveResolutionIndex()
      
      // Step 3: Get import graph for debugging/logging
      const importGraph = depResolver.getImportGraph()
      if (importGraph.size > 0) {
        console.log(`[SmartCompiler] 📊 Import graph:`)
        importGraph.forEach((imports, file) => {
          console.log(`[SmartCompiler]   ${file}`)
          imports.forEach(imp => console.log(`[SmartCompiler]     → ${imp}`))
        })
      }
      
      // Step 4: Convert to compiler input format
      const resolvedSources = depResolver.toCompilerInput()
      
      // Step 5: Add the entry file if it's not already in the bundle (e.g., local file)
      if (!resolvedSources[target] && sources[target]) {
        resolvedSources[target] = sources[target]
      }
      
      console.log(`[SmartCompiler] 🔨 Passing ${Object.keys(resolvedSources).length} files to underlying compiler`)
      
      // Log all files that will be compiled
      Object.keys(resolvedSources).forEach((filePath, index) => {
        console.log(`[SmartCompiler]   ${index + 1}. ${filePath}`)
      })
      
      // Step 6: Delegate to the underlying compiler with pre-built sources
      console.log(`[SmartCompiler] ⚡ Starting compilation with resolved sources...`)
      this.compiler.compile(resolvedSources, target)
      
    } catch (error) {
      // Re-throw to be caught by the outer catch block
      throw error
    }
  }

  // Note: All other methods (set, onCompilerLoaded, loadVersion, visitContracts, etc.)
  // are automatically forwarded to the underlying compiler via the Proxy
}