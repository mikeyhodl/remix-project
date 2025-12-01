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
      await this.call('sso', 'login', provider)
    } catch (error) {
      console.error('[AuthPlugin] Login failed:', error)
      throw error
    }
  }

  async logout(): Promise<void> {
    try {
      await this.call('sso', 'logout')
    } catch (error) {
      console.error('[AuthPlugin] Logout failed:', error)
    }
  }

  async getUser(): Promise<AuthUser | null> {
    try {
      return await this.call('sso', 'getUser')
    } catch (error) {
      console.error('[AuthPlugin] Get user failed:', error)
      return null
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      return await this.call('sso', 'isAuthenticated')
    } catch (error) {
      return false
    }
  }

  async getToken(): Promise<string | null> {
    try {
      return await this.call('sso', 'getToken')
    } catch (error) {
      return null
    }
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
    console.log('[AuthPlugin] Activated')
    
    // Debug: Log queue status
    setInterval(() => {
      if ((this as any).queue && (this as any).queue.length > 0) {
        console.log('[AuthPlugin] Queue:', (this as any).queue)
      }
    }, 2000)
    
    // Listen to SSO plugin events and forward them
    this.on('sso', 'authStateChanged', (authState: any) => {
      console.log('[AuthPlugin] authStateChanged received:', authState)
      this.emit('authStateChanged', authState)
      // Auto-refresh credits on auth change
      if (authState.isAuthenticated) {
        this.refreshCredits().catch(console.error)
      }
    })

    this.on('sso', 'loginSuccess', (data: any) => {
      console.log('[AuthPlugin] loginSuccess received:', data)
      this.emit('authStateChanged', { 
        isAuthenticated: true, 
        user: data.user,
        token: null 
      })
      this.refreshCredits().catch(console.error)
    })

    this.on('sso', 'loginError', (data: any) => {
      console.log('[AuthPlugin] loginError received:', data)
      this.emit('authStateChanged', { 
        isAuthenticated: false, 
        user: null,
        token: null,
        error: data.error 
      })
    })

    this.on('sso', 'logout', () => {
      console.log('[AuthPlugin] logout received')
      this.emit('authStateChanged', { 
        isAuthenticated: false, 
        user: null,
        token: null 
      })
    })

    // Handle popup opening from SSO plugin
    this.on('sso', 'openWindow', ({ url, id }: { url: string; id: string }) => {
      console.log('[AuthPlugin] openWindow received:', url, id)
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
        console.error('[AuthPlugin] Popup blocked by browser')
        this.call('sso', 'handlePopupResult', { 
          id, 
          success: false, 
          error: 'Popup blocked by browser' 
        }).catch(console.error)
        return
      }

      // Listen for auth result from popup
      const messageHandler = (event: MessageEvent) => {
        console.log('[AuthPlugin] Message received:', event.data, 'from origin:', event.origin)
        const { type, requestId, user, accessToken, error } = event.data

        if (type === 'sso-auth-result' && requestId === id) {
          console.log('[AuthPlugin] Auth result matched, closing popup')
          cleanup()
          
          try {
            if (popup && !popup.closed) popup.close()
          } catch (e) {}

          console.log('[AuthPlugin] Calling handlePopupResult with:', {id, success: !error, user, accessToken, error})
          this.call('sso', 'handlePopupResult', {
            id,
            success: !error,
            user,
            accessToken,
            error
          }).then(() => {
            console.log('[AuthPlugin] handlePopupResult call succeeded')
          }).catch((err) => {
            console.error('[AuthPlugin] handlePopupResult call failed:', err)
          })
        }
      }

      // Poll for popup closure
      let pollAttempts = 0
      const maxPollAttempts = 600
      const pollInterval = setInterval(() => {
        pollAttempts++
        
        try {
          if (popup.closed) {
            cleanup()
            this.call('sso', 'handlePopupResult', {
              id,
              success: false,
              error: 'Login cancelled - popup closed'
            }).catch(console.error)
          }
        } catch (e) {}
        
        if (pollAttempts >= maxPollAttempts) {
          cleanup()
        }
      }, 1000)

      const cleanup = () => {
        clearInterval(pollInterval)
        window.removeEventListener('message', messageHandler)
      }

      window.addEventListener('message', messageHandler)
    })
  }
}
