import React, { createContext, useContext, useReducer, useEffect, useState, ReactNode } from 'react'
import { AuthUser, AuthProvider as AuthProviderType } from '@remix-api'

export interface Credits {
  balance: number
  free_credits: number
  paid_credits: number
}

export interface AuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  token: string | null
  credits: Credits | null
  loading: boolean
  error: string | null
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: AuthUser; token: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'UPDATE_CREDITS'; payload: Credits }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }

interface AuthContextValue extends AuthState {
  login: (provider: AuthProviderType) => Promise<void>
  logout: () => Promise<void>
  refreshCredits: () => Promise<void>
  dispatch: React.Dispatch<AuthAction>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, loading: true, error: null }
    case 'AUTH_SUCCESS':
      return {
        ...state,
        loading: false,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
        error: null
      }
    case 'AUTH_FAILURE':
      return {
        ...state,
        loading: false,
        error: action.payload
      }
    case 'UPDATE_CREDITS':
      return {
        ...state,
        credits: action.payload
      }
    case 'LOGOUT':
      return {
        isAuthenticated: false,
        user: null,
        token: null,
        credits: null,
        loading: false,
        error: null
      }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    default:
      return state
  }
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  credits: null,
  loading: false,
  error: null
}

interface AuthProviderProps {
  children: ReactNode
  appManager: any
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, appManager }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)
  const [isReady, setIsReady] = useState(false)

  // Wait for appManager to be ready
  useEffect(() => {
    if (!appManager) return
    
    // Delay to ensure plugins are fully loaded and activated
    const timer = setTimeout(() => {
      setIsReady(true)
    }, 2000)
    
    return () => clearTimeout(timer)
  }, [appManager])

  // Initialize auth state on mount
  useEffect(() => {
    if (!isReady || !appManager) return
    
    const initAuth = async () => {
      try {
        // Check if SSO plugin is active before calling it
        const isActive = await appManager.call('manager', 'isActive', 'sso')
        if (!isActive) {
          console.log('[AuthContext] SSO plugin not active yet, waiting...')
          return
        }
        
        const isAuth = await appManager.call('sso', 'isAuthenticated')
        if (isAuth) {
          const user = await appManager.call('sso', 'getUser')
          const token = await appManager.call('sso', 'getToken')
          dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } })
          
          // Fetch credits
          await fetchCredits()
        }
      } catch (error) {
        console.error('[AuthContext] Failed to restore session:', error)
      }
    }

    initAuth()

    // Listen to SSO events
    const handleAuthStateChanged = (authState: any) => {
      if (authState.isAuthenticated) {
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user: authState.user, token: authState.token }
        })
        fetchCredits()
      } else {
        dispatch({ type: 'LOGOUT' })
      }
    }

    const handleLoginSuccess = ({ user }: any) => {
      console.log('[AuthContext] Login success:', user)
      fetchCredits()
    }

    const handleLoginError = ({ error }: any) => {
      dispatch({ type: 'AUTH_FAILURE', payload: error })
    }

    const handleLogout = () => {
      dispatch({ type: 'LOGOUT' })
    }

    const handleOpenWindow = ({ url, id }: { url: string; id: string }) => {
      console.log('[AuthContext] Opening auth popup:', url)
      
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
        console.error('[AuthContext] Popup blocked by browser')
        appManager.call('sso', 'handlePopupResult', { 
          id, 
          success: false, 
          error: 'Popup blocked by browser' 
        }).catch(console.error)
        return
      }

      // Listen for auth result from popup (OIDC providers)
      const messageHandler = (event: MessageEvent) => {
        const { type, requestId, user, accessToken, error } = event.data

        if (type === 'sso-auth-result' && requestId === id) {
          console.log('[AuthContext] Auth result received')
          cleanup()
          
          // Try to close popup (may fail due to COOP, that's okay)
          try {
            if (popup && !popup.closed) {
              popup.close()
            }
          } catch (e) {
            // COOP policy blocks access, ignore
          }

          // Send result back to SSO plugin
          appManager.call('sso', 'handlePopupResult', {
            id,
            success: !error,
            user,
            accessToken,
            error
          }).catch(console.error)
          
          // Auto-fetch credits after successful login
          if (!error && user) {
            fetchCredits()
          }
        }
      }

      // Poll to detect if user closed popup manually
      let pollAttempts = 0
      const maxPollAttempts = 600 // 10 minutes at 1 second intervals
      const pollInterval = setInterval(() => {
        pollAttempts++
        
        try {
          // Try to check if popup is closed (may fail due to COOP)
          if (popup.closed) {
            console.log('[AuthContext] Popup closed by user')
            cleanup()
            
            // Notify plugin that login was cancelled
            appManager.call('sso', 'handlePopupResult', {
              id,
              success: false,
              error: 'Login cancelled - popup closed'
            }).catch(console.error)
            
            // Update UI to show cancellation
            dispatch({ type: 'AUTH_FAILURE', payload: 'Login cancelled' })
            
            // Clear error after 3 seconds so user can try again
            setTimeout(() => {
              dispatch({ type: 'CLEAR_ERROR' })
            }, 3000)
          }
        } catch (e) {
          // COOP policy blocks access - can't detect closure
          // This is expected for cross-origin popups, continue polling
        }
        
        // Stop polling after max attempts
        if (pollAttempts >= maxPollAttempts) {
          console.log('[AuthContext] Popup poll timeout')
          cleanup()
        }
      }, 1000)

      const cleanup = () => {
        clearInterval(pollInterval)
        window.removeEventListener('message', messageHandler)
      }

      window.addEventListener('message', messageHandler)
    }

    try {
      appManager.on('sso', 'authStateChanged', handleAuthStateChanged)
      appManager.on('sso', 'loginSuccess', handleLoginSuccess)
      appManager.on('sso', 'loginError', handleLoginError)
      appManager.on('sso', 'logout', handleLogout)
      appManager.on('sso', 'openWindow', handleOpenWindow)
    } catch (error) {
      console.error('[AuthContext] Failed to register event listeners:', error)
    }

    return () => {
      // Cleanup listeners
      try {
        appManager.off('sso', 'authStateChanged', handleAuthStateChanged)
        appManager.off('sso', 'loginSuccess', handleLoginSuccess)
        appManager.off('sso', 'loginError', handleLoginError)
        appManager.off('sso', 'logout', handleLogout)
        appManager.off('sso', 'openWindow', handleOpenWindow)
      } catch (error) {
        console.error('[AuthContext] Failed to cleanup listeners:', error)
      }
    }
  }, [appManager, isReady])

  const login = async (provider: AuthProviderType) => {
    if (!isReady || !appManager) {
      dispatch({ type: 'AUTH_FAILURE', payload: 'Authentication system not ready' })
      throw new Error('Authentication system not ready')
    }
    
    try {
      dispatch({ type: 'AUTH_START' })
      // Trigger login - actual result comes via events (loginSuccess/loginError)
      // For SIWE: Promise resolves on success/rejects on error
      // For OIDC: Promise resolves when popup callback received
      await appManager.call('sso', 'login', provider)
      
      // Note: AUTH_SUCCESS happens via loginSuccess event, not here
      // This just means the login process started successfully (popup opened, SIWE initiated)
    } catch (error: any) {
      // Only catches immediate failures (wallet not installed, popup blocked, etc.)
      dispatch({ type: 'AUTH_FAILURE', payload: error.message || 'Login failed' })
      throw error
    }
  }

  const logout = async () => {
    if (!isReady || !appManager) return
    
    try {
      await appManager.call('sso', 'logout')
      dispatch({ type: 'LOGOUT' })
    } catch (error) {
      console.error('[AuthContext] Logout failed:', error)
    }
  }

  const fetchCredits = async () => {
    const baseUrl = window.location.hostname.includes('localhost')
      ? 'http://localhost:3000'
      : 'https://endpoints-remix-dev.ngrok.dev'

    try {
      const response = await fetch(`${baseUrl}/credits/balance`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      })

      if (response.ok) {
        const credits = await response.json()
        dispatch({ type: 'UPDATE_CREDITS', payload: credits })
      }
    } catch (error) {
      console.error('[AuthContext] Failed to fetch credits:', error)
    }
  }

  const refreshCredits = async () => {
    await fetchCredits()
  }

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshCredits,
    dispatch
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
