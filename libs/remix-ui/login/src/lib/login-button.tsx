import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../app/src/lib/remix-app/context/auth-context'
import { LoginModal } from './modals/login-modal'
import { UserBadge } from './user-badge'
import { UserMenuCompact } from './user-menu-compact'
import { UserMenuFull } from './user-menu-full'
import { AuthProviderType } from '@remix-ui/app'

interface LoginButtonProps {
  className?: string
  showCredits?: boolean
  variant?: 'button' | 'badge' | 'compact'
}

export const LoginButton: React.FC<LoginButtonProps> = ({
  className = '',
  showCredits = true,
  variant = 'button'
}) => {
  const { isAuthenticated, user, credits, logout, login } = useAuth()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    // Listen for account linking requests from settings
    const handleLinkProvider = (e: CustomEvent) => {
      const provider = e.detail?.provider as AuthProviderType
      if (provider) {
        handleLinkProviderAction(provider)
      }
    }
    
    window.addEventListener('link-provider', handleLinkProvider as EventListener)
    
    return () => {
      window.removeEventListener('link-provider', handleLinkProvider as EventListener)
    }
  }, [])

  const handleLogout = async () => {
    await logout()
  }
  
  const handleLinkProviderAction = async (provider: AuthProviderType) => {
    // Login with the provider - auto-linking will happen on backend if emails match
    await login(provider)
    
    // Notify that account was linked
    window.dispatchEvent(new Event('account-linked'))
  }
  
  const handleLinkProvider = async (provider: AuthProviderType) => {
    await handleLinkProviderAction(provider)
  }
  
  const handleManageAccounts = () => {
    // Open Settings panel - Account & Authentication tab
    const event = new CustomEvent('open-settings', { 
      detail: { tab: 'account-authentication' } 
    })
    window.dispatchEvent(event)
  }

  const formatAddress = (address: string) => {
    if (!address) return ''
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  const getProviderDisplayName = (provider: string) => {
    const providerNames: Record<string, string> = {
      'google': 'Google',
      'apple': 'Apple',
      'discord': 'Discord',
      'coinbase': 'Coinbase Wallet',
      'siwe': 'Ethereum'
    }
    return providerNames[provider] || provider
  }

  const getUserDisplayName = () => {
    if (!user) return 'Unknown'
    if (user.name) return user.name
    if (user.email) return user.email
    if (user.address) return formatAddress(user.address)
    return user.sub
  }

  if (!isAuthenticated) {
    return (
      <>
        <button
          className={`btn btn-sm btn-primary ${className}`}
          onClick={() => setShowModal(true)}
          data-id="login-button"
        >
          Log In
        </button>
        {showModal && <LoginModal onClose={() => setShowModal(false)} />}
      </>
    )
  }

  if (variant === 'badge') {
    return (
      <UserBadge
        user={user}
        credits={credits}
        showCredits={showCredits}
        className={className}
        onLogout={handleLogout}
        formatAddress={formatAddress}
        getProviderDisplayName={getProviderDisplayName}
        getUserDisplayName={getUserDisplayName}
      />
    )
  }

  if (variant === 'compact') {
    return (
      <UserMenuCompact
        user={user}
        credits={credits}
        showCredits={showCredits}
        className={className}
        onLogout={handleLogout}
        onLinkProvider={handleLinkProvider}
        onManageAccounts={handleManageAccounts}
        getProviderDisplayName={getProviderDisplayName}
        getUserDisplayName={getUserDisplayName}
      />
    )
  }

  return (
    <UserMenuFull
      user={user}
      credits={credits}
      showCredits={showCredits}
      className={className}
      onLogout={handleLogout}
      formatAddress={formatAddress}
      getProviderDisplayName={getProviderDisplayName}
      getUserDisplayName={getUserDisplayName}
    />
  )
}
