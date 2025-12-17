'use strict'
import { Plugin } from '@remixproject/engine'

const profile = {
  name: 'resolutionIndex',
  displayName: 'resolution index',
  version: '0.0.1',
  methods: ['resolveImportFromIndex', 'resolvePath', 'refresh', 'resolveActualPath']
}

type Index = Record<string, Record<string, string>>

export class ResolutionIndexPlugin extends Plugin {
  private index: Index = {}
  private readonly indexPath = '.deps/npm/.resolution-index.json'

  constructor() {
    super(profile)
  }

  onActivation() {
    // Prime the in-memory index and keep it in sync
    this.loadIndex().catch(() => {})
    this.on('filePanel', 'setWorkspace', () => this.loadIndex())
    this.on('fileManager', 'fileAdded', (file: string) => { if (file === this.indexPath) this.loadIndex() })
    this.on('fileManager', 'fileChanged', (file: string) => { if (file === this.indexPath) this.loadIndex() })
    this.on('fileManager', 'fileRemoved', (file: string) => { if (file === this.indexPath) this.index = {} })
  }

  async refresh() {
    await this.loadIndex()
  }

  private async loadIndex() {
    try {
      const exists = await this.call('fileManager', 'exists', this.indexPath)
      if (!exists) {
        this.index = {}
        return
      }
      const content = await this.call('fileManager', 'readFile', this.indexPath)
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed === 'object') {
        this.index = parsed as Index
      } else {
        this.index = {}
      }
    } catch (e) {
      this.index = {}
    }
  }

  /**
   * Resolve an import path using the in-memory resolution index
   */
  async resolveImportFromIndex(sourceFile: string, importPath: string): Promise<string | null> {
    console.log('[ResolutionIndexPlugin] resolveImportFromIndex', { sourceFile, importPath })
    const candidates = this.buildCandidates(importPath)
    console.log('[ResolutionIndexPlugin] candidates:', candidates)
    const isLocalPath = (val?: string) => !!val && !/^https?:\/\//.test(val) && !val.startsWith('github/')
    console.log('[ResolutionIndexPlugin] isLocalPath check:', candidates.map(c => ({ candidate: c, isLocal: isLocalPath(this.index[sourceFile]?.[c]) })))
    console.log('[ResolutionIndexPlugin] full index snapshot for sourceFile:', this.index[sourceFile])
    console.log('[ResolutionIndexPlugin] full index snapshot:', this.index)
    // 1) Direct lookup by candidates for the given sourceFile
    for (const cand of candidates) {
      const val = this.index[sourceFile]?.[cand]
      if (isLocalPath(val)) return val as string
    }
    // 2) Fallback: search across all base files for any candidate
    for (const file in this.index) {
      for (const cand of candidates) {
        const val = this.index[file]?.[cand]
        if (isLocalPath(val)) return val as string
      }
    }
    // 3) Last chance: fuzzy match by resolved path suffix (handles alias like github/<o>/<r>@<ref>/rest)
    const suffixes = candidates.map((c) => this.toSuffix(c)).filter(Boolean) as string[]
    const hit = this.findByResolvedSuffix(suffixes)
    if (isLocalPath(hit || undefined)) return hit
    return null
  }

  /**
   * Resolve a path (import or external path) to an internal file path for navigation use
   * Does not touch providers or the file system; uses only the in-memory index.
   */
  async resolvePath(sourceFile: string, inputPath: string): Promise<string> {
    // Try exact mapping from the index (using normalization and fallback logic)
    const mapped = await this.resolveImportFromIndex(sourceFile, inputPath)
    if (mapped) return mapped

    // Return the original path as a last resort (renderer will guard with exists)
    return inputPath
  }

  /**
   * Resolve the actual filesystem path for a requested file within a compiled contract's context.
   * This uses the __sources__ bundle and .raw_paths.json to find the exact file that was used.
   * 
   * @param originContract - The main contract that was compiled (entry point)
   * @param requestedPath - The path being requested (e.g., from debugger sources)
   * @returns The actual filesystem path where the file is located, or null if not found
   */
  async resolveActualPath(originContract: string, requestedPath: string): Promise<string | null> {
    console.log('[ResolutionIndexPlugin] 🔍 resolveActualPath CALLED')
    console.log('[ResolutionIndexPlugin]   ➡️  originContract:', originContract)
    console.log('[ResolutionIndexPlugin]   ➡️  requestedPath:', requestedPath)
    
    try {
      // Normalize origin contract path (strip .deps/npm/ prefix if present)
      const normalizedOrigin = this.normalizeSourceFile(originContract)
      console.log('[ResolutionIndexPlugin]   📝 Normalized origin:', normalizedOrigin)
      
      // Check if index has this origin
      console.log('[ResolutionIndexPlugin]   📊 Index keys:', Object.keys(this.index))
      console.log('[ResolutionIndexPlugin]   🔎 Has normalized origin?', normalizedOrigin in this.index)
      
      if (!this.index[normalizedOrigin]) {
        console.log('[ResolutionIndexPlugin]   ❌ Origin not found in index')
        return null
      }
      
      console.log('[ResolutionIndexPlugin]   📋 Origin entry keys:', Object.keys(this.index[normalizedOrigin]))
      console.log('[ResolutionIndexPlugin]   🔎 Has __sources__?', '__sources__' in this.index[normalizedOrigin])
      
      if (!this.index[normalizedOrigin]['__sources__']) {
        console.log('[ResolutionIndexPlugin]   ❌ No __sources__ found for:', normalizedOrigin)
        return null
      }
      
      const sources = this.index[normalizedOrigin]['__sources__'] as any
      console.log('[ResolutionIndexPlugin]   📦 __sources__ keys:', Object.keys(sources))
      console.log('[ResolutionIndexPlugin]   🔎 Looking for requestedPath in sources:', requestedPath)
      
      // Find matching source in __sources__
      let resolvedPath: string | null = null
      if (sources[requestedPath]) {
        console.log('[ResolutionIndexPlugin]   ✅ Found requestedPath in sources')
        console.log('[ResolutionIndexPlugin]   📄 Source entry:', JSON.stringify(sources[requestedPath], null, 2))
        if (sources[requestedPath].file) {
          resolvedPath = sources[requestedPath].file
          console.log('[ResolutionIndexPlugin]   📍 Extracted resolved path:', resolvedPath)
        } else {
          console.log('[ResolutionIndexPlugin]   ⚠️  Source entry has no .file property')
        }
      } else {
        console.log('[ResolutionIndexPlugin]   ⚠️  requestedPath NOT found in sources')
      }
      
      if (!resolvedPath) {
        console.log('[ResolutionIndexPlugin]   ❌ No match in __sources__ for:', requestedPath)
        return null
      }
      
      console.log('[ResolutionIndexPlugin]   � Resolved path from __sources__:', resolvedPath)
      
      // Check if it's a local workspace file (no @ version, not a URL)
      const isLocalFile = !resolvedPath.includes('@') && !resolvedPath.startsWith('http')
      console.log('[ResolutionIndexPlugin]   📁 Is local file?', isLocalFile)
      
      if (isLocalFile) {
        console.log('[ResolutionIndexPlugin]   ✅ Local file, returning as-is:', resolvedPath)
        return resolvedPath
      }
      
      // For external dependencies, look up in .raw_paths.json to find actual FS location
      console.log('[ResolutionIndexPlugin]   🌐 External dependency, looking up in .raw_paths.json')
      try {
        const rawPathsContent = await this.call('fileManager', 'readFile', '.deps/.raw_paths.json')
        console.log('[ResolutionIndexPlugin]   ✅ Successfully read .raw_paths.json')
        const rawPaths = JSON.parse(rawPathsContent)
        console.log('[ResolutionIndexPlugin]   📋 .raw_paths.json has', Object.keys(rawPaths).length, 'entries')
        
        // Look through all entries to find where this file was saved
        for (const [url, fsPath] of Object.entries(rawPaths)) {
          console.log('[ResolutionIndexPlugin]   🔎 Checking:', { url, fsPath, resolvedPath })
          // The fsPath should contain our resolved path
          if (typeof fsPath === 'string' && fsPath.includes(resolvedPath)) {
            console.log('[ResolutionIndexPlugin]   ✅ MATCH FOUND!')
            console.log('[ResolutionIndexPlugin]   🔗 Original URL:', url)
            console.log('[ResolutionIndexPlugin]   📁 Actual FS Path:', fsPath)
            return fsPath
          }
        }
        
        console.log('[ResolutionIndexPlugin]   ⚠️  No match found in .raw_paths.json')
        console.log('[ResolutionIndexPlugin]   ✅ RETURNING resolved path as-is:', resolvedPath)
        return resolvedPath
      } catch (e) {
        console.log('[ResolutionIndexPlugin]   ⚠️  .raw_paths.json error:', e)
        console.log('[ResolutionIndexPlugin]   ✅ RETURNING resolved path as-is:', resolvedPath)
        return resolvedPath
      }
    } catch (e) {
      console.log('[ResolutionIndexPlugin]   ❌ ERROR in resolveActualPath:', e)
      return null
    }
  }

  private normalizeSourceFile(path: string): string {
    if (!path) return path
    // Strip .deps/npm/, .deps/github/, .deps/http/ prefixes to get canonical package path
    if (path.startsWith('.deps/npm/')) return path.substring('.deps/npm/'.length)
    if (path.startsWith('.deps/github/')) return path.substring('.deps/github/'.length)
    if (path.startsWith('.deps/http/')) {
      // For HTTP paths, keep them as http URLs would be stored
      return path
    }
    return path
  }

  // Helpers
  private buildCandidates(inputPath: string): string[] {
    const out = new Set<string>()
    if (inputPath) out.add(inputPath)
    const gh = this.githubAliasToRaw(inputPath)
    if (gh) out.add(gh)
    const ghBlob = this.githubBlobToRaw(inputPath)
    if (ghBlob) out.add(ghBlob)
    return Array.from(out)
  }

  private githubAliasToRaw(p: string): string | null {
    // github/<owner>/<repo>@<ref>/<rest> -> https://raw.githubusercontent.com/<owner>/<repo>/<ref>/<rest>
    const m = typeof p === 'string' ? p.match(/^github\/([^/]+)\/([^@]+)@([^/]+)\/(.*)$/) : null
    if (!m) return null
    const [, owner, repo, ref, rest] = m
    return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rest}`
  }

  private githubBlobToRaw(p: string): string | null {
    // https://github.com/<o>/<r>/blob/<ref>/<rest> -> https://raw.githubusercontent.com/<o>/<r>/<ref>/<rest>
    const m = typeof p === 'string' ? p.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.*)$/) : null
    if (!m) return null
    const [, owner, repo, ref, rest] = m
    return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rest}`
  }

  private toSuffix(p: string): string {
    // we want to match values like ".deps/github/<o>/<r>@<ref>/<rest>" by suffix "github/<o>/<r>@<ref>/<rest>"
    // if p is already an alias, keep it; if p is a raw URL, convert to alias-ish suffix
    const alias = this.rawToGithubAlias(p)
    return alias ? alias : p
  }

  private rawToGithubAlias(p: string): string | null {
    const m = typeof p === 'string' ? p.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.*)$/) : null
    if (!m) return null
    const [, owner, repo, ref, rest] = m
    return `github/${owner}/${repo}@${ref}/${rest}`
  }

  private findByResolvedSuffix(suffixes: string[]): string | null {
    for (const file in this.index) {
      const map = this.index[file]
      for (const key in map) {
        const value = map[key]
        for (const s of suffixes) {
          if (value.endsWith(s)) return value
        }
      }
    }
    return null
  }

  private externalToDepsPath(p: string): string | null {
    // github alias or raw/blob urls → .deps/github/<owner>/<repo>@<ref>/<rest>
    const alias = this.rawToGithubAlias(p) || this.aliasFromGithubBlob(p) || this.aliasFromGithubAlias(p)
    if (alias) return `.deps/${alias}`
    return null
  }

  private aliasFromGithubAlias(p: string): string | null {
    const m = typeof p === 'string' ? p.match(/^github\/([^/]+)\/([^@]+)@([^/]+)\/(.*)$/) : null
    if (!m) return null
    const [, owner, repo, ref, rest] = m
    return `github/${owner}/${repo}@${ref}/${rest}`
  }

  private aliasFromGithubBlob(p: string): string | null {
    const m = typeof p === 'string' ? p.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.*)$/) : null
    if (!m) return null
    const [, owner, repo, ref, rest] = m
    return `github/${owner}/${repo}@${ref}/${rest}`
  }
}
