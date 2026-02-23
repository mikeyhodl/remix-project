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

import { cloudSyncEngine } from './cloud-sync-engine'
import {
  createCloudWorkspace as apiCreate,
  updateCloudWorkspace as apiUpdate,
  deleteCloudWorkspace as apiDelete,
  listCloudWorkspaces as apiList,
} from './cloud-workspace-api'
import { CloudWorkspace, WorkspaceSyncStatus } from './types'
// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import CloudWorkspaceFileProvider from '../../../../../../apps/remix-ide/src/app/files/cloudWorkspaceFileProvider'

// ── Plugin References ────────────────────────────────────────

let _plugin: any = null
let _dispatch: React.Dispatch<any> = null
let _originalProvider: any = null // the original WorkspaceFileProvider

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

  return cloudProvider
}

/**
 * Exit cloud mode: restore the original WorkspaceFileProvider.
 */
export function exitCloudProvider(): void {
  if (!_plugin || !_originalProvider) return

  _plugin.fileProviders.workspace = _originalProvider
  _originalProvider = null
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

  // Activate sync engine and pull from S3
  await cloudSyncEngine.activate(uuid, onSyncStatus)
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
 * Refresh the cloud workspace list from the API and update provider mappings.
 */
export async function refreshCloudWorkspaces(): Promise<CloudWorkspace[]> {
  const workspaces = await apiList()
  const provider = _plugin?.fileProviders?.workspace
  if (provider?.setWorkspaceMappings) {
    provider.setWorkspaceMappings(workspaces)
  }
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

  addListener('fileAdded', (path: string) => {
    const relativePath = stripWorkspacePrefix(path, workspaceUuid, workspaceProvider.workspacesPath)
    if (relativePath && !relativePath.startsWith('.git/')) {
      cloudSyncEngine.trackChange({ path: relativePath, type: 'add', timestamp: Date.now() })
    }
  })

  addListener('fileChanged', (path: string) => {
    const relativePath = stripWorkspacePrefix(path, workspaceUuid, workspaceProvider.workspacesPath)
    if (relativePath && !relativePath.startsWith('.git/')) {
      cloudSyncEngine.trackChange({ path: relativePath, type: 'change', timestamp: Date.now() })
    }
  })

  addListener('fileRemoved', (path: string) => {
    const relativePath = stripWorkspacePrefix(path, workspaceUuid, workspaceProvider.workspacesPath)
    if (relativePath && !relativePath.startsWith('.git/')) {
      cloudSyncEngine.trackChange({ path: relativePath, type: 'delete', timestamp: Date.now() })
    }
  })

  addListener('fileRenamed', (oldPath: string, newPath: string) => {
    const relativeOld = stripWorkspacePrefix(oldPath, workspaceUuid, workspaceProvider.workspacesPath)
    const relativeNew = stripWorkspacePrefix(newPath, workspaceUuid, workspaceProvider.workspacesPath)
    if (relativeNew && !relativeNew.startsWith('.git/')) {
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
