import React, { useState } from 'react'
import { endpointUrls } from '@remix-endpoints-helper'

interface ProtectedEsmDemoLoaderProps {
  ghId: string | null
  hasActiveSubscription: boolean
  demoMessage?: string
}

export const ProtectedEsmDemoLoader: React.FC<ProtectedEsmDemoLoaderProps> = ({ ghId, hasActiveSubscription, demoMessage }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [DemoComponent, setDemoComponent] = useState<React.ComponentType<any> | null>(null)

  const load = async () => {
    try {
      setStatus('loading')
      setError(null)

      if (!ghId) throw new Error('GitHub user not detected')

      // Get a short-lived app token from backend
      const tokenResp = await fetch(`${endpointUrls.billing}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ghId, ghLogin: 'web', plan: 'default' })
      })
      if (!tokenResp.ok) throw new Error('Failed to get app token')
      const { token } = await tokenResp.json()
      if (!token) throw new Error('No token returned')

      const url = `${endpointUrls.billing}/esm/demo?token=${encodeURIComponent(token)}`
      // Instruct bundler to leave this import as-is to resolve at runtime
      // @ts-ignore - webpackIgnore is not a TS thing, it's a bundler hint
      const mod = await import(/* webpackIgnore: true */ url)
      if (!mod || typeof mod.createDemoComponent !== 'function') {
        throw new Error('Module did not export createDemoComponent')
      }

      const Comp = mod.createDemoComponent(React)
      setDemoComponent(() => Comp)
      setStatus('loaded')
    } catch (e: any) {
      console.error('[ProtectedEsmDemo] load failed:', e)
      setError(e?.message || 'Failed to load module')
      setStatus('error')
    }
  }

  const unload = () => {
    setDemoComponent(null)
    setStatus('idle')
    setError(null)
  }

  return (
    <div className="card mt-4">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0">Protected ESM Demo</h6>
          <div>
            {DemoComponent ? (
              <button className="btn btn-sm btn-outline-secondary" onClick={unload}>Unload</button>
            ) : (
              <button className="btn btn-sm btn-primary" onClick={load} disabled={!hasActiveSubscription || !ghId || status === 'loading'}>
                {status === 'loading' ? (
                  <><i className="fas fa-spinner fa-spin me-2"></i>Loading...</>
                ) : (
                  'Load Demo'
                )}
              </button>
            )}
          </div>
        </div>
        {!hasActiveSubscription && (
          <div className="text-muted small mb-2">Requires an active subscription</div>
        )}
        {error && (
          <div className="alert alert-warning py-2 my-2 small"><i className="fas fa-exclamation-circle me-1"></i>{error}</div>
        )}
        {DemoComponent && (
          <div className="mt-2">
            <DemoComponent appMessage={demoMessage} />
          </div>
        )}
      </div>
    </div>
  )
}
