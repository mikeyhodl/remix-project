import React from 'react'
import { AuthProvider } from '@remix-api'
import { useAuth } from '../../../../app/src/lib/remix-app/context/auth-context'

interface LoginModalProps {
  onClose: () => void
}

export const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => {
  const { login, loading, error } = useAuth()

  const handleLogin = async (provider: AuthProvider) => {
    try {
      await login(provider)
      // Modal will auto-close via auth state change
    } catch (err) {
      // Error is handled by context
      console.error('[LoginModal] Login failed:', err)
    }
  }

  const providers: Array<{ id: AuthProvider; label: string; icon: JSX.Element; description: string }> = [
    {
      id: 'google',
      label: 'Google',
      icon: <i className="fab fa-google" style={{ color: '#DB4437' }}></i>,
      description: 'Sign in with your Google account'
    },
    {
      id: 'discord',
      label: 'Discord',
      icon: <i className="fab fa-discord" style={{ color: '#5865F2' }}></i>,
      description: 'Sign in with your Discord account'
    },
    {
      id: 'siwe',
      label: 'Ethereum Wallet',
      icon: <i className="fab fa-ethereum" style={{ color: '#627EEA' }}></i>,
      description: 'Sign in with MetaMask, Coinbase Wallet, or any Ethereum wallet'
    },
    {
      id: 'apple',
      label: 'Apple',
      icon: <i className="fab fa-apple"></i>,
      description: 'Sign in with your Apple ID'
    },
    {
      id: 'coinbase',
      label: 'Coinbase',
      icon: <i className="fas fa-coins" style={{ color: '#0052FF' }}></i>,
      description: 'Sign in with your Coinbase account (OAuth currently disabled)'
    }
  ]

  return (
    <div
      className="modal d-flex"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2000,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        role="document"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px', width: '90%' }}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Sign In to Remix IDE</h5>
            <button
              type="button"
              className="close"
              onClick={onClose}
              aria-label="Close"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div className="modal-body">
            <p className="text-muted mb-4">
              Choose your preferred authentication method to access Remix features and manage your credits.
            </p>

            {error && (
              <div className="alert alert-danger" role="alert">
                <strong>Error:</strong> {error}
              </div>
            )}

            <div className="list-group">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  className="list-group-item list-group-item-action d-flex align-items-center py-3"
                  onClick={() => handleLogin(provider.id)}
                  disabled={loading || (provider.id === 'coinbase')}
                  style={{
                    cursor: loading || provider.id === 'coinbase' ? 'not-allowed' : 'pointer',
                    opacity: loading || provider.id === 'coinbase' ? 0.6 : 1
                  }}
                >
                  <span className="me-3" style={{ fontSize: '1.5rem', width: '32px', textAlign: 'center' }}>
                    {provider.icon}
                  </span>
                  <div className="flex-grow-1 text-start">
                    <div className="fw-bold">{provider.label}</div>
                    <small className="text-muted">{provider.description}</small>
                  </div>
                  {loading && (
                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-4 text-center">
              <small className="text-muted">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
