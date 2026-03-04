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
import {
  enableCloud,
  disableCloud,
} from './cloud-workspace-actions'

// ── Provider ─────────────────────────────────────────────────

interface CloudProviderProps {
  children: React.ReactNode
  plugin: any // the filePanel plugin, needed to listen for auth events
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
        // Delegate to enableCloud which handles everything:
        // provider swap, store update, workspace switch, Redux dispatches
        cloudStore.setAuthenticated(true)
        try {
          await enableCloud()
        } catch (err) {
          console.error('[CloudProvider] Failed to enable cloud on login:', err)
        }
      } else {
        // Logout: disable cloud (restores provider, switches to local workspace)
        // then fully reset auth state
        try {
          await disableCloud()
        } catch (err) {
          console.error('[CloudProvider] Failed to disable cloud on logout:', err)
        }
        cloudStore.exitCloudMode() // full reset including isAuthenticated
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
