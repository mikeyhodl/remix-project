/**
 * Cloud Sync Engine
 *
 * Responsible for:
 *  1. Pulling workspace files from S3 into the local IndexedDB filesystem
 *  2. Tracking local file changes and pushing them to S3
 *  3. Periodic flush of pending changes
 *
 * The sync strategy is "local-first":
 *  - On workspace open → full pull from S3 into local FS
 *  - On local change   → record change, batch-push on interval
 *  - On explicit save   → immediate push
 *
 * This does NOT attempt real-time conflict resolution (not Google Docs collab).
 * It's single-user cloud backup keeping the remote in sync with the local.
 */

import { S3Client } from './s3-client'
import { FileChangeRecord, WorkspaceSyncStatus, STSToken, S3Object } from './types'
import { fetchWorkspaceSTS } from './cloud-workspace-api'

const SYNC_INTERVAL_MS = 10_000   // flush pending changes every 10s
const TOKEN_REFRESH_BUFFER_MS = 60_000  // refresh STS token 60s before expiry

export class CloudSyncEngine {
  private s3: S3Client | null = null
  private workspaceUuid: string | null = null
  private pendingChanges: FileChangeRecord[] = []
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null
  private _status: WorkspaceSyncStatus = { status: 'idle', lastSync: null, pendingChanges: 0 }
  private onStatusChange: ((status: WorkspaceSyncStatus) => void) | null = null
  private isSyncing = false

  /** Reference to the local filesystem (window.remixFileSystem) */
  private get fs(): any {
    return (window as any).remixFileSystem
  }

  /** The path to workspace files in local FS: /.workspaces/<name>/ */
  private localWorkspacePath: string | null = null

  // ── Lifecycle ─────────────────────────────────────────────

  /**
   * Initialize the sync engine for a cloud workspace.
   * Fetches workspace-scoped STS and starts the change push timer.
   */
  async activate(workspaceUuid: string, localWorkspaceName: string, onStatusChange?: (s: WorkspaceSyncStatus) => void): Promise<void> {
    this.deactivate()
    this.workspaceUuid = workspaceUuid
    this.localWorkspacePath = `/.workspaces/${localWorkspaceName}`
    this.onStatusChange = onStatusChange || null
    this.pendingChanges = []

    // Get workspace-scoped STS
    const token = await fetchWorkspaceSTS(workspaceUuid)
    this.s3 = new S3Client(token)
    this.scheduleTokenRefresh(token)

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
  }

  get isActive(): boolean {
    return this.s3 !== null && this.workspaceUuid !== null
  }

  get status(): WorkspaceSyncStatus {
    return { ...this._status }
  }

  // ── Pull: S3 → Local ─────────────────────────────────────

  /**
   * Full pull: download all files from S3 workspace into local FS.
   * This is the initial sync when opening a cloud workspace.
   */
  async pullWorkspace(): Promise<void> {
    if (!this.s3 || !this.workspaceUuid || !this.localWorkspacePath) return
    this.updateStatus({ ...this._status, status: 'syncing' })

    try {
      // List all objects in the workspace prefix on S3
      // The S3 client prefix is already users/{userId}/ and the workspace
      // files are stored under {workspaceUuid}/ within that.
      // But workspace-scoped STS prefix is: users/{userId}/{workspaceUuid}/
      // So we list with empty subPrefix to get everything under that scope.
      const objects = await this.s3.listObjects('')

      // Ensure local workspace directory exists
      await this.ensureDir(this.localWorkspacePath)

      // Download each file
      for (const obj of objects) {
        if (obj.key.endsWith('/')) continue // skip directory markers
        const localPath = `${this.localWorkspacePath}/${obj.key}`

        // Ensure parent directories exist
        const parentDir = localPath.substring(0, localPath.lastIndexOf('/'))
        await this.ensureDir(parentDir)

        // Download and write
        const content = await this.s3.getObject(obj.key)
        if (content !== null) {
          await this.fs.writeFile(localPath, content, 'utf8')
        }
      }

      // Clean up local files that don't exist on S3 (deletions from remote)
      const remoteKeys = new Set(objects.map(o => o.key))
      await this.cleanupLocal(this.localWorkspacePath, '', remoteKeys)

      this.updateStatus({ status: 'idle', lastSync: Date.now(), pendingChanges: 0 })
    } catch (error) {
      console.error('[CloudSync] Pull failed:', error)
      this.updateStatus({ status: 'error', lastSync: this._status.lastSync, pendingChanges: this._status.pendingChanges, error: error.message })
      throw error
    }
  }

  // ── Push: Local → S3 ─────────────────────────────────────

  /**
   * Record a local file change to be pushed to S3.
   * Call this from the file provider event handlers.
   */
  trackChange(change: FileChangeRecord): void {
    if (!this.isActive) return

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
   * Push a single file change to S3.
   */
  private async pushChange(change: FileChangeRecord): Promise<void> {
    if (!this.s3 || !this.localWorkspacePath) return

    switch (change.type) {
    case 'add':
    case 'change': {
      const localPath = `${this.localWorkspacePath}/${change.path}`
      try {
        const content = await this.fs.readFile(localPath, 'utf8')
        await this.s3.putObject(change.path, content)
      } catch (err) {
        // File may have been deleted between tracking and flushing
        if (err.code === 'ENOENT') return
        throw err
      }
      break
    }
    case 'delete':
      await this.s3.deleteObject(change.path)
      break
    case 'rename':
      if (change.oldPath) {
        // Delete old, upload new
        await this.s3.deleteObject(change.oldPath)
        const localPath = `${this.localWorkspacePath}/${change.path}`
        try {
          const content = await this.fs.readFile(localPath, 'utf8')
          await this.s3.putObject(change.path, content)
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

  /**
   * Remove local files that no longer exist on S3.
   */
  private async cleanupLocal(basePath: string, relativePath: string, remoteKeys: Set<string>): Promise<void> {
    try {
      const fullPath = relativePath ? `${basePath}/${relativePath}` : basePath
      const entries = await this.fs.readdir(fullPath)
      for (const entry of entries) {
        const entryRelPath = relativePath ? `${relativePath}/${entry}` : entry
        const entryFullPath = `${basePath}/${entryRelPath}`
        try {
          const stat = await this.fs.stat(entryFullPath)
          if (stat.isDirectory()) {
            await this.cleanupLocal(basePath, entryRelPath, remoteKeys)
          } else {
            if (!remoteKeys.has(entryRelPath)) {
              await this.fs.unlink(entryFullPath)
            }
          }
        } catch {
          // ignore stat errors
        }
      }
    } catch {
      // ignore readdir errors (dir may not exist yet)
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
