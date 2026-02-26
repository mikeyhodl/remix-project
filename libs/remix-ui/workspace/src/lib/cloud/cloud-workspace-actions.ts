/**
 * Cloud Workspace Actions
 *
 * Orchestrates cloud workspace operations using the CloudWorkspaceFileProvider.
 *
 * The provider handles the name↔UUID translation internally.
 * These actions handle:
 *   - Provider swap (enter/exit cloud mode)
 *   - Cloud API calls (rename, delete, refresh)
 *   - Sync engine activation
 *   - File change tracking
 */

import { cloudSyncEngine, CloudSyncEngine } from './cloud-sync-engine'
import { cloudStore } from './cloud-store'
import {
  createCloudWorkspace as apiCreate,
  updateCloudWorkspace as apiUpdate,
  deleteCloudWorkspace as apiDelete,
  listCloudWorkspaces as apiList,
  fetchSTSToken,
} from './cloud-workspace-api'
import { CloudWorkspace, WorkspaceSyncStatus } from './types'
import {
  setCurrentWorkspace,
  setMode,
  setReadOnlyMode,
} from '../actions/payload'
import { createWorkspace } from '../actions/workspace'
import {
  enableCloudFSObserver,
  disableCloudFSObserver,
  onCloudFSWrite,
  clearCloudFSListeners,
  extractCloudWorkspaceUuid,
  extractRelativePath,
  FSWriteOperation,
} from './cloud-fs-observer'
// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import CloudWorkspaceFileProvider from '../../../../../../apps/remix-ide/src/app/files/cloudWorkspaceFileProvider'

// ── Plugin References ────────────────────────────────────────

let _plugin: any = null
let _dispatch: React.Dispatch<any> = null
let _originalProvider: any = null // the original WorkspaceFileProvider
let _fsObserverUnsub: (() => void) | null = null  // FS observer subscription
let _fileOpenListenerActive = false  // whether we're listening to currentFileChanged

/** Debounce timer for file explorer refresh triggered by raw FS writes */
let _refreshTimer: ReturnType<typeof setTimeout> | null = null
const REFRESH_DEBOUNCE_MS = 600

/**
 * Debounce timer for proactive version check on first user write.
 * When the user starts typing after being away, we check the remote
 * version once (debounced) to catch conflicts early — before the
 * next flush cycle tries to push and gets a 409.
 */
let _versionCheckTimer: ReturnType<typeof setTimeout> | null = null
const VERSION_CHECK_DEBOUNCE_MS = 2_000  // 2s after first write activity

export function setCloudPlugin(plugin: any, dispatch: React.Dispatch<any>) {
  _plugin = plugin
  _dispatch = dispatch
}

// ── Provider Swap ────────────────────────────────────────────

/**
 * Enter cloud mode: create a CloudWorkspaceFileProvider, populate its
 * name↔UUID mappings, and swap it in as the active workspace provider.
 *
 * @returns The CloudWorkspaceFileProvider instance
 */
export function enterCloudProvider(workspaces: CloudWorkspace[]): CloudWorkspaceFileProvider {
  if (!_plugin) throw new Error('Cloud plugin not initialized')

  // Save original provider for restore on logout
  _originalProvider = _plugin.fileProviders.workspace

  // Create cloud provider
  const cloudProvider = new CloudWorkspaceFileProvider()

  // Share the event manager so fileManager event subscriptions keep working
  ;(cloudProvider as any).event = _originalProvider.event

  // Populate name↔UUID mappings
  cloudProvider.setWorkspaceMappings(workspaces)

  // Inject the API create function so createWorkspace can auto-register
  cloudProvider.setApiCreate(apiCreate)

  // Swap the provider on the fileProviders object.
  // fileManager.fileProviderOf() returns filesProviders.workspace dynamically,
  // so it will immediately pick up the new provider.
  _plugin.fileProviders.workspace = cloudProvider

  // ── Enable FS observer for raw write detection ──────────
  // This patches LightningFS to intercept write operations that bypass the
  // provider (e.g. isomorphic-git writes, or any tool using remixFileSystem
  // directly).  When such a write targets a cloud workspace path, we:
  //   1. Debounce a file explorer refresh (provider emits 'refresh')
  //   2. Feed the change into the sync engine for S3 push
  enableCloudFSObserver()
  _fsObserverUnsub = onCloudFSWrite((op: FSWriteOperation) => {
    handleRawFSWrite(op, cloudProvider)
  })

  // ── Listen to file open events for proactive version checks ──
  // When the user opens a file (e.g. coming back to device A), immediately
  // check if the remote version advanced while we were away.
  if (!_fileOpenListenerActive) {
    _plugin.on('fileManager', 'currentFileChanged', _onCurrentFileChanged)
    _fileOpenListenerActive = true
  }

  return cloudProvider
}

