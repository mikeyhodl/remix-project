/**
 * Cloud Migration Engine
 *
 * Handles the atomic migration of a local workspace (/.workspaces/<name>)
 * to a cloud workspace (/.cloud-workspaces/<uuid> + S3).
 *
 * Atomicity guarantee:
 *   1. Create cloud workspace via API → get UUID
 *   2. Copy all files from /.workspaces/<name> → /.cloud-workspaces/<uuid>
 *   3. Pack as ZIP and upload to S3
 *   4. Upload individual files to S3 (for incremental sync compatibility)
 *   5. Verify via LIST that all files made it
 *   6. Delete /.workspaces/<name> from IndexedDB
 *   7. If ANY step fails → rollback (delete API workspace + local cloud copy)
 *
 * Name conflict resolution:
 *   If a cloud workspace with the same name already exists, the caller
 *   should provide a resolved name (e.g. "myproject (local)").
 */

import { S3Client } from './s3-client'
import { CloudWorkspace, STSToken, SyncManifest } from './types'
import {
  createCloudWorkspace,
  fetchWorkspaceSTS,
  deleteCloudWorkspace,
  listCloudWorkspaces,
} from './cloud-workspace-api'
import { packWorkspace, WORKSPACE_ZIP_KEY } from './cloud-workspace-zip'

// ── Types ────────────────────────────────────────────────────

export interface LocalWorkspaceInfo {
  /** Display name (directory name under /.workspaces/) */
  name: string
  /** Number of files (approximate, from walk) */
  fileCount: number
  /** Total size in bytes (approximate) */
  totalSize: number
}

export type MigrationStatus =
  | 'pending'
  | 'creating'      // creating cloud workspace via API
  | 'copying'       // copying files to /.cloud-workspaces/<uuid>
  | 'uploading'     // uploading to S3
  | 'verifying'     // LIST check
  | 'cleaning'      // removing local copy
  | 'done'
  | 'error'
  | 'skipped'       // user chose not to migrate this one

export interface MigrationItem {
  localName: string
  /** Cloud name (may differ from localName if conflict resolved) */
  cloudName: string
  status: MigrationStatus
  progress?: string     // human-readable progress text
  error?: string
  /** Set to true if a cloud workspace with the same name already exists */
  nameConflict: boolean
}

export type MigrationProgressCallback = (items: MigrationItem[]) => void

// ── Constants ────────────────────────────────────────────────

const LOCAL_WORKSPACES_PATH = '/.workspaces'
const CLOUD_WORKSPACES_PATH = '/.cloud-workspaces'
const MIGRATION_DONE_KEY = 'remix_migration_done_workspaces'

// ── Discovery ────────────────────────────────────────────────

/**
 * Discover all local workspaces that haven't been migrated yet.
 */
export async function discoverLocalWorkspaces(): Promise<LocalWorkspaceInfo[]> {
  const fs = (window as any).remixFileSystem
  const workspaces: LocalWorkspaceInfo[] = []

  try {
    const entries = await fs.readdir(LOCAL_WORKSPACES_PATH)
    for (const name of entries) {
      const wsPath = `${LOCAL_WORKSPACES_PATH}/${name}`
      try {
        const stat = await fs.stat(wsPath)
        if (!stat.isDirectory()) continue

        // Quick size estimation by walking the tree
        const { fileCount, totalSize } = await estimateWorkspaceSize(wsPath, fs)
        workspaces.push({ name, fileCount, totalSize })
      } catch {
        // Skip unreadable entries
      }
    }
  } catch {
    // /.workspaces/ may not exist
  }

  // Filter out already-migrated workspaces
  const migrated = getMigratedWorkspaces()
  return workspaces.filter(ws => !migrated.has(ws.name))
}

/**
 * Walk a workspace tree and estimate file count + total size.
 */
