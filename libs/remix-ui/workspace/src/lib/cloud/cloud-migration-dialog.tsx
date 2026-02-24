/**
 * Cloud Migration Dialog
 *
 * A React component that presents a modal for migrating local workspaces
 * (/.workspaces/<name>) to cloud workspaces (/.cloud-workspaces/<uuid> + S3).
 *
 * Features:
 *  - Discover local workspaces that haven't been migrated
 *  - Show file count and estimated size per workspace
 *  - Detect name conflicts with existing cloud workspaces
 *  - Allow editing the cloud name when there's a conflict
 *  - Per-workspace migration progress with status indicators
 *  - Atomic migration with rollback on failure
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ModalDialog } from '@remix-ui/modal-dialog'
import {
  discoverLocalWorkspaces,
  buildMigrationItems,
  migrateWorkspaces,
  MigrationItem,
  MigrationStatus,
  LocalWorkspaceInfo,
} from './cloud-migration'
import { cloudStore } from './cloud-store'
import { refreshCloudWorkspaces } from './cloud-workspace-actions'

// ── Types ────────────────────────────────────────────────────

interface CloudMigrationDialogProps {
  /** Whether the dialog is visible */
  visible: boolean
  /** Callback to hide the dialog */
  onHide: () => void
  /** Callback after migration completes (to refresh workspace list etc.) */
  onMigrationComplete?: () => void
  /** The plugin instance (for toasts, notifications) */
  plugin?: any
}

type DialogPhase = 'loading' | 'select' | 'migrating' | 'done'

// ── Helpers ──────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const STATUS_ICONS: Record<MigrationStatus, { icon: string; color: string }> = {
  pending:   { icon: 'far fa-circle',          color: 'var(--bs-secondary)' },
  creating:  { icon: 'fas fa-spinner fa-spin', color: 'var(--bs-info)' },
  copying:   { icon: 'fas fa-spinner fa-spin', color: 'var(--bs-info)' },
  uploading: { icon: 'fas fa-cloud-upload-alt fa-beat', color: 'var(--bs-info)' },
  verifying: { icon: 'fas fa-spinner fa-spin', color: 'var(--bs-info)' },
  cleaning:  { icon: 'fas fa-broom',           color: 'var(--bs-warning)' },
  done:      { icon: 'fas fa-check-circle',    color: 'var(--bs-success)' },
  error:     { icon: 'fas fa-times-circle',    color: 'var(--bs-danger)' },
  skipped:   { icon: 'fas fa-minus-circle',    color: 'var(--bs-secondary)' },
}

// ── Component ────────────────────────────────────────────────