/**
 * Exit cloud mode: restore the original WorkspaceFileProvider.
 */
export function exitCloudProvider(): void {
  if (!_plugin || !_originalProvider) return

  // Disable FS observer and clean up subscription
  if (_fsObserverUnsub) {
    _fsObserverUnsub()
    _fsObserverUnsub = null
  }
  clearCloudFSListeners()
  disableCloudFSObserver()
  if (_refreshTimer) {
    clearTimeout(_refreshTimer)
    _refreshTimer = null
  }
  if (_versionCheckTimer) {
    clearTimeout(_versionCheckTimer)
    _versionCheckTimer = null
  }

  // Remove fileManager listener
  if (_fileOpenListenerActive && _plugin) {
    try {
      _plugin.off('fileManager', 'currentFileChanged')
    } catch { /* plugin may already be gone */ }
    _fileOpenListenerActive = false
  }

  _plugin.fileProviders.workspace = _originalProvider
  _originalProvider = null
}

// ── Cloud Toggle ─────────────────────────────────────────────

/**
 * Enable cloud mode for an already-authenticated user.
 *
 * Fetches workspaces + STS token, swaps the provider, enters cloud mode,
 * and switches to the last-active (or first) cloud workspace.
 */
export async function enableCloud(): Promise<void> {
  if (!_plugin) throw new Error('Cloud plugin not initialized')
  if (cloudStore.isCloudMode) return  // already on

  // Remember the current local workspace so we can restore it on disable
  const currentLocal = localStorage.getItem('currentWorkspace')
  if (currentLocal) localStorage.setItem('lastLocalWorkspace', currentLocal)

  cloudStore.setLoading(true)
  try {
    const [workspaces, stsToken] = await Promise.all([
      apiList(),
      fetchSTSToken(),
    ])

    enterCloudProvider(workspaces)
    cloudStore.enterCloudMode(workspaces, stsToken)

    if (workspaces.length > 0) {
      const lastCloudName = localStorage.getItem('lastCloudWorkspace')
      const targetWs = workspaces.find(w => w.name === lastCloudName) || workspaces[0]
      try {
        await switchToCloudWorkspace(targetWs, (status) => {
          cloudStore.updateSyncStatus(targetWs.uuid, status)
        })
        cloudStore.setActiveCloudWorkspace(targetWs.uuid)
        const workspaceProvider = _plugin.fileProviders?.workspace
        if (workspaceProvider) {
          startFileChangeTracking(workspaceProvider, targetWs.uuid)
        }
        // Dispatch Redux state so the workspace panel UI updates
        _dispatch(setMode('browser'))
        _dispatch(setCurrentWorkspace({ name: targetWs.name, isGitRepo: false }))
        _dispatch(setReadOnlyMode(false))
        localStorage.setItem('lastCloudWorkspace', targetWs.name)
      } catch (err) {
        console.error('[enableCloud] Failed to switch to cloud workspace:', err)
      }
    } else {
      // No cloud workspaces yet — create a default one so the user isn't stuck
      // in an empty state.  This parallels the legacy behavior where Remix
      // always ensures at least one workspace exists.
      console.log('[enableCloud] No cloud workspaces — creating default')
      try {
        const newWs = await apiCreate('default_workspace')
        cloudStore.addCloudWorkspace(newWs)
        const provider = _plugin.fileProviders.workspace
        if (provider.setWorkspaceMappings) {
          provider.setWorkspaceMappings([newWs])
        }
        await switchToCloudWorkspace(newWs, (status) => {
          cloudStore.updateSyncStatus(newWs.uuid, status)
        })
        cloudStore.setActiveCloudWorkspace(newWs.uuid)
        const workspaceProvider = _plugin.fileProviders?.workspace
        if (workspaceProvider) {
          startFileChangeTracking(workspaceProvider, newWs.uuid)
        }
        _dispatch(setMode('browser'))
        _dispatch(setCurrentWorkspace({ name: newWs.name, isGitRepo: false }))
        _dispatch(setReadOnlyMode(false))
        localStorage.setItem('lastCloudWorkspace', newWs.name)
      } catch (err) {
        console.error('[enableCloud] Failed to create default cloud workspace:', err)
      }
    }
  } catch (err) {
    console.error('[enableCloud] Failed to enable cloud:', err)
    cloudStore.setError(err.message)
    cloudStore.setLoading(false)
    throw err
  }
}

