/**
 * Cloud Workspace Actions
 *
 * These functions handle workspace operations in cloud mode.
 * They mirror the existing workspace actions but add cloud synchronization:
 *
 *  - getCloudWorkspacesForUI()  → returns workspaces list from cloud API
 *  - createCloudWorkspaceAction() → creates on API + local FS + starts sync
 *  - switchToCloudWorkspace()    → pulls from S3, switches local provider
 *  - renameCloudWorkspaceAction() → renames on API + local
 *  - deleteCloudWorkspaceAction() → deletes on API + local
 *
 * Each workspace in cloud mode gets a `remix.config.json` file
 * that stores the cloud UUID mapping:
 *   { "remote-workspace": { "remoteId": "<uuid>" } }
 *
 * This config file is how the existing `getWorkspaces()` function
 * already reads `remoteId` from workspaces.
 */

import { cloudSyncEngine } from './cloud-sync-engine'
import {
  createCloudWorkspace as apiCreate,
  updateCloudWorkspace as apiUpdate,
  deleteCloudWorkspace as apiDelete,
  listCloudWorkspaces as apiList,
  fetchWorkspaceSTS,
} from './cloud-workspace-api'
import { CloudWorkspace, FileChangeRecord, WorkspaceSyncStatus } from './types'

/** Reference to the plugin and dispatch — set by integration code */
let _plugin: any = null
let _dispatch: React.Dispatch<any> = null

export function setCloudPlugin(plugin: any, dispatch: React.Dispatch<any>) {
  _plugin = plugin
  _dispatch = dispatch
}

// ── Config File ──────────────────────────────────────────────

const CONFIG_FILENAME = 'remix.config.json'

/**
 * Write the cloud mapping config into a workspace.
 */
async function writeCloudConfig(workspaceName: string, cloudId: string): Promise<void> {
  const workspacesPath = _plugin.fileProviders.workspace.workspacesPath
  const configPath = `/${workspacesPath}/${workspaceName}/${CONFIG_FILENAME}`
  let config: any = {}
  try {
    const exists = await _plugin.fileProviders.browser.exists(configPath)
    if (exists) {
      const content = await _plugin.fileProviders.browser.get(configPath)
      config = JSON.parse(content)
    }
  } catch { /* ignore */ }

  config['remote-workspace'] = { remoteId: cloudId }
  await _plugin.fileProviders.browser.set(configPath, JSON.stringify(config, null, 2))
}

/**
 * Read the cloud UUID from a workspace's config.
 */
async function readCloudConfig(workspaceName: string): Promise<string | null> {
  const workspacesPath = _plugin.fileProviders.workspace.workspacesPath
  const configPath = `/${workspacesPath}/${workspaceName}/${CONFIG_FILENAME}`
  try {
    const exists = await _plugin.fileProviders.browser.exists(configPath)
    if (!exists) return null
    const content = await _plugin.fileProviders.browser.get(configPath)
    const config = JSON.parse(content)
    return config?.['remote-workspace']?.remoteId || null
  } catch {
    return null
  }
}

// ── Workspace Name / UUID Mapping ────────────────────────────

/**
 * In cloud mode, the local workspace name IS the cloud workspace name.
 * The UUID is stored in remix.config.json.
 * However, locally we might have name clashes. We handle that by
 * using the cloud name directly — since the user is in cloud mode,
 * legacy workspaces are hidden.
 */

/**
 * Get the local workspace name for a cloud workspace.
 * Returns the cloud name directly (since in cloud mode legacy is hidden).
 */
function localNameForCloud(cloudWorkspace: CloudWorkspace): string {
  return cloudWorkspace.name
}

// ── Cloud Workspace Operations ───────────────────────────────

/**
 * Create a new cloud workspace.
 * 1. Creates the workspace on the API (gets UUID)
 * 2. Creates the local workspace directory
 * 3. Writes the cloud config
 * 4. Returns the cloud workspace metadata
 */
export async function createCloudWorkspaceAction(
  name: string,
  templateName?: string,
  opts?: any,
): Promise<CloudWorkspace> {
  if (!_plugin) throw new Error('Cloud plugin not initialized')

  // 1. Create on API
  const cloudWs = await apiCreate(name)

  // 2. Create local workspace directory
  const workspaceProvider = _plugin.fileProviders.workspace
  await workspaceProvider.createWorkspace(name)

  // 3. Write cloud config
  await writeCloudConfig(name, cloudWs.uuid)

  return cloudWs
}

/**
 * Switch to a cloud workspace.
 * 1. Closes all files
 * 2. Sets the local workspace provider
 * 3. Activates sync engine for this workspace
 * 4. Pulls files from S3
 * 5. Dispatches UI state updates
 */
