/**
 * Cloud Sync Engine — Hybrid ZIP + Incremental
 *
 * Responsible for:
 *  1. Pulling workspace files from S3 into the local IndexedDB filesystem
 *  2. Tracking local file changes and pushing them to S3
 *  3. Periodic flush of pending changes
 *  4. Maintaining a workspace.zip snapshot for fast bulk loads
 *
 * Pull strategy — **hybrid ZIP + ETag-based diffing**:
 *
 *  On workspace open we check for a local sync manifest:
 *
 *  A) **No manifest (first load on this device)**:
 *     1. GET `_workspace.zip` from S3          (1 request)
 *     2. Extract into IndexedDB                (local, fast)
 *     3. LIST objects on S3 to build manifest   (1 request)
 *     → Total: 2 requests regardless of workspace size
 *
 *  B) **Manifest exists (returning visit)**:
 *     1. LIST objects on S3                     (1 request)
 *     2. Diff ETags: manifest vs. LIST
 *     3. GET only files whose ETag changed       (N requests, usually 0)
 *     → Total: 1 LIST + N GETs
 *
 *  Result: first-time load of a 200-file workspace costs 2 requests (ZIP+LIST),
 *  not 201 (LIST + 200 GETs).  Return visits cost 1 LIST + 0-few GETs.
 *
 * Push strategy:
 *  - Individual file PUTs every 10s (batch flush) — immediate, granular
 *  - After each flush, a debounced snapshot re-zips the workspace and
 *    PUTs `_workspace.zip` so the next fresh client gets a fast bulk load.
 *
 * This does NOT attempt real-time conflict resolution (not Google Docs collab).
 * It's single-user cloud backup keeping the remote in sync with the local.
 */

import { S3Client } from './s3-client'
import { FileChangeRecord, WorkspaceSyncStatus, STSToken, S3Object, SyncManifest } from './types'
import { fetchWorkspaceSTS } from './cloud-workspace-api'
import { packWorkspace, unpackWorkspace, WORKSPACE_ZIP_KEY } from './cloud-workspace-zip'

const SYNC_INTERVAL_MS = 10_000   // flush pending changes every 10s
const TOKEN_REFRESH_BUFFER_MS = 60_000  // refresh STS token 60s before expiry
const MANIFEST_FILENAME = '.sync-manifest.json'
const SNAPSHOT_DEBOUNCE_MS = 30_000  // re-zip 30s after last push flush
const PARALLEL_CONCURRENCY = 6      // max parallel S3 requests (browser limit per origin)

export class CloudSyncEngine {
  private s3: S3Client | null = null
  private workspaceUuid: string | null = null
  private pendingChanges: FileChangeRecord[] = []
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null
  private _status: WorkspaceSyncStatus = { status: 'idle', lastSync: null, pendingChanges: 0 }
  private onStatusChange: ((status: WorkspaceSyncStatus) => void) | null = null
  private isSyncing = false

  /**
   * When true, the FS observer should NOT queue writes as pending changes.
   * Set during pullWorkspace() so that files downloaded from S3 and written
   * to IndexedDB don't get immediately re-pushed back.
   */
  private _isPulling = false

  /** Public check used by handleRawFSWrite to skip change tracking during pull */
  get isPulling(): boolean {
    return this._isPulling
  }

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
    await this.deactivate()
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
   *
   * Flushes any pending changes first so nothing is lost on workspace switch.
   */
  async deactivate(): Promise<void> {
    // Flush pending changes before tearing down
    if (this.pendingChanges.length > 0 && this.s3 && this.workspaceUuid) {
      console.log(`[CloudSync] Flushing ${this.pendingChanges.length} pending changes before deactivate`)
      try {
        await this.flushChanges()
      } catch (err) {
        console.warn('[CloudSync] Flush on deactivate failed:', err.message || err)
      }
    }

    if (this.syncTimer) clearInterval(this.syncTimer)
    if (this.tokenRefreshTimer) clearTimeout(this.tokenRefreshTimer)
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer)
    this.syncTimer = null
    this.tokenRefreshTimer = null
    this.snapshotTimer = null
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

  // ── Pull: S3 → Local (hybrid ZIP + incremental) ────────