/**
 * Disable cloud mode without logging out.
 *
 * Deactivates sync, restores the original provider, updates the store,
 * and switches back to a legacy workspace.
 */
export async function disableCloud(): Promise<void> {
  if (!_plugin) throw new Error('Cloud plugin not initialized')
  if (!cloudStore.isCloudMode) return  // already off

  // Remember the current cloud workspace for when the user re-enables
  const activeId = cloudStore.getState().activeWorkspaceId
  const activeWs = cloudStore.getState().cloudWorkspaces.find(w => w.uuid === activeId)
  if (activeWs) localStorage.setItem('lastCloudWorkspace', activeWs.name)

  // 1. Deactivate sync engine
  cloudSyncEngine.deactivate()

  // 2. Restore original file provider
  exitCloudProvider()

  // 3. Update store — keeps isAuthenticated = true
  cloudStore.disableCloud()

  // 4. Close all open files and switch to the last used legacy workspace
  try {
    await _plugin.fileManager.closeAllFiles()
    const lastLocal = localStorage.getItem('lastLocalWorkspace') || localStorage.getItem('currentWorkspace')

    // Check if the legacy workspace actually exists
    let targetLocal = lastLocal
    if (targetLocal) {
      try {
        const wsPath = `/.workspaces/${targetLocal}`
        await (window as any).remixFileSystem.stat(wsPath)
      } catch {
        targetLocal = null  // workspace doesn't exist anymore
      }
    }

    // If no valid legacy workspace, check if any exist at all
    if (!targetLocal) {
      try {
        const entries = await (window as any).remixFileSystem.readdir('/.workspaces')
        const dirs = []
        for (const e of entries) {
          try {
            const s = await (window as any).remixFileSystem.stat(`/.workspaces/${e}`)
            if (s.isDirectory()) dirs.push(e)
          } catch { /* skip */ }
        }
        if (dirs.length > 0) {
          targetLocal = dirs[0]
        }
      } catch { /* /.workspaces may not exist */ }
    }

    if (targetLocal) {
      await _plugin.fileProviders.workspace.setWorkspace(targetLocal)
      await _plugin.setWorkspace({ name: targetLocal, isLocalhost: false })
      _dispatch(setMode('browser'))
      _dispatch(setCurrentWorkspace({ name: targetLocal, isGitRepo: false }))
      _dispatch(setReadOnlyMode(false))
    } else {
      // No local workspaces at all — create a default one
      // This mirrors the standard Remix behavior (switchToWorkspace(NO_WORKSPACE))
      console.log('[disableCloud] No local workspaces — creating default')
      _plugin.call('notification', 'toast', 'No local workspace found — creating default workspace…')
      await createWorkspace('default_workspace', 'remixDefault')
    }
  } catch (err) {
    console.warn('[disableCloud] Failed to switch to legacy workspace:', err)
  }
}

/**
 * Get the current workspace provider (may be cloud or legacy).
 */
export function getWorkspaceProvider(): any {
  return _plugin?.fileProviders?.workspace
}