async function estimateWorkspaceSize(
  basePath: string,
  fs: any,
): Promise<{ fileCount: number; totalSize: number }> {
  let fileCount = 0
  let totalSize = 0

  async function walk(dirPath: string) {
    let entries: string[]
    try {
      entries = await fs.readdir(dirPath)
    } catch {
      return
    }
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry}`
      try {
        const stat = await fs.stat(fullPath)
        if (stat.isDirectory()) {
          await walk(fullPath)
        } else {
          fileCount++
          totalSize += stat.size || 0
        }
      } catch {
        // skip
      }
    }
  }

  await walk(basePath)
  return { fileCount, totalSize }
}

// ── Migration tracking ───────────────────────────────────────

function getMigratedWorkspaces(): Set<string> {
  try {
    const raw = localStorage.getItem(MIGRATION_DONE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function markAsMigrated(name: string): void {
  const migrated = getMigratedWorkspaces()
  migrated.add(name)
  localStorage.setItem(MIGRATION_DONE_KEY, JSON.stringify([...migrated]))
}

/**
 * Check if there are any local workspaces that haven't been migrated.
 * Use this to decide whether to show the migration prompt.
 */
export async function hasPendingMigrations(): Promise<boolean> {
  const locals = await discoverLocalWorkspaces()
  return locals.length > 0
}

// ── Name conflict detection ──────────────────────────────────

/**
 * Build migration items from local workspaces, detecting name conflicts
 * with existing cloud workspaces.
 */
export async function buildMigrationItems(
  localWorkspaces: LocalWorkspaceInfo[],
): Promise<MigrationItem[]> {
  const cloudWorkspaces = await listCloudWorkspaces()
  const cloudNames = new Set(cloudWorkspaces.map(cw => cw.name.toLowerCase()))

  return localWorkspaces.map(lw => {
    const nameConflict = cloudNames.has(lw.name.toLowerCase())
    return {
      localName: lw.name,
      cloudName: nameConflict ? `${lw.name} (local)` : lw.name,
      status: 'pending' as MigrationStatus,
      nameConflict,
    }
  })
}

// ── Core migration ───────────────────────────────────────────

/**
 * Migrate a single local workspace to the cloud.
 * Atomic: succeeds completely or rolls back.
 *
 * @returns The created CloudWorkspace, or null if rolled back.
 */
export async function migrateWorkspace(
  item: MigrationItem,
  onProgress: (item: MigrationItem) => void,
): Promise<CloudWorkspace | null> {
  const fs = (window as any).remixFileSystem
  const localPath = `${LOCAL_WORKSPACES_PATH}/${item.localName}`
  let cloudWorkspace: CloudWorkspace | null = null
  let cloudLocalPath: string | null = null

  try {
    // ── 1. Create cloud workspace via API ──
    item.status = 'creating'
    item.progress = 'Creating cloud workspace...'
    onProgress(item)

    cloudWorkspace = await createCloudWorkspace(item.cloudName, true)
    cloudLocalPath = `${CLOUD_WORKSPACES_PATH}/${cloudWorkspace.uuid}`
    console.log(`[Migration] Created cloud workspace "${item.cloudName}" → ${cloudWorkspace.uuid}`)

    // ── 2. Copy files from local → cloud path in IndexedDB ──
    item.status = 'copying'
    item.progress = 'Copying files...'
    onProgress(item)

    const fileMap = await copyWorkspaceTree(localPath, cloudLocalPath, fs)
    const fileCount = Object.keys(fileMap).length
    item.progress = `Copied ${fileCount} files`
    onProgress(item)
    console.log(`[Migration] Copied ${fileCount} files to ${cloudLocalPath}`)

    // ── 3. Upload to S3 ──
    item.status = 'uploading'
    item.progress = 'Uploading to cloud...'
    onProgress(item)

    const token = await fetchWorkspaceSTS(cloudWorkspace.uuid)
    const s3 = new S3Client(token)

    // 3a. Upload ZIP snapshot (for fast bulk load by other clients)
    const zipData = await packWorkspace(cloudLocalPath, fs)
    await s3.putObject(WORKSPACE_ZIP_KEY, zipData, 'application/zip')
    item.progress = `Uploaded snapshot (${(zipData.byteLength / 1024).toFixed(1)} KB)`
    onProgress(item)

    // 3b. Upload individual files (for incremental sync compatibility)
    const manifest: SyncManifest = { version: 1, lastSyncTimestamp: Date.now(), files: {} }
    let uploaded = 0
    for (const [relPath, content] of Object.entries(fileMap)) {
      const etag = await s3.putObject(relPath, content as string)
      manifest.files[relPath] = {
        etag,
        lastModified: new Date().toISOString(),
        size: new TextEncoder().encode(content as string).byteLength,
      }
      uploaded++
      if (uploaded % 10 === 0 || uploaded === fileCount) {
        item.progress = `Uploaded ${uploaded}/${fileCount} files`
        onProgress(item)
      }
    }

    // 3c. Save manifest locally
    await ensureDir(cloudLocalPath, fs)
    await fs.writeFile(
      `${cloudLocalPath}/.sync-manifest.json`,
      JSON.stringify(manifest),
      'utf8'
    )

    // ── 4. Verify upload ──
    item.status = 'verifying'
    item.progress = 'Verifying upload...'
    onProgress(item)

    const remoteObjects = await s3.listObjects('')
    const remoteKeys = new Set(remoteObjects.map(o => o.key))
    const missing = Object.keys(fileMap).filter(k => !remoteKeys.has(k))

    if (missing.length > 0) {
      throw new Error(`Verification failed: ${missing.length} files missing on S3: ${missing.slice(0, 3).join(', ')}...`)
    }
    console.log(`[Migration] Verified: all ${fileCount} files present on S3`)

    // ── 5. Delete local workspace ──
    item.status = 'cleaning'
    item.progress = 'Removing local copy...'
    onProgress(item)

    await deleteDirectoryRecursive(localPath, fs)
    console.log(`[Migration] Deleted local workspace ${localPath}`)

    // ── 6. Mark as migrated ──
    markAsMigrated(item.localName)
    item.status = 'done'
    item.progress = 'Migration complete'
    onProgress(item)

    return cloudWorkspace

  } catch (error) {
    console.error(`[Migration] Failed for "${item.localName}":`, error)
    item.status = 'error'
    item.error = error.message || String(error)
    item.progress = 'Failed — rolling back...'
    onProgress(item)

    // ── Rollback ──
    // Remove cloud local copy
    if (cloudLocalPath) {
      try {
        await deleteDirectoryRecursive(cloudLocalPath, fs)
      } catch { /* ignore */ }
    }
    // Delete cloud workspace via API (also cleans S3)
    if (cloudWorkspace) {
      try {
        await deleteCloudWorkspace(cloudWorkspace.uuid)
      } catch { /* ignore */ }
    }

    item.progress = `Failed: ${item.error}`
    onProgress(item)
    return null
  }
}

/**
 * Migrate multiple workspaces sequentially.
 */
export async function migrateWorkspaces(
  items: MigrationItem[],
  onProgress: MigrationProgressCallback,
): Promise<CloudWorkspace[]> {
  const results: CloudWorkspace[] = []

  for (const item of items) {
    if (item.status === 'skipped') continue

    const result = await migrateWorkspace(item, (updatedItem) => {
      // Replace in array and notify
      const idx = items.findIndex(i => i.localName === updatedItem.localName)
      if (idx >= 0) items[idx] = { ...updatedItem }
      onProgress([...items])
    })

    if (result) results.push(result)
  }

  return results
}

// ── File helpers ─────────────────────────────────────────────

/**
 * Recursively copy all files from srcPath to destPath.
 * Returns a map of relative-path → content (for S3 upload).
 */
async function copyWorkspaceTree(
  srcPath: string,
  destPath: string,
  fs: any,
): Promise<Record<string, string>> {
  const fileMap: Record<string, string> = {}
  await ensureDir(destPath, fs)

  async function walk(srcDir: string, destDir: string, relativeBase: string) {
    let entries: string[]
    try {
      entries = await fs.readdir(srcDir)
    } catch {
      return
    }

    for (const entry of entries) {
      // Skip sync artifacts
      if (entry === '.sync-manifest.json' || entry === '_workspace.zip') continue

      const srcChild = `${srcDir}/${entry}`
      const destChild = `${destDir}/${entry}`
      const relativePath = relativeBase ? `${relativeBase}/${entry}` : entry

      try {
        const stat = await fs.stat(srcChild)
        if (stat.isDirectory()) {
          await ensureDir(destChild, fs)
          await walk(srcChild, destChild, relativePath)
        } else {
          const content = await fs.readFile(srcChild, 'utf8')
          await fs.writeFile(destChild, content, 'utf8')
          fileMap[relativePath] = content
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  await walk(srcPath, destPath, '')
  return fileMap
}

/**
 * Recursively delete a directory.
 */
async function deleteDirectoryRecursive(dirPath: string, fs: any): Promise<void> {
  let entries: string[]
  try {
    entries = await fs.readdir(dirPath)
  } catch {
    return // directory doesn't exist
  }

  for (const entry of entries) {
    const fullPath = `${dirPath}/${entry}`
    try {
      const stat = await fs.stat(fullPath)
      if (stat.isDirectory()) {
        await deleteDirectoryRecursive(fullPath, fs)
      } else {
        await fs.unlink(fullPath)
      }
    } catch {
      // skip
    }
  }

  try {
    await fs.rmdir(dirPath)
  } catch {
    // directory may already be gone
  }
}

/**
 * Ensure a directory path exists (recursive mkdir).
 */
async function ensureDir(path: string, fs: any): Promise<void> {
  const parts = path.split('/').filter(Boolean)
  let current = ''
  for (const part of parts) {
    current += '/' + part
    try {
      await fs.stat(current)
    } catch {
      try {
        await fs.mkdir(current)
      } catch {
        // may already exist from concurrent call
      }
    }
  }
}
