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
  credits: {
    balance: number
    free_credits: number
    paid_credits: number
  } | null
}

function SSODemoView({ plugin }: { plugin: SSODemoPlugin }) {
  const [state, setState] = React.useState<SSODemoState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: false,
    error: null,
    logs: [],
    credits: null
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

    // Handle popup window requests from SSO plugin
    plugin.on('sso', 'openWindow', ({ url, id }: { url: string; id: string }) => {
      addLog(`Opening auth popup: ${url.substring(0, 50)}...`)
      
      // Open popup from IDE context (not blocked)
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2
      
      const popup = window.open(
        url,
        'sso-auth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
      )
      
      if (!popup) {
        addLog('Popup blocked! Please allow popups for this site.')
        plugin.call('sso', 'handlePopupResult', { 
          id, 
          success: false, 
          error: 'Popup blocked by browser' 
        })
        return
      }

      // Monitor popup for completion
      const checkInterval = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkInterval)
          addLog('Popup closed')
        }
      }, 1000)

      // Listen for auth result from popup
      const messageHandler = (event: MessageEvent) => {
        const { type, requestId, user, accessToken, error } = event.data
        console.log('[SSO Demo] Message type:', type)
        console.log('[SSO Demo] Request ID:', requestId, 'Expected:', id)

        if (type === 'sso-auth-result' && requestId === id) {
          console.log('[SSO Demo] Auth result matched!')
          addLog(`Auth result received: ${error || 'success'}`)
          clearInterval(checkInterval)
          window.removeEventListener('message', messageHandler)
          
          if (popup && !popup.closed) {
            popup.close()
          }

          // Send result back to SSO plugin
          console.log('[SSO Demo] Calling handlePopupResult with:', { id, success: !error, user, accessToken, error })
          plugin.call('sso', 'handlePopupResult', {
            id,
            success: !error,
            user,
            accessToken,
            error
          })
          
          // Auto-fetch credits after successful login
          if (!error && user) {
            fetchCredits().catch(err => {
              console.error('[SSO Demo] Failed to fetch credits after login:', err)
            })
          }
        } else {
          console.log('[SSO Demo] Message not matched - wrong type or requestId')
        }
      }

      console.log('[SSO Demo] Adding message listener')
      window.addEventListener('message', messageHandler)
    })
  }, [])

  const handleLogin = async (provider: 'google' | 'apple' | 'coinbase' | 'discord' | 'siwe') => {
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

  const testAPICall = async () => {
    addLog('Testing API call to /sso/test-auth...')
    setState(prev => ({ ...prev, loading: true }))
    
    const baseUrl = window.location.hostname.includes('localhost') 
      ? 'http://localhost:3000'
      : 'https://endpoints-remix-dev.ngrok.dev'
    
    const url = `${baseUrl}/sso/test-auth`
    addLog(`Calling: ${url}`)
    addLog(`With credentials: include (cookies sent automatically)`)
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include', // Send cookies
        headers: {
          'Accept': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      addLog('✓ Response received:')
      addLog(JSON.stringify(data, null, 2))
      
      // Check if response has authentication info
      if (data.authenticated || data.isAuthenticated) {
        addLog(`✓ Cookie authentication WORKING! User: ${data.user.sub || data.user.id}`)
        
        // Update credits if included in response
        if (data.credits) {
          setState(prev => ({ ...prev, credits: data.credits }))
          addLog(`✓ Credits updated: ${data.credits.balance} total (${data.credits.free_credits} free + ${data.credits.paid_credits} paid)`)
        }
        
        if (data.message && data.message.includes('deducted')) {
          addLog('✓ 1 credit has been deducted for this API call')
        }
      } else {
        addLog(`⚠ Not authenticated - cookie not sent or invalid`)
      }
      
      setState(prev => ({ ...prev, loading: false }))
    } catch (error: any) {
      addLog(`✗ API call failed: ${error.message}`)
      setState(prev => ({ ...prev, loading: false, error: error.message }))
    }
  }

  const fetchCredits = async () => {
    addLog('Fetching credit balance...')
    
    const baseUrl = window.location.hostname.includes('localhost') 
      ? 'http://localhost:3000'
      : 'https://endpoints-remix-dev.ngrok.dev'
    
    try {
      const response = await fetch(`${baseUrl}/credits/balance`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          addLog('⚠ Not authenticated - login required')
          return
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setState(prev => ({ ...prev, credits: data }))
      addLog(`✓ Credits: ${data.balance} (Free: ${data.free_credits}, Paid: ${data.paid_credits})`)
    } catch (error: any) {
      addLog(`✗ Failed to fetch credits: ${error.message}`)
    }
  }

  const grantCredits = async () => {
    addLog('Granting 1000 free credits...')
    setState(prev => ({ ...prev, loading: true }))
    
    const baseUrl = window.location.hostname.includes('localhost') 
      ? 'http://localhost:3000'
      : 'https://endpoints-remix-dev.ngrok.dev'
    
    try {
      const response = await fetch(`${baseUrl}/credits/grant`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ amount: 1000, reason: 'Test grant from SSO Demo' })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setState(prev => ({ 
        ...prev, 
        loading: false,
        credits: {
          balance: data.balance,
          free_credits: data.free_credits,
          paid_credits: data.paid_credits
        }
      }))
      addLog(`✓ Granted! New balance: ${data.balance}`)
    } catch (error: any) {
      addLog(`✗ Failed to grant credits: ${error.message}`)
      setState(prev => ({ ...prev, loading: false }))
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
              onClick={() => handleLogin('coinbase')}
              disabled={state.loading}
            >
              {state.loading ? 'Loading...' : 'Coinbase'}
            </button>
            <button 
              className="btn btn-sm btn-primary mb-1"
              onClick={() => handleLogin('discord')}
              disabled={state.loading}
            >
              {state.loading ? 'Loading...' : 'Discord'}
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
            className="btn btn-sm btn-info mb-1 w-100"
            onClick={testAPICall}
            disabled={state.loading}
          >
            {state.loading ? 'Testing...' : 'Test API Call (Cookie Auth)'}
          </button>
          <button 
            className="btn btn-sm btn-success mb-1 w-100"
            onClick={fetchCredits}
            disabled={state.loading}
          >
            Fetch Credits
          </button>
          <button 
            className="btn btn-sm btn-warning mb-1 w-100"
            onClick={grantCredits}
            disabled={state.loading}
          >
            {state.loading ? 'Granting...' : 'Grant 1000 Credits'}
          </button>
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

      {/* Credits Display */}
      {state.credits && (
        <div className="mb-3">
          <h6 className="mb-1">Credits:</h6>
          <div className="card">
            <div className="card-body p-2">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="small">Total Balance:</span>
                <span className="badge badge-primary">{state.credits.balance}</span>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="small">Free Credits:</span>
                <span className="badge badge-success">{state.credits.free_credits}</span>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="small">Paid Credits:</span>
                <span className="badge badge-info">{state.credits.paid_credits}</span>
              </div>
            </div>
          </div>
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

    </div>
  )
}