/**
 * Check if the current workspace provider is a CloudWorkspaceFileProvider.
 */
export function isCloudProvider(): boolean {
  return _plugin?.fileProviders?.workspace instanceof CloudWorkspaceFileProvider
}

// ── Cloud Workspace Operations ───────────────────────────────

/**
 * Switch to a cloud workspace by display name.
 *
 * 1. Sets workspace in the provider (name → UUID internally)
 * 2. Ensures the local directory exists
 * 3. Activates sync engine → pulls files from S3
 */
export async function switchToCloudWorkspace(
  cloudWorkspace: CloudWorkspace,
  onSyncStatus?: (status: WorkspaceSyncStatus) => void,
): Promise<void> {
  if (!_plugin) throw new Error('Cloud plugin not initialized')

  const provider = _plugin.fileProviders.workspace

  await _plugin.fileManager.closeAllFiles()

  // Set workspace — provider translates display name → UUID
  provider.setWorkspace(cloudWorkspace.name)

  // Ensure local cloud workspace directory exists
  const uuid = provider.resolveDisplayName?.(cloudWorkspace.name) || cloudWorkspace.uuid
  const wsPath = `/${provider.workspacesPath}/${uuid}`
  const fs = (window as any).remixFileSystem
  try {
    await fs.stat(wsPath)
  } catch {
    await provider.createWorkspace(cloudWorkspace.name)
  }

  // Broadcast display name to other plugins
  await _plugin.setWorkspace({ name: cloudWorkspace.name, isLocalhost: false })

  // Signal loading state before pull
  onSyncStatus?.({ status: 'loading', lastSync: null, pendingChanges: 0 })

  // Activate sync engine and pull from S3
  await cloudSyncEngine.activate(uuid, onSyncStatus, async () => {
    // Called when a version conflict is detected — close all editor tabs
    // so Remix autosave stops writing stale content, and notify the user.
    console.log('[CloudSync:version] onConflictDetected: closing all editors')
    try {
      await _plugin.fileManager.closeAllFiles()
    } catch (err) {
      console.warn('[CloudSync:version] Failed to close editors:', err)
    }
    _plugin.call('notification', 'toast', 'Workspace updated on another device — pulling latest changes…')
  })
  await cloudSyncEngine.pullWorkspace()
}

/**
 * Rename a cloud workspace.
 * Only the API name is changed + the provider's mapping is updated.
 * No local FS rename needed (directory stays as UUID).
 */
export async function renameCloudWorkspaceAction(
  cloudWorkspace: CloudWorkspace,
  newName: string,
): Promise<CloudWorkspace> {
  if (!_plugin) throw new Error('Cloud plugin not initialized')

  const updated = await apiUpdate(cloudWorkspace.uuid, { name: newName })

  // Update the provider's name↔UUID mapping
  const provider = _plugin.fileProviders.workspace
  if (provider.renameWorkspaceMapping) {
    provider.renameWorkspaceMapping(cloudWorkspace.name, newName)
  }

  return updated
}

/**
 * Delete a cloud workspace.
 *
 * 1. Deactivates sync if active
 * 2. Deletes on the API
 * 3. Removes the local directory
 * 4. Removes from provider mapping
 */
export async function deleteCloudWorkspaceAction(cloudWorkspace: CloudWorkspace): Promise<void> {
  if (!_plugin) throw new Error('Cloud plugin not initialized')

  // Stop sync if this workspace is active
  if (cloudSyncEngine.isActive) {
    cloudSyncEngine.deactivate()
  }

  // Delete on API
  await apiDelete(cloudWorkspace.uuid)

  // Remove local directory
  await _plugin.fileManager.closeAllFiles()
  const provider = _plugin.fileProviders.workspace
  const localPath = provider.workspacesPath + '/' + cloudWorkspace.uuid
  try {
    await _plugin.fileProviders.browser.remove(localPath)
  } catch {
    // Directory may not exist locally — that's fine
  }

  // Remove from provider mapping
  if (provider.removeWorkspaceMapping) {
    provider.removeWorkspaceMapping(cloudWorkspace.name)
  }
}

