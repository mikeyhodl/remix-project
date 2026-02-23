/**
 * Cloud Sync Engine
 *
 * Responsible for:
 *  1. Pulling workspace files from S3 into the local IndexedDB filesystem
 *  2. Tracking local file changes and pushing them to S3
 *  3. Periodic flush of pending changes
 *
 * Pull strategy — **ETag-based manifest diffing**:
 *
 *  We keep a sync manifest per workspace (`.sync-manifest.json`) in IndexedDB
 *  that records the S3 ETag of every file we've synced. On workspace open:
 *
 *   1. Load the local manifest  (free — IndexedDB read)
 *   2. LIST objects on S3        (one cheap LIST request, ~$0.005/1k)
 *   3. Diff ETags: manifest vs. LIST response
 *   4. Only GET files whose ETag differs or that are new
 *   5. Delete local files that exist in manifest but not in LIST
 *   6. Save the updated manifest
 *
 *  Result: switching back to a workspace you just worked on costs exactly
 *  1 LIST request and 0 GETs. First-time sync or changed files pay GETs.
 *
 * Push strategy — unchanged (batch every 10s):
 *  After each successful PUT the S3 response ETag is captured and written
 *  into the manifest so the next pull won't re-download the same file.
 *
 * This does NOT attempt real-time conflict resolution (not Google Docs collab).
 * It's single-user cloud backup keeping the remote in sync with the local.
 */

import { S3Client } from './s3-client'
import { FileChangeRecord, WorkspaceSyncStatus, STSToken, S3Object, SyncManifest } from './types'
import { fetchWorkspaceSTS } from './cloud-workspace-api'

const SYNC_INTERVAL_MS = 10_000   // flush pending changes every 10s
const TOKEN_REFRESH_BUFFER_MS = 60_000  // refresh STS token 60s before expiry
const MANIFEST_FILENAME = '.sync-manifest.json'

export class CloudSyncEngine {
  private s3: S3Client | null = null
  private workspaceUuid: string | null = null
  private pendingChanges: FileChangeRecord[] = []
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null
  private _status: WorkspaceSyncStatus = { status: 'idle', lastSync: null, pendingChanges: 0 }
  private onStatusChange: ((status: WorkspaceSyncStatus) => void) | null = null
  private isSyncing = false

  /** In-memory copy of the manifest, loaded on activate and kept in sync */
  private manifest: SyncManifest | null = null

  /** Reference to the local filesystem (window.remixFileSystem) */
  private get fs(): any {
    return (window as any).remixFileSystem
  }

  /** Absolute path to workspace files in local FS: /.cloud-workspaces/<uuid> */
  private localWorkspacePath: string | null = null

  /** Public name so external code (change tracking) can filter it out */
  static readonly MANIFEST_FILENAME = MANIFEST_FILENAME

  // ── Lifecycle ─────────────────────────────────────────────

  /**
   * Initialize the sync engine for a cloud workspace.
   * Fetches workspace-scoped STS and starts the change push timer.
   *
   * @param workspaceUuid  The cloud workspace UUID (also used as local dir name under /.cloud-workspaces/)
   * @param onStatusChange Optional callback for sync status updates
   */
  async activate(workspaceUuid: string, onStatusChange?: (s: WorkspaceSyncStatus) => void): Promise<void> {
    this.deactivate()
    this.workspaceUuid = workspaceUuid
    this.localWorkspacePath = `/.cloud-workspaces/${workspaceUuid}`
    this.onStatusChange = onStatusChange || null
    this.pendingChanges = []

    // Get workspace-scoped STS
    const token = await fetchWorkspaceSTS(workspaceUuid)
    this.s3 = new S3Client(token)
    this.scheduleTokenRefresh(token)

    // Load existing manifest (or create empty one)
    this.manifest = await this.loadManifest()

    // Start periodic flush
    this.syncTimer = setInterval(() => this.flushChanges(), SYNC_INTERVAL_MS)

    this.updateStatus({ status: 'idle', lastSync: null, pendingChanges: 0 })
  }

