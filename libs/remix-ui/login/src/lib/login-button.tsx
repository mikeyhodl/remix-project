import React, { useState } from 'react'
import { useAuth } from '../../../app/src/lib/remix-app/context/auth-context'
import { LoginModal } from './modals/login-modal'
import { UserBadge } from './user-badge'
import { UserMenuCompact } from './user-menu-compact'
import { UserMenuFull } from './user-menu-full'

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
  const { isAuthenticated, user, credits, logout } = useAuth()
  const [showModal, setShowModal] = useState(false)

  const handleLogout = async () => {
    await logout()
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
          {variant === 'compact' ? '🔐 Login' : '🔐 Sign In'}
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