/**
 * Refresh the cloud workspace list from the API, update provider mappings,
 * and update the reactive cloud store so the UI re-renders.
 */
export async function refreshCloudWorkspaces(): Promise<CloudWorkspace[]> {
  const workspaces = await apiList()
  const provider = _plugin?.fileProviders?.workspace
  if (provider?.setWorkspaceMappings) {
    provider.setWorkspaceMappings(workspaces)
  }
  // Update the reactive store so dropdown / UI picks up new workspaces
  cloudStore.setCloudWorkspaces(workspaces)
  return workspaces
}

// ── File Change Tracking ─────────────────────────────────────

/** Stores the cleanup function from the previous startFileChangeTracking call */
let _cleanupTracking: (() => void) | null = null

/**
 * Hook into workspace file provider events to track changes for sync.
 * Automatically cleans up listeners from any previous call.
 *
 * @param workspaceProvider  The workspace file provider
 * @param workspaceUuid      The UUID of the current cloud workspace
 * @returns Cleanup function to remove all listeners
 */
export function startFileChangeTracking(workspaceProvider: any, workspaceUuid: string): () => void {
  // Clean up previous listeners first
  if (_cleanupTracking) {
    _cleanupTracking()
    _cleanupTracking = null
  }

  const listeners: Array<{ event: string; handler: (...args: any[]) => void }> = []

  const addListener = (event: string, handler: (...args: any[]) => void) => {
    workspaceProvider.event.on(event, handler)
    listeners.push({ event, handler })
  }

  const shouldTrack = (relativePath: string) =>
    relativePath &&
    !relativePath.startsWith('.git/') &&
    !relativePath.endsWith(CloudSyncEngine.MANIFEST_FILENAME)

  addListener('fileAdded', (path: string) => {
    const relativePath = stripWorkspacePrefix(path, workspaceUuid, workspaceProvider.workspacesPath)
    if (shouldTrack(relativePath)) {
      cloudSyncEngine.trackChange({ path: relativePath, type: 'add', timestamp: Date.now() })
    }
  })

  addListener('fileChanged', (path: string) => {
    const relativePath = stripWorkspacePrefix(path, workspaceUuid, workspaceProvider.workspacesPath)
    if (shouldTrack(relativePath)) {
      cloudSyncEngine.trackChange({ path: relativePath, type: 'change', timestamp: Date.now() })
    }
  })

  addListener('fileRemoved', (path: string) => {
    const relativePath = stripWorkspacePrefix(path, workspaceUuid, workspaceProvider.workspacesPath)
    if (shouldTrack(relativePath)) {
      cloudSyncEngine.trackChange({ path: relativePath, type: 'delete', timestamp: Date.now() })
    }
  })

  addListener('fileRenamed', (oldPath: string, newPath: string) => {
    const relativeOld = stripWorkspacePrefix(oldPath, workspaceUuid, workspaceProvider.workspacesPath)
    const relativeNew = stripWorkspacePrefix(newPath, workspaceUuid, workspaceProvider.workspacesPath)
    if (shouldTrack(relativeNew)) {
      cloudSyncEngine.trackChange({ path: relativeNew, type: 'rename', oldPath: relativeOld, timestamp: Date.now() })
    }
  })

  const cleanup = () => {
    for (const { event, handler } of listeners) {
      try {
        workspaceProvider.event.off(event, handler)
      } catch { /* ignore */ }
    }
    _cleanupTracking = null
  }

  _cleanupTracking = cleanup
  return cleanup
}

/**
 * Proactive version check when the user opens/switches a file.
 * Catches the "come back to device A" scenario immediately on file open,
 * rather than waiting for the next write or 10s flush cycle.
 */
function _onCurrentFileChanged(_file: string): void {
  if (!cloudSyncEngine.isActive) return
  console.log(`[CloudSync:version] File opened — triggering proactive version check`)
  cloudSyncEngine.checkRemoteVersion().catch(() => {})
}