  /**
   * Stop the sync engine, cancel timers.
   * Call this when switching workspaces or logging out.
   */
  deactivate(): void {
    if (this.syncTimer) clearInterval(this.syncTimer)
    if (this.tokenRefreshTimer) clearTimeout(this.tokenRefreshTimer)
    this.syncTimer = null
    this.tokenRefreshTimer = null
    this.s3 = null
    this.workspaceUuid = null
    this.localWorkspacePath = null
    this.pendingChanges = []
    this.isSyncing = false
    this.onStatusChange = null
    this.manifest = null
  }

  get isActive(): boolean {
    return this.s3 !== null && this.workspaceUuid !== null
  }

  get status(): WorkspaceSyncStatus {
    return { ...this._status }
  }

  // ── Pull: S3 → Local (manifest-diffed) ───────────────────

  /**
   * Smart pull: compare S3 listing against local manifest, only download
   * files whose ETag has changed or that are new. Delete local files
   * whose keys have been removed from S3.
   *
   * @returns Stats about what happened
   */
  async pullWorkspace(): Promise<{ downloaded: number; skipped: number; deleted: number }> {
    if (!this.s3 || !this.workspaceUuid || !this.localWorkspacePath) {
      return { downloaded: 0, skipped: 0, deleted: 0 }
    }
    this.updateStatus({ ...this._status, status: 'syncing' })

    try {
      const manifest = this.manifest!

      // ── 1. One LIST request to get all remote objects + their ETags ──
      const remoteObjects = await this.s3.listObjects('')
      const remoteMap = new Map<string, S3Object>()
      for (const obj of remoteObjects) {
        if (!obj.key.endsWith('/')) { // skip directory markers
          remoteMap.set(obj.key, obj)
        }
      }

      // ── 2. Diff against manifest ──
      const toDownload: S3Object[] = []
      const toDelete: string[] = []
      let skipped = 0

      // Check each remote object against what we already have
      for (const [key, obj] of remoteMap) {
        const entry = manifest.files[key]
        if (entry && entry.etag && entry.etag === obj.etag) {
          // ETag matches — content unchanged since last sync, skip
          skipped++
        } else {
          // New file or ETag mismatch — need to download
          toDownload.push(obj)
        }
      }

      // Check for remote deletions: files in manifest but no longer on S3
      for (const key of Object.keys(manifest.files)) {
        if (!remoteMap.has(key)) {
          toDelete.push(key)
        }
      }

      console.log(
        `[CloudSync] Pull diff: ${toDownload.length} to download, ` +
        `${skipped} up-to-date, ${toDelete.length} remote deletions`
      )

      // ── 3. Short-circuit if nothing to do ──
      if (toDownload.length === 0 && toDelete.length === 0) {
        manifest.lastSyncTimestamp = Date.now()
        await this.saveManifest(manifest)
        this.updateStatus({ status: 'idle', lastSync: Date.now(), pendingChanges: this._status.pendingChanges })
        return { downloaded: 0, skipped, deleted: 0 }
      }

      // ── 4. Ensure workspace root exists ──
      await this.ensureDir(this.localWorkspacePath)

      // ── 5. Download changed / new files ──
      for (const obj of toDownload) {
        const localPath = `${this.localWorkspacePath}/${obj.key}`
        const parentDir = localPath.substring(0, localPath.lastIndexOf('/'))
        await this.ensureDir(parentDir)

        const content = await this.s3.getObject(obj.key)
        if (content !== null) {
          await this.fs.writeFile(localPath, content, 'utf8')
          // Update manifest with the remote ETag
          manifest.files[obj.key] = {
            etag: obj.etag || '',
            lastModified: obj.lastModified.toISOString(),
            size: obj.size,
          }
        }
      }

      // ── 6. Delete files removed on remote ──
      for (const key of toDelete) {
        const localPath = `${this.localWorkspacePath}/${key}`
        try {
          await this.fs.unlink(localPath)
        } catch {
          // file may already be gone locally — that's fine
        }
        delete manifest.files[key]
      }

      // ── 7. Persist updated manifest ──
      manifest.lastSyncTimestamp = Date.now()
      await this.saveManifest(manifest)

      this.updateStatus({ status: 'idle', lastSync: Date.now(), pendingChanges: this._status.pendingChanges })
      return { downloaded: toDownload.length, skipped, deleted: toDelete.length }
    } catch (error) {
      console.error('[CloudSync] Pull failed:', error)
      this.updateStatus({ status: 'error', lastSync: this._status.lastSync, pendingChanges: this._status.pendingChanges, error: error.message })
      throw error
    }
  }