export async function switchToCloudWorkspace(
  cloudWorkspace: CloudWorkspace,
  onSyncStatus?: (status: WorkspaceSyncStatus) => void,
): Promise<void> {
  if (!_plugin) throw new Error('Cloud plugin not initialized')

  await _plugin.fileManager.closeAllFiles()

  const localName = localNameForCloud(cloudWorkspace)
  const workspaceProvider = _plugin.fileProviders.workspace

  // Ensure local workspace directory exists
  const workspacesPath = workspaceProvider.workspacesPath
  const wsPath = `/${workspacesPath}/${localName}`
  const exists = await _plugin.fileProviders.browser.exists(wsPath)
  if (!exists) {
    await workspaceProvider.createWorkspace(localName)
    await writeCloudConfig(localName, cloudWorkspace.uuid)
  }

  // Set workspace in provider
  await workspaceProvider.setWorkspace(localName)
  await _plugin.setWorkspace({ name: localName, isLocalhost: false })

  // Activate sync engine and pull
  await cloudSyncEngine.activate(cloudWorkspace.uuid, localName, onSyncStatus)
  await cloudSyncEngine.pullWorkspace()
}

/**
 * Rename a cloud workspace.
 */
export async function renameCloudWorkspaceAction(
  cloudWorkspace: CloudWorkspace,
  newName: string,
): Promise<CloudWorkspace> {
  if (!_plugin) throw new Error('Cloud plugin not initialized')

  // Update on API
  const updated = await apiUpdate(cloudWorkspace.uuid, { name: newName })

  // Rename locally
  const oldLocalName = localNameForCloud(cloudWorkspace)
  const browserProvider = _plugin.fileProviders.browser
  const workspaceProvider = _plugin.fileProviders.workspace
  const workspacesPath = workspaceProvider.workspacesPath
  await browserProvider.rename(
    'browser/' + workspacesPath + '/' + oldLocalName,
    'browser/' + workspacesPath + '/' + newName,
    true
  )
  await workspaceProvider.setWorkspace(newName)

  return updated
}

/**
 * Delete a cloud workspace.
 */
export async function deleteCloudWorkspaceAction(cloudWorkspace: CloudWorkspace): Promise<void> {
  if (!_plugin) throw new Error('Cloud plugin not initialized')

  // If this workspace is currently active, deactivate sync
  if (cloudSyncEngine.isActive) {
    cloudSyncEngine.deactivate()
  }

  // Delete on API (also removes S3 files)
  await apiDelete(cloudWorkspace.uuid)

  // Delete locally
  await _plugin.fileManager.closeAllFiles()
  const workspacesPath = _plugin.fileProviders.workspace.workspacesPath
  await _plugin.fileProviders.browser.remove(workspacesPath + '/' + localNameForCloud(cloudWorkspace))
}

/**
 * Refresh the cloud workspace list from the API.
 */
export async function refreshCloudWorkspaces(): Promise<CloudWorkspace[]> {
  return apiList()
}

// ── File Change Tracking ─────────────────────────────────────

/**
 * Hook into file provider events to track changes for sync.
 * Call this after activating sync for a workspace.
 * 
 * @param workspaceProvider  The workspace file provider
 * @param workspaceName      The current workspace name (for path stripping)
 */
export function startFileChangeTracking(workspaceProvider: any, workspaceName: string): () => void {
  const listeners: Array<{ event: string; handler: (...args: any[]) => void }> = []

  const addListener = (event: string, handler: (...args: any[]) => void) => {
    workspaceProvider.event.on(event, handler)
    listeners.push({ event, handler })
  }

  addListener('fileAdded', (path: string) => {
    const relativePath = stripWorkspacePrefix(path, workspaceName)
    if (relativePath && !relativePath.startsWith('.git/')) {
      cloudSyncEngine.trackChange({
        path: relativePath,
        type: 'add',
        timestamp: Date.now(),
      })
    }
  })

  addListener('fileChanged', (path: string) => {
    const relativePath = stripWorkspacePrefix(path, workspaceName)
    if (relativePath && !relativePath.startsWith('.git/')) {
      cloudSyncEngine.trackChange({
        path: relativePath,
        type: 'change',
        timestamp: Date.now(),
      })
    }
  })

  addListener('fileRemoved', (path: string) => {
    const relativePath = stripWorkspacePrefix(path, workspaceName)
    if (relativePath && !relativePath.startsWith('.git/')) {
      cloudSyncEngine.trackChange({
        path: relativePath,
        type: 'delete',
        timestamp: Date.now(),
      })
    }
  })

  addListener('fileRenamed', (oldPath: string, newPath: string) => {
    const relativeOld = stripWorkspacePrefix(oldPath, workspaceName)
    const relativeNew = stripWorkspacePrefix(newPath, workspaceName)
    if (relativeNew && !relativeNew.startsWith('.git/')) {
      cloudSyncEngine.trackChange({
        path: relativeNew,
        type: 'rename',
        oldPath: relativeOld,
        timestamp: Date.now(),
      })
    }
  })

  // Return cleanup function
  return () => {
    for (const { event, handler } of listeners) {
      try {
        workspaceProvider.event.off(event, handler)
      } catch { /* ignore */ }
    }
  }
}

/**
 * Strip workspace prefix from a path.
 * Paths come in like "contracts/Token.sol" (already stripped by WorkspaceFileProvider)
 * or ".workspaces/name/contracts/Token.sol".
 */
function stripWorkspacePrefix(path: string, workspaceName: string): string {
  // Remove leading slash
  let p = path.startsWith('/') ? path.slice(1) : path
  // If it starts with .workspaces/name/, strip it
  const prefix = `.workspaces/${workspaceName}/`
  if (p.startsWith(prefix)) {
    p = p.slice(prefix.length)
  }
  return p
}