/**
 * Handle a raw FS write detected by the CloudFSObserver.
 *
 * This fires for ALL writes to cloud workspace paths — including ones
 * from the provider itself.  That's fine because:
 *   - Sync engine's trackChange de-duplicates by path
 *
 * File explorer refresh is only emitted during a pull (isPulling=true),
 * because that's when new/changed files arrive from S3 and the tree
 * needs updating.  Local edits already reflect in the UI — refreshing
 * on every push-bound write would cause an unnecessary tree flicker.
 */
function handleRawFSWrite(op: FSWriteOperation, provider: any): void {
  const uuid = extractCloudWorkspaceUuid(op.path)
  if (!uuid) return

  // Only act on the currently active workspace
  if (!cloudSyncEngine.isActive) return

  const relativePath = extractRelativePath(op.path)
  if (!relativePath) return

  // Skip .git internals, sync manifest, and snapshot ZIP
  if (relativePath.startsWith('.git/') || relativePath === '.git') return
  if (relativePath === CloudSyncEngine.MANIFEST_FILENAME) return
  if (relativePath === '_workspace.zip') return

  // 1) Feed into sync engine for S3 push — but NOT for mkdir/rmdir,
  //    and NOT while the engine is pulling (writes from S3→local should
  //    not be re-pushed back to S3).
  if (op.type !== 'mkdir' && op.type !== 'rmdir' && !cloudSyncEngine.isPulling) {
    const changeType = op.type === 'writeFile' ? 'change'
      : op.type === 'unlink' ? 'delete'
      : op.type === 'rename' ? 'rename'
      : 'change'

    // For renames:  op.path = old path,  op.newPath = new path
    // The tracked change should have path = new (what to upload) and oldPath = old (what to delete).
    const changePath = (op.type === 'rename' && op.newPath)
      ? extractRelativePath(op.newPath)!
      : relativePath
    const changeOldPath = op.type === 'rename' ? relativePath : undefined

    if (!changePath) return  // safety — newPath outside cloud workspace

    cloudSyncEngine.trackChange({
      path: changePath,
      type: changeType as any,
      oldPath: changeOldPath,
      timestamp: Date.now(),
    })

    // Proactive version check: on the first write activity, debounce a
    // remote version check so we catch conflicts before the next flush.
    // This way when the user comes back to device A and starts editing,
    // we detect that device B pushed in the meantime within ~2s instead
    // of waiting for the full 10s flush cycle to hit a 409.
    if (!_versionCheckTimer) {
      _versionCheckTimer = setTimeout(() => {
        _versionCheckTimer = null
        console.log('[CloudSync:version] Write-triggered proactive version check')
        cloudSyncEngine.checkRemoteVersion().catch(() => {})
      }, VERSION_CHECK_DEBOUNCE_MS)
    }
  }

  // 2) Debounce file explorer refresh — but ONLY during a pull.
  //    When the user edits locally the tree already reflects the change;
  //    refreshing on every push-bound write causes an unnecessary flicker.
  if (cloudSyncEngine.isPulling) {
    if (_refreshTimer) clearTimeout(_refreshTimer)
    _refreshTimer = setTimeout(() => {
      _refreshTimer = null
      try {
        // The 'refresh' event on the provider triggers fetchWorkspaceDirectory('/')
        // in events.ts, which reloads the entire file tree.
        provider?.event?.emit?.('refresh')
      } catch (e) {
        console.warn('[CloudFSObserver] Failed to emit refresh:', e)
      }
    }, REFRESH_DEBOUNCE_MS)
  }
}

/**
 * Strip workspace prefix from a path.
 *
 * Paths from the workspace provider may come as:
 *   - "contracts/Token.sol"  (already relative)
 *   - ".cloud-workspaces/<uuid>/contracts/Token.sol"
 *   - ".workspaces/<name>/contracts/Token.sol"  (legacy)
 */
function stripWorkspacePrefix(path: string, workspaceId: string, workspacesPath: string): string {
  let p = path.startsWith('/') ? path.slice(1) : path
  const prefix = `${workspacesPath}/${workspaceId}/`
  if (p.startsWith(prefix)) {
    p = p.slice(prefix.length)
  }
  return p
}