  /**
   * Force a full re-download by clearing the manifest first.
   * Use when user explicitly requests a full resync.
   */
  async forcePull(): Promise<{ downloaded: number; skipped: number; deleted: number }> {
    if (this.manifest) {
      this.manifest.files = {}
      this.manifest.lastSyncTimestamp = 0
    }
    return this.pullWorkspace()
  }

  // ── Push: Local → S3 ─────────────────────────────────────

  /**
   * Record a local file change to be pushed to S3.
   * Call this from the file provider event handlers.
   */
  trackChange(change: FileChangeRecord): void {
    if (!this.isActive) return

    // Never track the manifest file itself
    if (change.path === MANIFEST_FILENAME || change.path.endsWith('/' + MANIFEST_FILENAME)) return

    // De-duplicate: if there's already a pending change for this path, update it
    const existingIdx = this.pendingChanges.findIndex(c => c.path === change.path)
    if (existingIdx >= 0) {
      // If we have add then delete, they cancel out
      const existing = this.pendingChanges[existingIdx]
      if (existing.type === 'add' && change.type === 'delete') {
        this.pendingChanges.splice(existingIdx, 1)
      } else {
        this.pendingChanges[existingIdx] = change
      }
    } else {
      this.pendingChanges.push(change)
    }

    this.updateStatus({ ...this._status, pendingChanges: this.pendingChanges.length })
  }

