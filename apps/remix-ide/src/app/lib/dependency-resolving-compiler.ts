'use strict'

import { Plugin } from '@remixproject/engine'
import { Compiler, Source } from '@remix-project/remix-solidity'
import { DependencyResolver } from '@remix-project/import-resolver'

/**
 * DependencyResolvingCompiler - A wrapper around the standard Compiler that automatically
 * handles dependency resolution before compilation.
 *
 * This class exposes the exact same interface as Compiler but adds intelligent
 * pre-compilation dependency resolution using DependencyResolver.
 */
export class DependencyResolvingCompiler extends Compiler {
  private pluginApi: Plugin
  private debug: boolean = false

  constructor(
    pluginApi: Plugin,
    importCallback?: (url: string, cb: (err: Error | null, result?: any) => void) => void,
    _importResolverFactory?: (target: string) => any,
    debug: boolean = false
  ) {
    super(importCallback)
    this.pluginApi = pluginApi
    this.debug = true // debug

    if (this.debug) {
      console.log(`[DependencyResolvingCompiler] 🧠 Created smart compiler wrapper`)
    }
  }

  public compile(sources: Source, target: string): void {
    if (this.debug) console.log(`[DependencyResolvingCompiler] 🚀 Starting smart compilation for: ${target}`)
    this.performSmartCompilation(sources, target).catch(error => {
      
      if (this.debug) {
        console.log(`[DependencyResolvingCompiler] ❌ Smart compilation failed:`, error)
      }
      // Don't fall back to normal compilation - emit the error through the proper channel
      // This ensures errors are displayed in the compiler output just like normal import errors
      this.state.lastCompilationResult = null
      this.event.trigger('compilationFinished', [
        false,
        { error: { formattedMessage: error.message || String(error), severity: 'error' } },
        { sources, target },
        null,
        this.state.currentVersion
      ])
        
    })
  }

  private async performSmartCompilation(sources: Source, target: string): Promise<void> {
    // 1) Build deps
    if (this.debug) console.log(`[DependencyResolvingCompiler] 🌳 Building dependency tree...`)
    const depResolver = new DependencyResolver(this.pluginApi as any, target, true)
    depResolver.setCacheEnabled(false)
    let sourceBundle
    try {
      sourceBundle = await depResolver.buildDependencyTree(target)
    } catch (err) {
      console.log(`[DependencyResolvingCompiler] ❌ Dependency resolution failed:`, err)
      throw new Error(`Dependency resolution failed: ${(err as Error).message}`)
    }
    if (this.debug) {
      console.log(`[DependencyResolvingCompiler] ✅ Dependency tree built successfully`)
      console.log(`[DependencyResolvingCompiler] 📦 Source bundle contains ${sourceBundle.size} files`)
    }

    // 2) Save resolution index
    await depResolver.saveResolutionIndex()

    // 3) Optional debug: import graph
    if (this.debug) {
      const importGraph = depResolver.getImportGraph()
      if (importGraph.size > 0) {
        console.log(`[DependencyResolvingCompiler] 📊 Import graph:`)
        importGraph.forEach((imports, file) => {
          console.log(`[DependencyResolvingCompiler]   ${file}`)
          imports.forEach(imp => console.log(`[DependencyResolvingCompiler]     → ${imp}`))
        })
      }
    }

    // 4) Convert bundle to compiler input
    const resolvedSources = depResolver.toCompilerInput()

    // 5) Ensure entry file present
    if (!resolvedSources[target] && sources[target]) {
      resolvedSources[target] = sources[target]
    }

    if (this.debug) {
      console.log(`[DependencyResolvingCompiler] 🔨 Passing ${Object.keys(resolvedSources).length} files to underlying compiler`)
      Object.keys(resolvedSources).forEach((filePath, index) => {
        console.log(`[DependencyResolvingCompiler]   ${index + 1}. ${filePath}`)
      })
      console.log(`[DependencyResolvingCompiler] ⚡ Starting compilation with resolved sources...`, resolvedSources)
    }

    // 6) Delegate to base compiler
  super.compile(resolvedSources, target)
  }
}
