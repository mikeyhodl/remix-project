import type { IOAdapter } from './adapters/io-adapter'
import { DependencyResolver } from './dependency-resolver'
import { normalizeRemappings, parseRemappingsFileContent, Remapping } from './utils/remappings'

export interface FlattenResult {
  entry: string
  order: string[]
  sources: Map<string, string>
  flattened: string
}

export interface FlattenOptions {
  // Foundry-style remappings provided inline (e.g., ["oz=@openzeppelin/contracts@4.8.0/"]) or as objects
  remappings?: Array<string | Remapping>
  // Path to remappings.txt (using the IOAdapter to read)
  remappingsFile?: string
}

/**
 * SourceFlattener
 *
 * Builds a complete dependency graph starting from an entry file, resolves all imports
 * using ImportResolver (context-aware), and produces a single flattened Solidity file
 * with a single SPDX and a single pragma solidity directive.
 */
export class SourceFlattener {
  constructor(private io: IOAdapter, private debug = false) {}

  private log(...args: any[]) {
    if (this.debug) console.log('[SourceFlattener]', ...args)
  }

  /**
   * Flatten a Solidity entry file by resolving its entire import graph and concatenating
   * sources in a topologically sorted order (dependencies before dependents).
   */
  public async flatten(entryFile: string, opts?: FlattenOptions): Promise<FlattenResult> {
    const dep = new DependencyResolver(this.io, entryFile, this.debug)

    // Load and set remappings if provided
    if (opts?.remappingsFile) {
      try {
        const content = await this.io.readFile(opts.remappingsFile)
        const remaps = parseRemappingsFileContent(content)
        dep.setRemappings(remaps)
      } catch (e) {
        this.log('Failed to read remappings file:', opts.remappingsFile, e)
      }
    } else if (opts?.remappings && opts.remappings.length) {
      dep.setRemappings(normalizeRemappings(opts.remappings))
    }
    await dep.buildDependencyTree(entryFile)

    // Optional: save resolution index for Go-to-Definition parity
    await dep.saveResolutionIndex()

    const graph = dep.getImportGraph()
    const bundle = dep.getSourceBundle()

    // Topologically sort files with DFS so that imported files come first
    const visited = new Set<string>()
    const order: string[] = []

    const visit = (file: string) => {
      if (visited.has(file)) return
      visited.add(file)
      const imports = graph.get(file)
      if (imports) {
        for (const imp of imports) {
          // Resolve relative import node key to consistent key used in graph
          let key = imp
          if (graph.has(imp)) {
            key = imp
          }
          visit(key)
        }
      }
      order.push(file)
    }

    // The graph keys may be resolved paths; ensure entry is included
    if (!graph.has(entryFile)) {
      // Fallback: when no imports, still include entry
      order.push(entryFile)
    } else {
      visit(entryFile)
    }

    // Build flattened content
    let firstPragma: string | null = null
    let firstSpdx: string | null = null
    const seen = new Set<string>()
    const parts: string[] = []

    const stripImports = (src: string) => src.replace(/\n?\s*import\s+[^;]+;\s*\n?/g, '\n')

    for (const file of order) {
      if (seen.has(file)) continue
      seen.add(file)
      const content = bundle.get(file) || ''
      if (!content) continue

      const lines = content.split(/\r?\n/)
      const kept: string[] = []
      for (const line of lines) {
        // SPDX
        const spdxMatch = line.match(/^\s*\/\/\s*SPDX-License-Identifier:\s*(.+)$/)
        if (spdxMatch) {
          if (!firstSpdx) firstSpdx = line.trim()
          // Drop duplicate SPDX
          continue
        }
        // pragma solidity
        const pragmaMatch = line.match(/^\s*pragma\s+solidity\s+[^;]+;/)
        if (pragmaMatch) {
          if (!firstPragma) firstPragma = pragmaMatch[0]
          // Drop duplicate pragma
          continue
        }
        kept.push(line)
      }

      const withoutImports = stripImports(kept.join('\n')).trim()
      this.log('Adding file to flat:', file)
      parts.push(`\n\n// File: ${file}\n\n${withoutImports}`)
    }

    const header: string[] = []
    if (firstSpdx) header.push(firstSpdx)
    if (firstPragma) header.push(firstPragma)

    const flattened = [header.join('\n'), ...parts].filter(Boolean).join('\n')

    return { entry: entryFile, order, sources: bundle, flattened }
  }

  /**
   * Helper to write the flattened output to a file.
   * - Ensures parent directory exists via IOAdapter.mkdir
   * - Writes the flattened content via IOAdapter.writeFile
   * Returns the FlattenResult extended with the outFile path.
   */
  public async flattenToFile(entryFile: string, outFile: string, opts?: FlattenOptions & { overwrite?: boolean }): Promise<FlattenResult & { outFile: string }> {
    const result = await this.flatten(entryFile, opts)
    const dir = outFile.split('/').slice(0, -1).join('/')
    if (dir) {
      await this.io.mkdir(dir)
    }
    // For now, overwrite behavior is adapter-dependent; basic write always overwrites
    await this.io.writeFile(outFile, result.flattened)
    return { ...result, outFile }
  }
}
