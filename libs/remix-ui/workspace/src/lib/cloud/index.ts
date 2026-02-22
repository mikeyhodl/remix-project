/**
 * Cloud storage module — barrel export.
 */
export { S3Client } from './s3-client'
export { CloudSyncEngine, cloudSyncEngine } from './cloud-sync-engine'
export { CloudProvider, useCloudState } from './cloud-context'
export { cloudStore, useCloudStore } from './cloud-store'
export {
  setCloudPlugin,
  createCloudWorkspaceAction,
  switchToCloudWorkspace,
  renameCloudWorkspaceAction,
  deleteCloudWorkspaceAction,
  refreshCloudWorkspaces,
  startFileChangeTracking,
} from './cloud-workspace-actions'
export {
  fetchSTSToken,
  fetchWorkspaceSTS,
  listCloudWorkspaces,
  createCloudWorkspace,
  getCloudWorkspace,
  updateCloudWorkspace,
  deleteCloudWorkspace,
} from './cloud-workspace-api'
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