  /**
   * Hybrid pull:
   *
   * A) No manifest (first load) → GET _workspace.zip, extract, LIST to build manifest
   * B) Manifest exists → LIST + ETag diff, GET only changed files
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
      const isFreshLoad = Object.keys(manifest.files).length === 0

      // ── Suppress change tracking for all writes during pull ──
      this._isPulling = true

      if (isFreshLoad) {
        // ── Strategy A: ZIP-based bulk load ──────────────────
        const stats = await this.pullViaZip(manifest)
        this._isPulling = false
        return stats
      } else {
        // ── Strategy B: Incremental ETag-based diff ──────────
        const stats = await this.pullIncremental(manifest)
        this._isPulling = false
        return stats
      }
    } catch (error) {
      this._isPulling = false
      console.error('[CloudSync] Pull failed:', error)
      this.updateStatus({ status: 'error', lastSync: this._status.lastSync, pendingChanges: this._status.pendingChanges, error: error.message })
      throw error
    }
  }

  /**
   * Strategy A: Download _workspace.zip, extract all files, then LIST
   * to populate manifest ETags for future incremental syncs.
   */
  private async pullViaZip(manifest: SyncManifest): Promise<{ downloaded: number; skipped: number; deleted: number }> {
    console.log('[CloudSync] Fresh load — attempting ZIP-based pull')

    const zipData = await this.s3!.getObjectBinary(WORKSPACE_ZIP_KEY)

    if (zipData) {
      // ── 1. Extract ZIP into local FS ──
      const { manifest: zipManifest, fileCount } = await unpackWorkspace(
        zipData,
        this.localWorkspacePath!,
        this.fs,
      )
      console.log(`[CloudSync] Extracted ${fileCount} files from workspace.zip`)

      // ── 2. LIST to get real ETags for the manifest ──
      const remoteObjects = await this.s3!.listObjects('')
      const extraDownloads: S3Object[] = []
      for (const obj of remoteObjects) {
        if (obj.key.endsWith('/')) continue  // skip dir markers
        if (obj.key === WORKSPACE_ZIP_KEY) continue  // skip the zip itself
        if (zipManifest.files[obj.key]) {
          // Overwrite with real S3 ETag so incremental diff works next time
          zipManifest.files[obj.key].etag = obj.etag || ''
          zipManifest.files[obj.key].lastModified = obj.lastModified.toISOString()
          zipManifest.files[obj.key].size = obj.size
        } else {
          // File on S3 but not in ZIP (added after last snapshot) — download later
          extraDownloads.push(obj)
        }
      }

      // Download extra files in parallel
      if (extraDownloads.length > 0) {
        console.log(`[CloudSync] Downloading ${extraDownloads.length} files not in ZIP (parallel)`)
        await parallelMap(extraDownloads, async (obj) => {
          const localPath = `${this.localWorkspacePath}/${obj.key}`
          const parentDir = localPath.substring(0, localPath.lastIndexOf('/'))
          await this.ensureDir(parentDir)

          const content = await this.s3!.getObject(obj.key)
          if (content !== null) {
            await this.fs.writeFile(localPath, content, 'utf8')
            zipManifest.files[obj.key] = {
              etag: obj.etag || '',
              lastModified: obj.lastModified.toISOString(),
              size: obj.size,
            }
          }
        }, PARALLEL_CONCURRENCY)
      }

      // ── 3. Adopt the zip manifest as our manifest ──
      Object.assign(manifest, { files: zipManifest.files, lastSyncTimestamp: Date.now() })
      await this.saveManifest(manifest)

      const downloaded = fileCount
      this.updateStatus({ status: 'idle', lastSync: Date.now(), pendingChanges: this._status.pendingChanges })
      return { downloaded, skipped: 0, deleted: 0 }
    } else {
      // No ZIP exists yet — fall back to incremental (downloads every file one by one)
      console.log('[CloudSync] No workspace.zip found — falling back to incremental pull')
      return this.pullIncremental(manifest)
    }
  }

