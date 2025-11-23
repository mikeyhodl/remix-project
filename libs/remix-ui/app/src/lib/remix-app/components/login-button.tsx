import React, { useState } from 'react'
import { useAuth } from '../context/auth-context'
import { LoginModal } from './modals/login-modal'

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
  const [showDropdown, setShowDropdown] = useState(false)

  const handleLogout = async () => {
    setShowDropdown(false)
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

  // Badge variant - compact display
  if (variant === 'badge') {
    return (
      <div className={`d-flex align-items-center ${className}`}>
        <div className="dropdown">
          <button
            className="btn btn-sm btn-success dropdown-toggle"
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            data-id="user-badge"
          >
            ✓ {getUserDisplayName()}
            {showCredits && credits && (
              <span className="badge bg-light text-dark ms-2">
                {credits.balance} credits
              </span>
            )}
          </button>
          {showDropdown && (
            <div
              className="dropdown-menu dropdown-menu-end show"
              style={{ position: 'absolute', right: 0, top: '100%' }}
            >
              <div className="dropdown-header">
                <div><strong>{getUserDisplayName()}</strong></div>
                <div className="text-muted small">{getProviderDisplayName(user.provider)}</div>
              </div>
              {credits && (
                <>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-item-text small">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Total Credits:</span>
                      <strong>{credits.balance}</strong>
                    </div>
                    <div className="d-flex justify-content-between text-muted">
                      <span>Free:</span>
                      <span>{credits.free_credits}</span>
                    </div>
                    <div className="d-flex justify-content-between text-muted">
                      <span>Paid:</span>
                      <span>{credits.paid_credits}</span>
                    </div>
                  </div>
                </>
              )}
              <div className="dropdown-divider"></div>
              <button
                className="dropdown-item text-danger"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
        {/* Backdrop to close dropdown */}
        {showDropdown && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1
            }}
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>
    )
  }

  // Compact variant - icon only with dropdown
  if (variant === 'compact') {
    return (
      <div className={`position-relative ${className}`}>
        <button
          className="btn btn-sm btn-success"
          onClick={() => setShowDropdown(!showDropdown)}
          data-id="user-menu-compact"
          title={getUserDisplayName()}
        >
          {getUserDisplayName()}
        </button>
        {showDropdown && (
          <>
            <div
              className="dropdown-menu dropdown-menu-end show"
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                minWidth: '200px',
                zIndex: 2000
              }}
            >
              <div className="dropdown-header">
                <div><strong>{getUserDisplayName()}</strong></div>
                <div className="text-muted small">{getProviderDisplayName(user.provider)}</div>
              </div>
              {credits && showCredits && (
                <>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-item-text small">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Credits:</span>
                      <strong>{credits.balance}</strong>
                    </div>
                  </div>
                </>
              )}
              <div className="dropdown-divider"></div>
              <button
                className="dropdown-item text-danger"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1999
              }}
              onClick={() => setShowDropdown(false)}
            />
          </>
        )}
      </div>
    )
  }

  // Full button variant - default
  return (
    <div className={`d-flex align-items-center gap-2 ${className}`}>
      {credits && showCredits && (
        <div className="badge bg-primary">
          {credits.balance} credits
        </div>
      )}
      <div className="dropdown">
        <button
          className="btn btn-sm btn-success dropdown-toggle"
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          data-id="user-menu-button"
        >
          👤 {getUserDisplayName()}
        </button>
        {showDropdown && (
          <>
            <div
              className="dropdown-menu dropdown-menu-end show"
              style={{ position: 'absolute', right: 0, top: '100%' }}
            >
              <div className="dropdown-header">
                <div><strong>{getUserDisplayName()}</strong></div>
                <div className="text-muted small">{getProviderDisplayName(user.provider)}</div>
                {user.email && <div className="text-muted small">{user.email}</div>}
                {user.address && <div className="text-muted small font-monospace">{formatAddress(user.address)}</div>}
              </div>
              {credits && (
                <>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-item-text small">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Total Credits:</span>
                      <strong>{credits.balance}</strong>
                    </div>
                    <div className="d-flex justify-content-between text-muted">
                      <span>Free:</span>
                      <span>{credits.free_credits}</span>
                    </div>
                    <div className="d-flex justify-content-between text-muted">
                      <span>Paid:</span>
                      <span>{credits.paid_credits}</span>
                    </div>
                  </div>
                </>
              )}
              <div className="dropdown-divider"></div>
              <button
                className="dropdown-item text-danger"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1
              }}
              onClick={() => setShowDropdown(false)}
            />
          </>
        )}
      </div>
    </div>
  )
}
