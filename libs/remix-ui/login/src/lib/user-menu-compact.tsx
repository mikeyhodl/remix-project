import React, { useState } from 'react'
import { AuthUser } from '@remix-api'
import type { Credits } from '../../../app/src/lib/remix-app/context/auth-context'

interface UserMenuCompactProps {
  user: AuthUser
  credits: Credits | null
  showCredits: boolean
  className?: string
  onLogout: () => void
  getProviderDisplayName: (provider: string) => string
  getUserDisplayName: () => string
}

export const UserMenuCompact: React.FC<UserMenuCompactProps> = ({
  user,
  credits,
  showCredits,
  className,
  onLogout,
  getProviderDisplayName,
  getUserDisplayName
}) => {
  const [showDropdown, setShowDropdown] = useState(false)

  return (
    <div className={`position-relative ${className}`}>
      <button
        className="btn btn-sm btn-success d-flex flex-nowrap align-items-center"
        onClick={() => setShowDropdown(!showDropdown)}
        data-id="user-menu-compact"
        title={getUserDisplayName()}
      >
        <span>{getUserDisplayName()}</span>
        {user.picture && (
          <img 
            src={user.picture} 
            alt="Avatar" 
            className="ms-1" 
            style={{
              width: '25px',
              height: '25px',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        )}
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
              {user.picture && (
                <div className="d-flex justify-content-center mb-2">
                  <img 
                    src={user.picture} 
                    alt="Avatar" 
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                  />
                </div>
              )}
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
              onClick={onLogout}
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
