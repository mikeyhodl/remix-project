import React from 'react'
import { useCloudStore } from './cloud-store'
import { WorkspaceSyncStatus } from './types'
import { CustomTooltip } from '@remix-ui/helper'

/**
 * Derive icon class + color + tooltip from a WorkspaceSyncStatus.
 *
 *  ┌────────────────────────────────┬─────────────────────────────┬──────────────────┬───────────────────────────┐
 *  │ State                          │ Icon                        │ Color            │ Tooltip                   │
 *  ├────────────────────────────────┼─────────────────────────────┼──────────────────┼───────────────────────────┤
 *  │ loading                        │ fa-cloud-arrow-down beat    │ var(--bs-info)   │ Loading workspace…        │
 *  │ syncing (pull)                 │ fa-cloud fa-beat-fade       │ var(--bs-warning)│ Syncing…                  │
 *  │ pushing (local→S3)             │ fa-cloud-arrow-up beat-fade │ var(--bs-info)   │ Uploading changes…        │
 *  │ error                          │ fa-cloud-bolt               │ var(--bs-danger) │ Sync error: <msg>         │
 *  │ idle + pendingChanges > 0      │ fa-cloud-arrow-up           │ var(--bs-warning)│ N pending changes         │
 *  │ idle + pendingChanges=0 synced │ fa-cloud                    │ var(--bs-success)│ Synced <time>             │
 *  │ idle + never synced            │ fa-cloud                    │ var(--bs-info)   │ Connected to cloud        │
 *  └────────────────────────────────┴─────────────────────────────┴──────────────────┴───────────────────────────┘
 */
export function getSyncIconProps(status: WorkspaceSyncStatus | undefined): {
    icon: string
    color: string
    title: string
    animate?: string
} {
    if (!status) {
        // No status yet — initial/unknown
        return { icon: 'fas fa-cloud', color: 'var(--bs-info)', title: 'Connected to cloud' }
    }

    if (status.status === 'loading') {
        return {
            icon: 'fas fa-cloud-arrow-down',
            color: 'var(--bs-info)',
            title: 'Loading workspace…',
            animate: 'fa-beat-fade',
        }
    }

    if (status.status === 'syncing') {
        return {
            icon: 'fas fa-cloud',
            color: 'var(--bs-warning)',
            title: 'Syncing…',
            animate: 'fa-beat-fade',
        }
    }

    if (status.status === 'pushing') {
        return {
            icon: 'fas fa-cloud-arrow-up',
            color: 'var(--bs-info)',
            title: 'Uploading changes…',
            animate: 'fa-beat-fade',
        }
    }

    if (status.status === 'error') {
        return {
            icon: 'fas fa-cloud-bolt',
            color: 'var(--bs-danger)',
            title: `Sync error${status.error ? ': ' + status.error : ''}`,
        }
    }

    // idle
    if (status.pendingChanges > 0) {
        return {
            icon: 'fas fa-cloud-arrow-up',
            color: 'var(--bs-warning)',
            title: `${status.pendingChanges} pending change${status.pendingChanges !== 1 ? 's' : ''}`,
        }
    }

    if (status.lastSync) {
        return {
            icon: 'fas fa-cloud',
            color: 'var(--bs-success)',
            title: `Synced ${formatRelativeTime(status.lastSync)}`,
        }
    }

    // idle, no pending, never synced
    return { icon: 'fas fa-cloud', color: 'var(--bs-info)', title: 'Connected to cloud' }
}

function formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return new Date(ts).toLocaleDateString()
}

// ── Inline icon for workspace dropdown items ──────────────────────────

interface CloudSyncStatusIconProps {
    /** The cloud workspace UUID (remoteId from WorkspaceMetadata) */
    remoteId: string
    /** Extra CSS classes */
    className?: string
    /** Font size override (default: 0.8em — matches the existing dropdown icon) */
    fontSize?: string
}

/**
 * A small cloud icon that reflects the live sync status of a cloud workspace.
 * Drop-in replacement for the old static `<i className="fas fa-cloud" …>` icons
 * in the workspace dropdown.
 */
export const CloudSyncStatusIcon: React.FC<CloudSyncStatusIconProps> = ({
    remoteId,
    className = 'ms-2',
    fontSize = '0.8em',
}) => {
    const { syncStatus } = useCloudStore()
    const ws = syncStatus[remoteId]
    const { icon, color, title, animate } = getSyncIconProps(ws)

    return (
        <i
            className={`${icon}${animate ? ' ' + animate : ''} ${className}`}
            style={{ color, fontSize }}
            title={title}
        />
    )
}

// ── Topbar-sized indicator ────────────────────────────────────────────

/**
 * Cloud status badge for the topbar.
 *
 * - Cloud mode ON  → shows sync status icon (green/orange/red etc.)
 * - Cloud mode OFF → shows a clickable disconnected-cloud button
 */
export const CloudTopbarIndicator: React.FC<{ className?: string; onClick?: () => void }> = ({ className = 'ms-2', onClick }) => {
    const { isCloudMode, activeWorkspaceId, syncStatus } = useCloudStore()

    if (!isCloudMode) {
        return (
            <CustomTooltip placement="bottom" tooltipText="Connect to cloud storage">
                <span
                    className={`d-inline-flex align-items-center ${className}`}
                    style={{ cursor: 'default' }}
                >
                    <i className="fas text-warning fa-cloud-slash" style={{ fontSize: '1rem' }} />
                </span>
            </CustomTooltip>
        )
    }

    const ws = activeWorkspaceId ? syncStatus[activeWorkspaceId] : undefined
    const { icon, color, title, animate } = getSyncIconProps(ws)

    return (
        <span
            className={`d-inline-flex align-items-center ${className}`}
            title={title}
            style={{ cursor: 'default' }}
        >
            <i
                className={`${icon}${animate ? ' ' + animate : ''}`}
                style={{ color, fontSize: '1rem' }}
            />
        </span>
    )
}
