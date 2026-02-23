/**
 * Cloud Storage React Context
 *
 * Wraps the module-level `cloudStore` singleton so that:
 *  1. The workspace React tree wires auth plugin events to cloud state.
 *  2. On login: swaps the workspace file provider to CloudWorkspaceFileProvider.
 *  3. On logout: restores the original WorkspaceFileProvider.
 *
 * IMPORTANT: The `cloudStore` singleton is the source of truth. Components
 * in other React trees (e.g. the topbar) can use `useCloudStore()` directly
 * from `./cloud-store` without needing React Context.
 */

import React, { useEffect, useRef } from 'react'
import { cloudStore, useCloudStore } from './cloud-store'
import { listCloudWorkspaces, fetchSTSToken } from './cloud-workspace-api'
import {
  enterCloudProvider,
  exitCloudProvider,
  switchToCloudWorkspace,
  startFileChangeTracking,
} from './cloud-workspace-actions'

// ── Provider ─────────────────────────────────────────────────

interface CloudProviderProps {
  children: React.ReactNode
  plugin: any  // the filePanel plugin, needed to listen for auth events
}

/**
 * Wires the auth plugin events to the cloud store.
 * Place this high in the workspace React tree (e.g. around FileSystemProvider).
 */
export const CloudProvider: React.FC<CloudProviderProps> = ({ children, plugin }) => {
  const pluginRef = useRef(plugin)
  pluginRef.current = plugin

  // ── Listen for auth state changes ──

  useEffect(() => {
    if (!pluginRef.current) return

    const handleAuthStateChanged = async (authState: { isAuthenticated: boolean; user: any; token: string }) => {
      if (authState.isAuthenticated) {
        cloudStore.setLoading(true)
        cloudStore.setAuthenticated(true)
        try {
          // Fetch cloud workspaces and STS token in parallel
          const [workspaces, stsToken] = await Promise.all([
            listCloudWorkspaces(),
            fetchSTSToken(),
          ])

          // Swap the file provider to CloudWorkspaceFileProvider
          // This handles all name↔UUID translation internally
          enterCloudProvider(workspaces)

          cloudStore.enterCloudMode(workspaces, stsToken)

          // Switch to the last active cloud workspace, or the first one
          if (workspaces.length > 0) {
            const lastWorkspaceName = localStorage.getItem('currentWorkspace')
            const targetWs = workspaces.find(w => w.name === lastWorkspaceName) || workspaces[0]
            try {
              await switchToCloudWorkspace(targetWs, (status) => {
                cloudStore.updateSyncStatus(targetWs.uuid, status)
              })
              cloudStore.setActiveCloudWorkspace(targetWs.uuid)
              // Start file change tracking for sync
              const workspaceProvider = pluginRef.current.fileProviders?.workspace
              if (workspaceProvider) {
                startFileChangeTracking(workspaceProvider, targetWs.uuid)
              }
            } catch (err) {
              console.error('[CloudProvider] Failed to switch to cloud workspace:', err)
            }
          }
        } catch (err) {
          console.error('[CloudProvider] Failed to initialize cloud mode:', err)
          cloudStore.setError(err.message)
          cloudStore.setLoading(false)
        }
      } else {
        // Logout: restore the original workspace provider
        cloudStore.exitCloudMode()
        exitCloudProvider()
      }
    }

    pluginRef.current.on('auth', 'authStateChanged', handleAuthStateChanged)

    // Check initial auth state
    ;(async () => {
      try {
        const isAuth = await pluginRef.current.call('auth', 'isAuthenticated')
        if (isAuth) {
          const token = await pluginRef.current.call('auth', 'getToken')
          handleAuthStateChanged({ isAuthenticated: true, user: null, token })
        }
      } catch (e) {
        // auth plugin may not be activated yet — that's fine
        console.log('[CloudProvider] Auth plugin not ready yet')
      }
    })()

    return () => {
      try {
        pluginRef.current?.off('auth', 'authStateChanged')
      } catch { /* ignore cleanup errors */ }
    }
  }, [])

  return <>{children}</>
}

// ── Convenience Hook ─────────────────────────────────────────

/**
 * Re-export useCloudStore for backward compat.
 * Components in the workspace tree can use this OR import useCloudStore directly.
 */
export { useCloudStore as useCloudState }