  /**
   * Flush all pending changes to S3. Called periodically and on-demand.
   */
  async flushChanges(): Promise<void> {
    if (!this.isActive || this.isSyncing || this.pendingChanges.length === 0) return

    this.isSyncing = true
    this.updateStatus({ ...this._status, status: 'syncing' })
    const changes = [...this.pendingChanges]
    this.pendingChanges = []

    try {
      for (const change of changes) {
        try {
          await this.pushChange(change)
        } catch (err) {
          console.error(`[CloudSync] Failed to push change ${change.type} ${change.path}:`, err)
          // Re-queue failed change
          this.pendingChanges.push(change)
        }
      }

      // Persist manifest after batch (captures all new ETags from PUT responses)
      await this.saveManifest(this.manifest!)

      this.updateStatus({
        status: this.pendingChanges.length > 0 ? 'error' : 'idle',
        lastSync: Date.now(),
        pendingChanges: this.pendingChanges.length,
        error: this.pendingChanges.length > 0 ? 'Some changes failed to sync' : undefined,
      })
    } catch (error) {
      console.error('[CloudSync] Flush failed:', error)
      // Re-queue all changes
      this.pendingChanges.push(...changes)
      this.updateStatus({ status: 'error', lastSync: this._status.lastSync, pendingChanges: this.pendingChanges.length, error: error.message })
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Push a single file change to S3 and update the in-memory manifest.
   */
  private async pushChange(change: FileChangeRecord): Promise<void> {
    if (!this.s3 || !this.localWorkspacePath || !this.manifest) return

    switch (change.type) {
    case 'add':
    case 'change': {
      const localPath = `${this.localWorkspacePath}/${change.path}`
      try {
        const content = await this.fs.readFile(localPath, 'utf8')
        const etag = await this.s3.putObject(change.path, content)
        // Capture the ETag from S3's response so the next pull recognises
        // this file as already-synced and skips the GET.
        this.manifest.files[change.path] = {
          etag,
          lastModified: new Date().toISOString(),
          size: typeof content === 'string' ? new TextEncoder().encode(content).byteLength : content.length,
        }
      } catch (err) {
        // File may have been deleted between tracking and flushing
        if (err.code === 'ENOENT') return
        throw err
      }
      break
    }
    case 'delete':
      await this.s3.deleteObject(change.path)
      delete this.manifest.files[change.path]
      break
    case 'rename':
      if (change.oldPath) {
        // Delete old
        await this.s3.deleteObject(change.oldPath)
        delete this.manifest.files[change.oldPath]
        // Upload new
        const localPath = `${this.localWorkspacePath}/${change.path}`
        try {
          const content = await this.fs.readFile(localPath, 'utf8')
          const etag = await this.s3.putObject(change.path, content)
          this.manifest.files[change.path] = {
            etag,
            lastModified: new Date().toISOString(),
            size: typeof content === 'string' ? new TextEncoder().encode(content).byteLength : content.length,
          }
        } catch (err) {
          if (err.code === 'ENOENT') return
          throw err
        }
      }
      break
    }
  }

  /**
   * Force an immediate sync of all pending changes.
   */
  async forcePush(): Promise<void> {
    await this.flushChanges()
  }

  // ── Manifest persistence ──────────────────────────────────

  private get manifestPath(): string {
    return `${this.localWorkspacePath}/${MANIFEST_FILENAME}`
  }

  /**
   * Load the sync manifest from IndexedDB.
   * Returns a fresh empty manifest if none exists or it's corrupt.
   */
  private async loadManifest(): Promise<SyncManifest> {
    try {
      const raw = await this.fs.readFile(this.manifestPath, 'utf8')
      const data = JSON.parse(raw) as SyncManifest
      if (data.version === 1 && data.files) return data
    } catch {
      // No manifest or invalid JSON — treat as first sync
    }
    return { version: 1, lastSyncTimestamp: 0, files: {} }
  }

  /**
   * Persist the in-memory manifest to IndexedDB.
   */
  private async saveManifest(manifest: SyncManifest): Promise<void> {
    if (!this.localWorkspacePath) return
    try {
      await this.ensureDir(this.localWorkspacePath)
      await this.fs.writeFile(this.manifestPath, JSON.stringify(manifest), 'utf8')
    } catch (err) {
      console.error('[CloudSync] Failed to save manifest:', err)
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  private async ensureDir(path: string): Promise<void> {
    try {
      await this.fs.stat(path)
    } catch {
      // Create directory recursively
      const parts = path.split('/').filter(Boolean)
      let current = ''
      for (const part of parts) {
        current += '/' + part
        try {
          await this.fs.stat(current)
        } catch {
          await this.fs.mkdir(current)
        }
      }
    }
  }

  private scheduleTokenRefresh(token: STSToken): void {
    if (this.tokenRefreshTimer) clearTimeout(this.tokenRefreshTimer)
    const expiresAt = new Date(token.expiration).getTime()
    const refreshIn = Math.max(expiresAt - Date.now() - TOKEN_REFRESH_BUFFER_MS, 5000)

    this.tokenRefreshTimer = setTimeout(async () => {
      try {
        if (!this.workspaceUuid) return
        const newToken = await fetchWorkspaceSTS(this.workspaceUuid)
        this.s3?.updateToken(newToken)
        this.scheduleTokenRefresh(newToken)
      } catch (err) {
        console.error('[CloudSync] Token refresh failed:', err)
        // Retry in 30s
        this.tokenRefreshTimer = setTimeout(() => this.scheduleTokenRefresh(token), 30_000)
      }
    }, refreshIn)
  }

  private updateStatus(status: WorkspaceSyncStatus): void {
    this._status = status
    this.onStatusChange?.(status)
  }
}

// Singleton
export const cloudSyncEngine = new CloudSyncEngine()
