/**
 * Cloud Storage Types
 *
 * Shared types for the S3 cloud storage integration.
 * Maps to the STS Storage Token API and Workspace API contracts.
 */

// ── STS Token from POST /storage/sts/token or POST /storage/api/workspaces/:uuid/credentials ──
export interface STSToken {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  expiration: string   // ISO 8601
  durationSeconds: number
  bucket: string
  prefix: string       // e.g. "users/42/" or "users/42/a1b2c3d4-.../"
  region: string
}

// ── Workspace record from the Workspace API ──
export interface CloudWorkspace {
  uuid: string
  user_id: number
  name: string
  created_at: string   // ISO 8601
  last_modified: string
  file_count: number
  total_size: number   // bytes
  migrated_from_local: boolean
}

// ── Sync state for a given file ──
export type FileSyncStatus = 'synced' | 'modified' | 'uploading' | 'error'

// ── Per-file change record tracked by the change tracker ──
export interface FileChangeRecord {
  path: string            // workspace-relative path
  type: 'add' | 'change' | 'delete' | 'rename'
  timestamp: number
  oldPath?: string        // only for renames
}

// ── Overall cloud state exposed via React context ──
export type CloudMode = 'cloud' | 'legacy'

export interface CloudState {
  /** Whether the user is authenticated and cloud mode is active */
  mode: CloudMode
  /** True while the initial cloud workspace list is loading */
  loading: boolean
  /** Cloud workspaces retrieved from the Workspace API */
  cloudWorkspaces: CloudWorkspace[]
  /** UUID of the currently active cloud workspace (null in legacy mode) */
  activeWorkspaceId: string | null
  /** Auth token present */
  isAuthenticated: boolean
  /** Current STS token (null when not authenticated) */
  stsToken: STSToken | null
  /** Sync status per workspace */
  syncStatus: Record<string, WorkspaceSyncStatus>
  /** Error message if something went wrong */
  error: string | null
}

export interface WorkspaceSyncStatus {
  /** 'idle' | 'syncing' | 'error' */
  status: 'idle' | 'syncing' | 'error'
  /** Last successful sync timestamp */
  lastSync: number | null
  /** Pending changes count */
  pendingChanges: number
  /** Error message if status is 'error' */
  error?: string
}

// ── S3 object metadata ──
export interface S3Object {
  key: string
  lastModified: Date
  size: number
  etag?: string
}

// ── Mapping between local workspace name and cloud UUID ──
export interface WorkspaceMapping {
  localName: string
  cloudId: string
  cloudName: string
  lastSync: number
}