export const CloudMigrationDialog: React.FC<CloudMigrationDialogProps> = ({
  visible,
  onHide,
  onMigrationComplete,
  plugin,
}) => {
  const [phase, setPhase] = useState<DialogPhase>('loading')
  const [localWorkspaces, setLocalWorkspaces] = useState<LocalWorkspaceInfo[]>([])
  const [items, setItems] = useState<MigrationItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cloudNames, setCloudNames] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  // ── Load local workspaces when dialog becomes visible ──

  useEffect(() => {
    if (!visible) return
    let cancelled = false

    setPhase('loading')
    setError(null)

    ;(async () => {
      try {
        const locals = await discoverLocalWorkspaces()
        if (cancelled) return

        if (locals.length === 0) {
          setLocalWorkspaces([])
          setItems([])
          setSelected(new Set())
          setPhase('select')
          return
        }

        setLocalWorkspaces(locals)
        const migrationItems = await buildMigrationItems(locals)
        if (cancelled) return

        setItems(migrationItems)
        // Pre-select all non-conflict workspaces
        setSelected(new Set(migrationItems.map(i => i.localName)))
        // Pre-fill cloud names
        const names: Record<string, string> = {}
        for (const it of migrationItems) {
          names[it.localName] = it.cloudName
        }
        setCloudNames(names)
        setPhase('select')
      } catch (err) {
        if (!cancelled) {
          setError(err.message || String(err))
          setPhase('select')
        }
      }
    })()

    return () => { cancelled = true }
  }, [visible])

  // ── Selection handlers ──

  const toggleSelect = useCallback((localName: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(localName)) {
        next.delete(localName)
      } else {
        next.add(localName)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelected(prev => {
      if (prev.size === items.length) {
        return new Set()
      }
      return new Set(items.map(i => i.localName))
    })
  }, [items])

  const updateCloudName = useCallback((localName: string, newCloudName: string) => {
    setCloudNames(prev => ({ ...prev, [localName]: newCloudName }))
  }, [])

  // ── Migration ──

  const selectedCount = useMemo(() => {
    return items.filter(i => selected.has(i.localName)).length
  }, [items, selected])

  const startMigration = useCallback(async () => {
    // Prepare items: mark selected vs skipped, apply custom cloud names
    const preparedItems = items.map(item => ({
      ...item,
      cloudName: cloudNames[item.localName] || item.cloudName,
      status: (selected.has(item.localName) ? 'pending' : 'skipped') as MigrationStatus,
    }))

    setItems(preparedItems)
    setPhase('migrating')

    try {
      const results = await migrateWorkspaces(preparedItems, (updatedItems) => {
        setItems([...updatedItems])
      })

      setPhase('done')

      // Refresh cloud workspace list in the store
      if (results.length > 0) {
        try {
          await refreshCloudWorkspaces()
        } catch { /* ignore */ }
        onMigrationComplete?.()
      }
    } catch (err) {
      console.error('[MigrationDialog] Migration failed:', err)
      setPhase('done')
    }
  }, [items, selected, cloudNames, onMigrationComplete])

  // ── Result summary ──

  const summary = useMemo(() => {
    const done = items.filter(i => i.status === 'done').length
    const failed = items.filter(i => i.status === 'error').length
    const skipped = items.filter(i => i.status === 'skipped').length
    return { done, failed, skipped }
  }, [items])

  // ── Prevent closing during migration ──

  const handleHide = useCallback(() => {
    if (phase === 'migrating') return  // can't close while migrating
    onHide()
  }, [phase, onHide])

  // ── Render ──

  const renderBody = () => {
    if (phase === 'loading') {
      return (
        <div className="d-flex align-items-center justify-content-center py-4">
          <i className="fas fa-spinner fa-spin me-2"></i>
          <span>Discovering local workspaces...</span>
        </div>
      )
    }

    if (error && phase === 'select') {
      return (
        <div className="alert alert-danger mb-0">
          <i className="fas fa-exclamation-triangle me-2"></i>
          Failed to discover workspaces: {error}
        </div>
      )
    }

    if (phase === 'select' && items.length === 0) {
      return (
        <div className="d-flex flex-column align-items-center py-4">
          <i className="fas fa-check-circle text-success mb-2" style={{ fontSize: '2rem' }}></i>
          <span>All local workspaces have already been migrated to the cloud.</span>
        </div>
      )
    }

    return (
      <div className="d-flex flex-column" style={{ maxHeight: '60vh', overflow: 'auto' }}>
        {phase === 'select' && (
          <div className="mb-2 d-flex align-items-center">
            <input
              type="checkbox"
              id="migration-select-all"
              checked={selected.size === items.length}
              onChange={toggleSelectAll}
              className="form-check-input me-2 mt-0"
            />
            <label htmlFor="migration-select-all" className="form-check-label small text-muted">
              Select all ({items.length} workspace{items.length !== 1 ? 's' : ''})
            </label>
          </div>
        )}

        {items.map((item) => {
          const localWs = localWorkspaces.find(l => l.name === item.localName)
          const isSelected = selected.has(item.localName)
          const statusInfo = STATUS_ICONS[item.status] || STATUS_ICONS.pending
          const isMigrating = phase === 'migrating' || phase === 'done'

          return (
            <div
              key={item.localName}
              className={`d-flex align-items-start p-2 mb-1 rounded ${
                isSelected && !isMigrating ? 'border border-primary' : 'border'
              }`}
              style={{ backgroundColor: 'var(--remix-light-bg, var(--bs-light))' }}
            >
              {/* Checkbox (selection phase only) */}
              {phase === 'select' && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(item.localName)}
                  className="form-check-input me-2 mt-1 flex-shrink-0"
                />
              )}

              {/* Status icon (migration phase) */}
              {isMigrating && (
                <i
                  className={`${statusInfo.icon} me-2 mt-1 flex-shrink-0`}
                  style={{ color: statusInfo.color, width: '1rem', textAlign: 'center' }}
                ></i>
              )}

              {/* Workspace info */}
              <div className="flex-grow-1 min-w-0">
                <div className="d-flex align-items-center">
                  <span className="fw-bold text-truncate">{item.localName}</span>
                  {item.nameConflict && phase === 'select' && (
                    <span
                      className="badge bg-warning text-dark ms-2 flex-shrink-0"
                      title="A cloud workspace with this name already exists"
                    >
                      name conflict
                    </span>
                  )}
                </div>

                {/* File count + size */}
                {localWs && (
                  <div className="small text-muted">
                    {localWs.fileCount} file{localWs.fileCount !== 1 ? 's' : ''} · {formatSize(localWs.totalSize)}
                  </div>
                )}

                {/* Editable cloud name (only when conflict + selection phase) */}
                {item.nameConflict && phase === 'select' && isSelected && (
                  <div className="mt-1">
                    <label className="small text-muted">Cloud workspace name:</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={cloudNames[item.localName] || ''}
                      onChange={(e) => updateCloudName(item.localName, e.target.value)}
                    />
                  </div>
                )}

                {/* Progress text (migration phase) */}
                {isMigrating && item.status !== 'skipped' && (
                  <div className="small" style={{ color: item.status === 'error' ? 'var(--bs-danger)' : 'var(--bs-secondary-color, var(--bs-secondary))' }}>
                    {item.progress || item.status}
                  </div>
                )}

                {/* Error detail */}
                {item.status === 'error' && item.error && (
                  <div className="small text-danger text-break">
                    {item.error}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Summary (done phase) */}
        {phase === 'done' && (
          <div className="mt-3 p-2 rounded border">
            <div className="d-flex align-items-center">
              <i className={`fas ${summary.failed > 0 ? 'fa-exclamation-triangle text-warning' : 'fa-check-circle text-success'} me-2`}></i>
              <span>
                Migration complete: {summary.done} succeeded
                {summary.failed > 0 && `, ${summary.failed} failed`}
                {summary.skipped > 0 && `, ${summary.skipped} skipped`}
              </span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Build different modal configs based on phase
  const getOkLabel = (): string => {
    switch (phase) {
    case 'loading':
      return 'Loading...'
    case 'select':
      return selectedCount > 0 ? `Migrate ${selectedCount} workspace${selectedCount !== 1 ? 's' : ''}` : 'Migrate'
    case 'migrating':
      return 'Migrating...'
    case 'done':
      return 'Close'
    }
  }

  const getOkFn = () => {
    if (phase === 'select' && selectedCount > 0) return startMigration
    if (phase === 'done') return handleHide
    return undefined
  }

  const okFn = getOkFn()

  return (
    <ModalDialog
      id="cloud-migration-dialog"
      title={
        <span>
          <i className="fas fa-cloud-upload-alt me-2"></i>
          Migrate Workspaces to Cloud
        </span>
      }
      message={renderBody()}
      hide={!visible}
      handleHide={handleHide}
      okLabel={getOkLabel()}
      okFn={okFn}
      cancelLabel={phase === 'migrating' ? undefined : (phase === 'done' ? undefined : 'Skip')}
      cancelFn={phase === 'migrating' ? undefined : handleHide}
      showCancelIcon={phase !== 'migrating'}
      modalParentClass="modal-dialog-centered"
    />
  )
}

export default CloudMigrationDialog
