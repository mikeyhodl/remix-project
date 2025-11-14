import { ViewPlugin } from '@remixproject/engine-web'
import React from 'react'
import * as packageJson from '../../../../../package.json'

const profile = {
  name: 'ssoDemo',
  displayName: 'SSO Demo',
  methods: [],
  events: [],
  icon: 'assets/img/fileManager.webp',
  description: 'Demo plugin for testing SSO authentication',
  location: 'sidePanel',
  documentation: '',
  version: packageJson.version,
  maintainedBy: 'Remix',
}

export class SSODemoPlugin extends ViewPlugin {
  dispatch: React.Dispatch<any> = () => {}
  
  constructor() {
    super(profile)
  }

  async onActivation() {
    await this.call('tabs', 'focus', 'ssoDemo')
  }

  setDispatch(dispatch: React.Dispatch<any>) {
    this.dispatch = dispatch
  }

  render() {
    return <SSODemoView plugin={this} />
  }

  updateComponent(state: any) {
    this.dispatch(state)
  }
}

interface SSODemoState {
  isAuthenticated: boolean
  user: any | null
  token: string | null
  loading: boolean
  error: string | null
  logs: string[]
}

function SSODemoView({ plugin }: { plugin: SSODemoPlugin }) {
  const [state, setState] = React.useState<SSODemoState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: false,
    error: null,
    logs: []
  })

  const addLog = (message: string) => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${message}`]
    }))
  }

  React.useEffect(() => {
    plugin.setDispatch(setState)
    
    // Check initial auth state
    const checkAuthState = async () => {
      try {
        const isAuth = await plugin.call('sso', 'isAuthenticated')
        if (isAuth) {
          const user = await plugin.call('sso', 'getUser')
          const token = await plugin.call('sso', 'getToken')
          setState(prev => ({
            ...prev,
            isAuthenticated: true,
            user,
            token
          }))
          addLog('Restored session on load')
        } else {
          addLog('No active session')
        }
      } catch (error: any) {
        addLog(`Error checking auth: ${error.message}`)
      }
    }

    checkAuthState()

    // Listen to SSO events
    plugin.on('sso', 'authStateChanged', (authState: any) => {
      addLog(`Auth state changed: ${authState.isAuthenticated ? 'logged in' : 'logged out'}`)
      setState(prev => ({
        ...prev,
        isAuthenticated: authState.isAuthenticated,
        user: authState.user,
        token: authState.token
      }))
    })

    plugin.on('sso', 'loginSuccess', ({ user }: any) => {
      addLog(`Login success: ${user.email || user.address}`)
    })

    plugin.on('sso', 'loginError', ({ provider, error }: any) => {
      addLog(`Login error (${provider}): ${error}`)
      setState(prev => ({ ...prev, error, loading: false }))
    })

    plugin.on('sso', 'logout', () => {
      addLog('User logged out')
    })

    plugin.on('sso', 'tokenRefreshed', () => {
      addLog('Token refreshed automatically')
    })
  }, [])

  const handleLogin = async (provider: 'google' | 'apple' | 'siwe') => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    addLog(`Starting login with ${provider}...`)
    try {
      await plugin.call('sso', 'login', provider)
      setState(prev => ({ ...prev, loading: false }))
    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.message 
      }))
      addLog(`Login failed: ${error.message}`)
    }
  }

  const handleLogout = async () => {
    setState(prev => ({ ...prev, loading: true }))
    addLog('Logging out...')
    try {
      await plugin.call('sso', 'logout')
      setState(prev => ({ ...prev, loading: false }))
    } catch (error: any) {
      setState(prev => ({ ...prev, loading: false, error: error.message }))
      addLog(`Logout failed: ${error.message}`)
    }
  }

  const handleRefreshToken = async () => {
    addLog('Manually refreshing token...')
    try {
      await plugin.call('sso', 'refreshToken')
    } catch (error: any) {
      addLog(`Refresh failed: ${error.message}`)
    }
  }

  const copyToken = () => {
    if (state.token) {
      navigator.clipboard.writeText(state.token)
      addLog('Token copied to clipboard')
    }
  }

  return (
    <div className="p-3">
      <h5 className="mb-3">SSO Authentication Demo</h5>

      {/* Auth Status */}
      <div className="mb-3">
        <div className={`badge ${state.isAuthenticated ? 'badge-success' : 'badge-secondary'} mb-2`}>
          {state.isAuthenticated ? '✓ Authenticated' : '○ Not Authenticated'}
        </div>
        {state.user && (
          <div className="small">
            <div><strong>Provider:</strong> {state.user.provider}</div>
            {state.user.email && <div><strong>Email:</strong> {state.user.email}</div>}
            {state.user.name && <div><strong>Name:</strong> {state.user.name}</div>}
            {state.user.address && <div><strong>Address:</strong> {state.user.address}</div>}
            {state.user.chainId && <div><strong>Chain ID:</strong> {state.user.chainId}</div>}
            <div className="mt-1"><strong>Subject:</strong> <code className="small">{state.user.sub}</code></div>
          </div>
        )}
      </div>

      {/* Login Buttons */}
      {!state.isAuthenticated && (
        <div className="mb-3">
          <h6 className="mb-2">Login with:</h6>
          <div className="btn-group-vertical w-100">
            <button 
              className="btn btn-sm btn-primary mb-1"
              onClick={() => handleLogin('google')}
              disabled={state.loading}
            >
              {state.loading ? 'Loading...' : 'Google'}
            </button>
            <button 
              className="btn btn-sm btn-primary mb-1"
              onClick={() => handleLogin('apple')}
              disabled={state.loading}
            >
              {state.loading ? 'Loading...' : 'Apple'}
            </button>
            <button 
              className="btn btn-sm btn-primary mb-1"
              onClick={() => handleLogin('siwe')}
              disabled={state.loading}
            >
              {state.loading ? 'Loading...' : 'Sign-In with Ethereum'}
            </button>
          </div>
        </div>
      )}

      {/* Logged in actions */}
      {state.isAuthenticated && (
        <div className="mb-3">
          <button 
            className="btn btn-sm btn-secondary mb-1 w-100"
            onClick={handleRefreshToken}
          >
            Refresh Token
          </button>
          <button 
            className="btn btn-sm btn-danger w-100"
            onClick={handleLogout}
            disabled={state.loading}
          >
            {state.loading ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      )}

      {/* Token Display */}
      {state.token && (
        <div className="mb-3">
          <h6 className="mb-1">Access Token:</h6>
          <div className="input-group input-group-sm">
            <input 
              type="text" 
              className="form-control font-monospace small"
              value={state.token.substring(0, 40) + '...'}
              readOnly
            />
            <button 
              className="btn btn-outline-secondary"
              type="button"
              onClick={copyToken}
              title="Copy full token"
            >
              📋
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {state.error && (
        <div className="alert alert-danger small mb-3" role="alert">
          {state.error}
        </div>
      )}

      {/* Event Log */}
      <div className="mb-3">
        <h6 className="mb-1">Event Log:</h6>
        <div 
          className="border rounded p-2 small font-monospace"
          style={{ 
            height: '200px', 
            overflowY: 'auto',
            backgroundColor: '#f8f9fa',
            fontSize: '0.7rem'
          }}
        >
          {state.logs.length === 0 ? (
            <div className="text-muted">No events yet...</div>
          ) : (
            state.logs.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))
          )}
        </div>
      </div>

      {/* Info */}
      <div className="small text-muted">
        <p className="mb-1">This demo plugin communicates with the SSO plugin (hidden panel) to handle authentication.</p>
        <p className="mb-0">Tokens are automatically refreshed every 10 minutes.</p>
      </div>
    </div>
  )
}
