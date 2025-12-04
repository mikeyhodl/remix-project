import { Plugin } from '@remixproject/engine'
import { AuthUser, AuthProvider as AuthProviderType } from '@remix-api'
import { endpointUrls } from '@remix-endpoints-helper'

export interface Credits {
  balance: number
  free_credits: number
  paid_credits: number
}

const profile = {
  name: 'auth',
  displayName: 'Authentication',
  description: 'Handles SSO authentication and credits',
  methods: ['login', 'logout', 'getUser', 'getCredits', 'refreshCredits'],
  events: ['authStateChanged', 'creditsUpdated']
}

export class AuthPlugin extends Plugin {
  constructor() {
    super(profile)
  }

  async login(provider: AuthProviderType): Promise<void> {
    try {
      console.log('[AuthPlugin] Starting popup-based login for:', provider)
      
      // SIWE requires special handling (client-side wallet signature)
      if (provider === 'siwe') {
        // TODO: Implement SIWE flow with wallet connection
        throw new Error('SIWE login not yet implemented. Please use another provider.')
      }
      
      // Open popup directly (must be in user click event)
      const popup = window.open(
        `${endpointUrls.sso}/login/${provider}?mode=popup&origin=${encodeURIComponent(window.location.origin)}`,
        'RemixLogin',
        'width=500,height=600,menubar=no,toolbar=no,location=no,status=no'
      )
      
      if (!popup) {
        throw new Error('Popup was blocked. Please allow popups for this site.')
      }
      
      // Wait for message from popup
      const result = await new Promise<{user: AuthUser; accessToken: string; refreshToken: string}>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup()
          reject(new Error('Login timeout'))
        }, 5 * 60 * 1000) // 5 minute timeout
        
        const handleMessage = (event: MessageEvent) => {
          // Verify origin
          if (event.origin !== new URL(endpointUrls.sso).origin) {
            return
          }
          
          if (event.data.type === 'sso-auth-success') {
            console.log('[AuthPlugin] Received auth success from popup')
            cleanup()
            resolve({
              user: event.data.user,
              accessToken: event.data.accessToken,
              refreshToken: event.data.refreshToken
            })
          } else if (event.data.type === 'sso-auth-error') {
            cleanup()
            reject(new Error(event.data.error || 'Login failed'))
          }
        }
        
        const cleanup = () => {
          clearTimeout(timeout)
          window.removeEventListener('message', handleMessage)
          if (popup && !popup.closed) {
            popup.close()
          }
        }
        
        window.addEventListener('message', handleMessage)
      })
      
      // Store tokens in localStorage
      localStorage.setItem('remix_access_token', result.accessToken)
      localStorage.setItem('remix_refresh_token', result.refreshToken)
      localStorage.setItem('remix_user', JSON.stringify(result.user))
      
      // Emit auth state change
      this.emit('authStateChanged', {
        isAuthenticated: true,
        user: result.user,
        token: result.accessToken
      })
      
      console.log('[AuthPlugin] Login successful')
    } catch (error) {
      console.error('[AuthPlugin] Login failed:', error)
      throw error
    }
  }

  async logout(): Promise<void> {
    try {
      // Call backend logout endpoint
      await fetch(`${endpointUrls.sso}/logout`, {
        method: 'POST',
        credentials: 'include'
      })
      
      // Clear localStorage
      localStorage.removeItem('remix_access_token')
      localStorage.removeItem('remix_refresh_token')
      localStorage.removeItem('remix_user')
      
      // Emit auth state change
      this.emit('authStateChanged', {
        isAuthenticated: false,
        user: null,
        token: null
      })
      
      console.log('[AuthPlugin] Logout successful')
    } catch (error) {
      console.error('[AuthPlugin] Logout failed:', error)
    }
  }

  async getUser(): Promise<AuthUser | null> {
    try {
      const userStr = localStorage.getItem('remix_user')
      return userStr ? JSON.parse(userStr) : null
    } catch (error) {
      console.error('[AuthPlugin] Get user failed:', error)
      return null
    }
  }

  async isAuthenticated(): Promise<boolean> {
    return !!localStorage.getItem('remix_access_token')
  }

  async getToken(): Promise<string | null> {
    return localStorage.getItem('remix_access_token')
  }

  async getCredits(): Promise<Credits | null> {
    try {
      // Get the JWT token from SSO plugin
      const token = await this.getToken()
      
      console.log('[AuthPlugin] Fetching credits from:', endpointUrls.credits)
      console.log('[AuthPlugin] Token available:', !!token)

      const headers: any = { 
        'Accept': 'application/json'
      }
      
      // Add Authorization header if we have a token
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${endpointUrls.credits}/balance`, {
        method: 'GET',
        credentials: 'include',  // Also send cookies as fallback
        headers
      })

      console.log('[AuthPlugin] Credits response status:', response.status)

      if (response.ok) {
        return await response.json()
      }
      
      if (response.status === 401) {
        console.warn('[AuthPlugin] Not authenticated for credits')
      }
      
      return null
    } catch (error) {
      console.error('[AuthPlugin] Failed to fetch credits:', error)
      return null
    }
  }

  async refreshCredits(): Promise<Credits | null> {
    const credits = await this.getCredits()
    if (credits) {
      this.emit('creditsUpdated', credits)
    }
    return credits
  }

  onActivation(): void {
    console.log('[AuthPlugin] Activated - using popup + localStorage mode')
    
    // Check if user is already logged in
    const token = localStorage.getItem('remix_access_token')
    if (token) {
      const userStr = localStorage.getItem('remix_user')
      if (userStr) {
        try {
          const user = JSON.parse(userStr)
          this.emit('authStateChanged', {
            isAuthenticated: true,
            user,
            token
          })
          // Auto-refresh credits
          this.refreshCredits().catch(console.error)
        } catch (e) {
          console.error('[AuthPlugin] Failed to restore user session:', e)
        }
      }
    }
  }
}