  /**
   * Strategy B: LIST + ETag diff, GET only changed files.
   * This is the original smart-pull logic.
   */
  private async pullIncremental(manifest: SyncManifest): Promise<{ downloaded: number; skipped: number; deleted: number }> {
    // ── 1. LIST request to get all remote objects + their ETags ──
    const remoteObjects = await this.s3!.listObjects('')
    const remoteMap = new Map<string, S3Object>()
    for (const obj of remoteObjects) {
      if (!obj.key.endsWith('/') && obj.key !== WORKSPACE_ZIP_KEY) {
        remoteMap.set(obj.key, obj)
      }
    }

    // ── 2. Diff against manifest ──
    const toDownload: S3Object[] = []
    const toDelete: string[] = []
    let skipped = 0

    for (const [key, obj] of remoteMap) {
      const entry = manifest.files[key]
      if (entry && entry.etag && entry.etag === obj.etag) {
        skipped++
      } else {
        toDownload.push(obj)
      }
    }

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
    await this.ensureDir(this.localWorkspacePath!)

    // ── 5. Download changed / new files (parallel) ──
    await parallelMap(toDownload, async (obj) => {
      const localPath = `${this.localWorkspacePath}/${obj.key}`
      const parentDir = localPath.substring(0, localPath.lastIndexOf('/'))
      await this.ensureDir(parentDir)

      // Send If-None-Match with the old ETag we have locally — S3 returns
      // 304 if the file was reverted between LIST and GET, saving bandwidth.
      const localEtag = manifest.files[obj.key]?.etag
      const content = await this.s3!.getObject(obj.key, localEtag || undefined)
      if (content !== null) {
        await this.fs.writeFile(localPath, content, 'utf8')
        manifest.files[obj.key] = {
          etag: obj.etag || '',
          lastModified: obj.lastModified.toISOString(),
          size: obj.size,
        }
      }
    }, PARALLEL_CONCURRENCY)

    // ── 6. Delete files removed on remote (parallel) ──
    await parallelMap(toDelete, async (key) => {
      const localPath = `${this.localWorkspacePath}/${key}`
      try {
        await this.fs.unlink(localPath)
      } catch {
        // file may already be gone locally
      }
      delete manifest.files[key]
    }, PARALLEL_CONCURRENCY)

    // ── 7. Persist updated manifest ──
    manifest.lastSyncTimestamp = Date.now()
    await this.saveManifest(manifest)

    this.updateStatus({ status: 'idle', lastSync: Date.now(), pendingChanges: this._status.pendingChanges })
    return { downloaded: toDownload.length, skipped, deleted: toDelete.length }
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

    // Never track the snapshot ZIP (managed by the engine, not user files)
    if (change.path === WORKSPACE_ZIP_KEY || change.path.endsWith('/' + WORKSPACE_ZIP_KEY)) return

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
    this.updateStatus({ ...this._status, status: 'pushing' })
    const changes = [...this.pendingChanges]
    this.pendingChanges = []

    try {
      // Push changes in parallel batches for throughput
      await parallelMap(changes, async (change) => {
        try {
          await this.pushChange(change)
        } catch (err) {
          const retries = (change._retryCount || 0) + 1
          if (retries < 5) {
            console.warn(`[CloudSync] Failed to push change ${change.type} ${change.path} (retry ${retries}/5):`, err.message || err)
            this.pendingChanges.push({ ...change, _retryCount: retries })
          } else {
            console.error(`[CloudSync] Giving up on ${change.type} ${change.path} after 5 retries:`, err.message || err)
          }
        }
      }, PARALLEL_CONCURRENCY)

      // Persist manifest after batch (captures all new ETags from PUT responses)
      await this.saveManifest(this.manifest!)

      this.updateStatus({
        status: this.pendingChanges.length > 0 ? 'error' : 'idle',
        lastSync: Date.now(),
        pendingChanges: this.pendingChanges.length,
        error: this.pendingChanges.length > 0 ? 'Some changes failed to sync' : undefined,
      })

      // Schedule a debounced snapshot update so the next fresh client
      // gets a ZIP that includes these changes.
      this.scheduleSnapshotUpdate()
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
        // Check if this is a directory — S3 uses key prefixes, not real dirs.
        // Directories should never be pushed as file objects.
        const stat = await this.fs.stat(localPath)
        if (stat.isDirectory()) return

        const content = await this.fs.readFile(localPath, 'utf8')
        if (content == null) return  // guard against undefined readFile results
        const etag = await this.s3.putObject(change.path, content)
        if (!etag) return  // guard against missing ETag (shouldn't happen)
        // Capture the ETag from S3's response so the next pull recognises
        // this file as already-synced and skips the GET.
        this.manifest.files[change.path] = {
          etag,
          lastModified: new Date().toISOString(),
          size: typeof content === 'string' ? new TextEncoder().encode(content).byteLength : (content as any).length ?? 0,
        }
      } catch (err) {
        // File may have been deleted between tracking and flushing
        if (err.code === 'ENOENT') return
        throw err
      }
      break
    }
    case 'delete':
      try {
        await this.s3.deleteObject(change.path)
      } catch (err) {
        // CORS / network errors on DELETE should not block the sync engine.
        // The file will be cleaned up on the next full sync or stay as orphan.
        console.warn(`[CloudSync] DELETE ${change.path} failed (non-fatal):`, err.message || err)
      }
      delete this.manifest.files[change.path]
      break
    case 'rename':
      if (change.oldPath) {
        // Upload the new file FIRST — PUTs are reliable.
        const localPath = `${this.localWorkspacePath}/${change.path}`
        try {
          const stat = await this.fs.stat(localPath)
          if (stat.isDirectory()) return

          const content = await this.fs.readFile(localPath, 'utf8')
          if (content == null) return
          const etag = await this.s3.putObject(change.path, content)
          if (!etag) return
          this.manifest.files[change.path] = {
            etag,
            lastModified: new Date().toISOString(),
            size: typeof content === 'string' ? new TextEncoder().encode(content).byteLength : (content as any).length ?? 0,
          }
        } catch (err) {
          if (err.code === 'ENOENT') return
          throw err
        }
        // Best-effort delete old key.  If CORS blocks DELETE, the orphan
        // will be cleaned up on next full sync.  Don't let it block the rename.
        try {
          await this.s3.deleteObject(change.oldPath)
        } catch (err) {
          console.warn(`[CloudSync] DELETE old key ${change.oldPath} failed (non-fatal):`, err.message || err)
        }
        delete this.manifest.files[change.oldPath]
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

  // ── Snapshot ZIP ──────────────────────────────────────────

  /**
   * Schedule a debounced re-zip of the workspace.
   * Called after each successful flush so the _workspace.zip stays
   * roughly up-to-date without zipping on every single file save.
   */
  private scheduleSnapshotUpdate(): void {
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer)
    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null
      this.pushSnapshot().catch(err => {
        console.warn('[CloudSync] Snapshot update failed (non-fatal):', err.message || err)
      })
    }, SNAPSHOT_DEBOUNCE_MS)
  }

  /**
   * Re-zip the entire workspace and PUT _workspace.zip to S3.
   * This is a background operation — failure is non-fatal.
   */
  private async pushSnapshot(): Promise<void> {
    if (!this.s3 || !this.localWorkspacePath) return

    console.log('[CloudSync] Generating workspace snapshot ZIP...')
    const startTime = Date.now()

    const zipData = await packWorkspace(this.localWorkspacePath, this.fs)

    console.log(
      `[CloudSync] Snapshot ZIP: ${(zipData.byteLength / 1024).toFixed(1)} KB, ` +
      `packed in ${Date.now() - startTime}ms`
    )

    await this.s3.putObject(WORKSPACE_ZIP_KEY, zipData, 'application/zip')
    console.log('[CloudSync] Snapshot ZIP uploaded to S3')
  }

  /**
   * Force an immediate snapshot push (e.g. on workspace close or logout).
   */
  async forceSnapshot(): Promise<void> {
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer)
      this.snapshotTimer = null
    }
    await this.pushSnapshot()
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
          try {
            await this.fs.mkdir(current)
          } catch (mkdirErr: any) {
            // Ignore EEXIST — another operation may have created the dir concurrently
            if (mkdirErr?.code !== 'EEXIST' && mkdirErr?.message !== 'EEXIST' && !String(mkdirErr).includes('EEXIST')) {
              throw mkdirErr
            }
          }
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

// ── Concurrency helper ──────────────────────────────────────

/**
 * Process items in parallel with a concurrency limit.
 * Like Promise.all but runs at most `concurrency` tasks at a time.
 */
async function parallelMap<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  if (items.length === 0) return
  const limit = Math.min(concurrency, items.length)
  let idx = 0

  async function worker() {
    while (idx < items.length) {
      const i = idx++
      await fn(items[i])
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()))
}

// Singleton
export const cloudSyncEngine = new CloudSyncEngine()
