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
  plugin: any
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, plugin }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)
  const [isReady, setIsReady] = useState(false)

  // Wait for plugin to be ready
  useEffect(() => {
    if (!plugin) return
    
    // Small delay to ensure plugin is activated
    const timer = setTimeout(() => {
      setIsReady(true)
    }, 5000)
    
    return () => clearTimeout(timer)
  }, [plugin])

  // Initialize auth state on mount
  useEffect(() => {
    if (!isReady || !plugin) return
    
    const initAuth = async () => {
      try {
        const isAuth = await plugin.isAuthenticated()
        if (isAuth) {
          const user = await plugin.getUser()
          const token = await plugin.getToken()
          if (user && token) {
            dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } })
          }
          
          // Fetch credits
          const credits = await plugin.getCredits()
          if (credits) {
            dispatch({ type: 'UPDATE_CREDITS', payload: credits })
          }
        }
      } catch (error) {
        console.error('[AuthContext] Failed to restore session:', error)
      }
    }

    initAuth()

    // Listen to auth plugin events
    const handleAuthStateChanged = (authState: any) => {
      console.log('[AuthContext] Auth state changed:', authState)
      if (authState.isAuthenticated && authState.user) {
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user: authState.user, token: authState.token || null }
        })
      } else {
        dispatch({ type: 'LOGOUT' })
      }
    }

    const handleCreditsUpdated = (credits: Credits) => {
      console.log('[AuthContext] Credits updated:', credits)
      dispatch({ type: 'UPDATE_CREDITS', payload: credits })
    }

    console.log('[AuthContext] Setting up event listeners, plugin.on exists:', typeof plugin.on)
    plugin.on('auth', 'authStateChanged', handleAuthStateChanged)
    plugin.on('auth', 'creditsUpdated', handleCreditsUpdated)
    console.log('[AuthContext] Event listeners registered')

    return () => {
      plugin.off('auth', 'authStateChanged', handleAuthStateChanged)
      plugin.off('auth', 'creditsUpdated', handleCreditsUpdated)
    }
  }, [plugin, isReady])

  const login = async (provider: AuthProviderType) => {
    if (!isReady || !plugin) {
      dispatch({ type: 'AUTH_FAILURE', payload: 'Authentication system not ready' })
      throw new Error('Authentication system not ready')
    }
    
    try {
      dispatch({ type: 'AUTH_START' })
      await plugin.login(provider)
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message || 'Login failed' })
      throw error
    }
  }

  const logout = async () => {
    if (!isReady || !plugin) return
    
    try {
      await plugin.logout()
      dispatch({ type: 'LOGOUT' })
    } catch (error) {
      console.error('[AuthContext] Logout failed:', error)
    }
  }

  const refreshCredits = async () => {
    if (!plugin) return
    const credits = await plugin.refreshCredits()
    if (credits) {
      dispatch({ type: 'UPDATE_CREDITS', payload: credits })
    }
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
