'use strict'

import { Logger } from './utils/logger'

/**
 * IResolutionIndex Interface
 *
 * Contract for resolution index implementations that track import mappings.
 * Used by both browser (Remix Plugin) and Node.js implementations.
 */
export interface IResolutionIndex {
  /** Load index from storage (idempotent). */
  load(): Promise<void>

  /** Ensure the index is loaded before operations. */
  ensureLoaded(): Promise<void>

  /** Record a mapping: sourceFile imported originalImport → resolvedPath. */
  recordResolution(sourceFile: string, originalImport: string, resolvedPath: string): void

  /** Remove all recorded mappings for a given source file. */
  clearFileResolutions(sourceFile: string): void

  /** Persist index to storage if it changed. */
  save(): Promise<void>
}

/**
 * BaseResolutionIndex
 *
 * Abstract base class providing shared logic for resolution index implementations.
 * Handles path normalization, local path translation, and common index operations.
 */
export abstract class BaseResolutionIndex implements IResolutionIndex {
  protected indexPath: string = '.deps/npm/.resolution-index.json'
  protected index: Record<string, Record<string, string>> = {}
  protected isDirty: boolean = false
  protected loadPromise: Promise<void> | null = null
  protected isLoaded: boolean = false
  protected logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  /** Subclass-specific logging with category. */
  protected abstract log(message: string, ...args: any[]): void

  /** Load index from storage - implemented by subclasses. */
  abstract load(): Promise<void>

  /** Persist index to storage - implemented by subclasses. */
  abstract save(): Promise<void>

  /** Ensure the index is loaded before operations. */
  async ensureLoaded(): Promise<void> {
    if (!this.isLoaded) await this.load()
  }

  /** Normalize a path by stripping .deps prefixes for consistent index keys. */
  protected normalizeSourceFile(path: string): string {
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

  /** Translate a resolved path into a deterministic local path under .deps. */
  protected toLocalPath(resolved: string): string {
    if (!resolved) return resolved
    if (resolved.startsWith('.deps/')) return resolved

    const isHttp = resolved.startsWith('http://') || resolved.startsWith('https://')
    if (isHttp) {
      try {
        const u = new URL(resolved)
        const cleanPath = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname
        return `.deps/http/${u.hostname}/${cleanPath}`
      } catch {
        const safe = resolved.replace(/^[a-zA-Z]+:\/\//, '').replace(/[^-a-zA-Z0-9._/]/g, '_')
        return `.deps/http/${safe}`
      }
    }

    if (resolved.startsWith('github/') || resolved.startsWith('ipfs/') || resolved.startsWith('swarm/')) {
      return `.deps/${resolved}`
    }

    // For npm packages (must contain @ to be a package), add .deps/npm/ prefix
    // This catches both scoped packages (@org/pkg) and versioned packages (pkg@1.0.0)
    // but excludes local workspace files (security/Pausable.sol)
    if (resolved.includes('@') && resolved.match(/^@?[a-zA-Z0-9-~][a-zA-Z0-9._-]*[@/]/) && !resolved.startsWith('.deps/npm/')) {
      return `.deps/npm/${resolved}`
    }

    return resolved
  }

  /** Record a mapping for a source file if it changed since last write. */
  recordResolution(sourceFile: string, originalImport: string, resolvedPath: string): void {
    const normalizedSource = this.normalizeSourceFile(sourceFile)
    if (!this.index[normalizedSource]) this.index[normalizedSource] = {}
    const local = this.toLocalPath(resolvedPath)
    if (this.index[normalizedSource][originalImport] !== local) {
      this.index[normalizedSource][originalImport] = local
      this.isDirty = true
      this.log(`Recorded: ${normalizedSource} | ${originalImport} → ${local}`)
    }
  }

  /** Remove all recorded mappings for a given source file. */
  clearFileResolutions(sourceFile: string): void {
    const normalizedSource = this.normalizeSourceFile(sourceFile)
    if (this.index[normalizedSource]) {
      delete this.index[normalizedSource]
      this.isDirty = true
      this.log(`Cleared resolutions for: ${normalizedSource}`)
    }
  }

  /** Lookup a mapping scoped to a source file. */
  lookup(sourceFile: string, importPath: string): string | null {
    if (this.index[sourceFile] && this.index[sourceFile][importPath]) {
      return this.index[sourceFile][importPath]
    }
    return null
  }

  /** Lookup a mapping across all source files (first hit wins). */
  lookupAny(importPath: string): string | null {
    for (const sourceFile in this.index) {
      if (this.index[sourceFile][importPath]) {
        return this.index[sourceFile][importPath]
      }
    }
    return null
  }

  /** Return all recorded mappings for a given source file. */
  getResolutionsForFile(sourceFile: string): Record<string, string> | null {
    return this.index[sourceFile] || null
  }
}
