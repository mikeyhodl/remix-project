'use strict'

import { Plugin } from '@remixproject/engine'
import { Compiler, Source } from '@remix-project/remix-solidity'
import { DependencyResolver } from '@remix-project/import-resolver'

/**
 * SmartCompiler - A wrapper around the standard Compiler that automatically
 * handles dependency resolution before compilation.
 *
 * This class exposes the exact same interface as Compiler but adds intelligent
 * pre-compilation dependency resolution using DependencyResolver.
 */
export class SmartCompiler extends Compiler {
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
    this.debug = debug

    if (this.debug) {
      console.log(`[SmartCompiler] 🧠 Created smart compiler wrapper`)
    }
  }

  public compile(sources: Source, target: string): void {
    if (this.debug) console.log(`[SmartCompiler] 🚀 Starting smart compilation for: ${target}`)
    this.performSmartCompilation(sources, target).catch(error => {
      if (this.debug) {
        console.log(`[SmartCompiler] ❌ Smart compilation failed:`, error)
        console.log(`[SmartCompiler] 🔄 Falling back to direct compilation...`)
      }
      super.compile(sources, target)
    })
  }

  private async performSmartCompilation(sources: Source, target: string): Promise<void> {
    // 1) Build deps
    if (this.debug) console.log(`[SmartCompiler] 🌳 Building dependency tree...`)
    const depResolver = new DependencyResolver(this.pluginApi as any, target, true)
  depResolver.setCacheEnabled(false)
    const sourceBundle = await depResolver.buildDependencyTree(target)
    if (this.debug) {
      console.log(`[SmartCompiler] ✅ Dependency tree built successfully`)
      console.log(`[SmartCompiler] 📦 Source bundle contains ${sourceBundle.size} files`)
    }

    // 2) Save resolution index
    await depResolver.saveResolutionIndex()

    // 3) Optional debug: import graph
    if (this.debug) {
      const importGraph = depResolver.getImportGraph()
      if (importGraph.size > 0) {
        console.log(`[SmartCompiler] 📊 Import graph:`)
        importGraph.forEach((imports, file) => {
          console.log(`[SmartCompiler]   ${file}`)
          imports.forEach(imp => console.log(`[SmartCompiler]     → ${imp}`))
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
      console.log(`[SmartCompiler] 🔨 Passing ${Object.keys(resolvedSources).length} files to underlying compiler`)
      Object.keys(resolvedSources).forEach((filePath, index) => {
        console.log(`[SmartCompiler]   ${index + 1}. ${filePath}`)
      })
      console.log(`[SmartCompiler] ⚡ Starting compilation with resolved sources...`)
    }

    // 6) Delegate to base compiler
    super.compile(resolvedSources, target)
  }
}
