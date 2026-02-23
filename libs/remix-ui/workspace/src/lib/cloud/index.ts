/**
 * Cloud storage module — barrel export.
 */
export { S3Client } from './s3-client'
export { CloudSyncEngine, cloudSyncEngine } from './cloud-sync-engine'
export { CloudProvider, useCloudState } from './cloud-context'
export { cloudStore, useCloudStore } from './cloud-store'
export {
  setCloudPlugin,
  enterCloudProvider,
  exitCloudProvider,
  isCloudProvider,
  getWorkspaceProvider,
  switchToCloudWorkspace,
  renameCloudWorkspaceAction,
  deleteCloudWorkspaceAction,
  refreshCloudWorkspaces,
  startFileChangeTracking,
} from './cloud-workspace-actions'
export {
  enableCloudFSObserver,
  disableCloudFSObserver,
  onCloudFSWrite,
  clearCloudFSListeners,
  isCloudFSObserverActive,
  extractCloudWorkspaceUuid,
  extractRelativePath,
} from './cloud-fs-observer'
export type { FSWriteOperation } from './cloud-fs-observer'
export {
  fetchSTSToken,
  fetchWorkspaceSTS,
  listCloudWorkspaces,
  createCloudWorkspace,
  getCloudWorkspace,
  updateCloudWorkspace,
  deleteCloudWorkspace,
} from './cloud-workspace-api'
export { packWorkspace, unpackWorkspace, WORKSPACE_ZIP_KEY } from './cloud-workspace-zip'
export type {
  STSToken,
  CloudWorkspace,
  CloudState,
  CloudMode,
  WorkspaceSyncStatus,
  FileChangeRecord,
  S3Object,
  WorkspaceMapping,
  FileSyncStatus,
} from './types'
