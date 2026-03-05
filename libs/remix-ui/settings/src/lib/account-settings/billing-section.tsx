import React, { useState, useEffect } from 'react'
import { LoginMode, AppConfig } from '@remix-api'
import { BillingManager } from '@remix-ui/billing'

interface BillingSectionProps {
  plugin: any
}

export const BillingSection: React.FC<BillingSectionProps> = ({ plugin }) => {
  const [paddleConfig, setPaddleConfig] = useState<{ clientToken: string | null; environment: 'sandbox' | 'production' } | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loginEnabled, setLoginEnabled] = useState(false)
  const [configEnabled, setConfigEnabled] = useState(true)

  useEffect(() => {
    // Fetch login mode from auth plugin
    const fetchLoginMode = async () => {
      try {
        const response = await plugin?.call('auth', 'getLoginMode')
        const mode: LoginMode = response?.mode || 'open'
        setLoginEnabled(mode !== 'closed')
      } catch {
        // Fallback to localStorage for backwards compatibility
        setLoginEnabled(localStorage.getItem('enableLogin') === 'true')
      }
    }
    fetchLoginMode()

    // Listen for login mode changes
    const handleLoginModeChanged = (response: { mode: LoginMode; message: string }) => {
      if (response?.mode) {
        setLoginEnabled(response.mode !== 'closed')
      }
    }
    try {
      plugin?.on('auth', 'loginModeChanged', handleLoginModeChanged)
    } catch { /* ignore */ }

    // Fetch app config for billing flag
    const fetchAppConfig = async () => {
      try {
        const config: AppConfig = await plugin?.call('auth', 'getAppConfig')
        if (config && config['billing.enable_subscriptions'] === false) {
          setConfigEnabled(false)
        }
      } catch { /* ignore */ }
    }
    fetchAppConfig()

    const handleAppConfigChanged = (config: AppConfig) => {
      setConfigEnabled(config?.['billing.enable_subscriptions'] !== false)
    }
    try {
      plugin?.on('auth', 'appConfigChanged', handleAppConfigChanged)
    } catch { /* ignore */ }

    // Get Paddle configuration
    const loadPaddleConfig = async () => {
      try {
        const config = await plugin?.call('auth', 'getPaddleConfig')
        setPaddleConfig(config)
      } catch (err) {
        console.log('[BillingSection] Could not load Paddle config:', err)
      }
    }
    loadPaddleConfig()

    // Check auth status
    const checkAuth = async () => {
      try {
        const user = await plugin?.call('auth', 'getUser')
        setIsAuthenticated(!!user)
      } catch {
        setIsAuthenticated(false)
      }
    }
    checkAuth()

    // Listen for auth changes
    const handleAuthChange = (authState: { isAuthenticated: boolean }) => {
      setIsAuthenticated(authState.isAuthenticated)
    }

    try {
      plugin?.on('auth', 'authStateChanged', handleAuthChange)
    } catch {
      // Ignore if plugin not available
    }

    return () => {
      try {
        plugin?.off('auth', 'authStateChanged')
        plugin?.off('auth', 'loginModeChanged')
        plugin?.off('auth', 'appConfigChanged')
      } catch {
        // Ignore
      }
    }
  }, [plugin])

  if (!loginEnabled || !configEnabled) {
    return null
  }

  const handlePurchaseComplete = async () => {
    // Refresh credits after purchase
    try {
      await plugin?.call('auth', 'refreshCredits')
    } catch (err) {
      console.error('[BillingSection] Failed to refresh credits:', err)
    }
  }

  return (
    <div className="billing-section">
      <BillingManager
        plugin={plugin}
        paddleClientToken={paddleConfig?.clientToken || undefined}
        paddleEnvironment={paddleConfig?.environment || 'sandbox'}
        onPurchaseComplete={handlePurchaseComplete}
      />
    </div>
  )
}
