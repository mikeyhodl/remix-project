'use strict'
import { Plugin } from '@remixproject/engine'

const profile = {
  name: 'resolutionIndex',
  displayName: 'resolution index',
  version: '0.0.1',
  methods: ['resolveImportFromIndex', 'resolvePath', 'refresh']
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
    const candidates = this.buildCandidates(importPath)
    // 1) Direct lookup by candidates for the given sourceFile
    for (const cand of candidates) {
      if (this.index[sourceFile] && this.index[sourceFile][cand]) {
        return this.index[sourceFile][cand]
      }
    }
    // 2) Fallback: search across all base files for any candidate
    for (const file in this.index) {
      for (const cand of candidates) {
        if (this.index[file] && this.index[file][cand]) {
          return this.index[file][cand]
        }
      }
    }
    // 3) Last chance: fuzzy match by resolved path suffix (handles alias like github/<o>/<r>@<ref>/rest)
    const suffixes = candidates.map((c) => this.toSuffix(c)).filter(Boolean) as string[]
    const hit = this.findByResolvedSuffix(suffixes)
    if (hit) return hit
    return null
  }

  /**
   * Resolve a path (import or external path) to an internal file path for navigation use
   * Does not touch providers or the file system; uses only the in-memory index.
   */
  async resolvePath(sourceFile: string, inputPath: string): Promise<string> {
    const mapped = await this.resolveImportFromIndex(sourceFile, inputPath)
    return mapped || inputPath
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
}
