import React from 'react'
import { InlineCheckout } from './InlineCheckout'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  priceId: string
  customerEmail?: string
  customData?: Record<string, any>
  onSuccess?: () => void
  clientToken: string
  environment?: 'sandbox' | 'production'
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  priceId,
  customerEmail,
  customData,
  onSuccess,
  clientToken,
  environment = 'sandbox'
}) => {
  if (!isOpen) return null

  const handleSuccess = () => {
    onSuccess?.()
    onClose()
  }

  return (
    <div 
      className="modal fade show" 
      style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div 
        className="modal-dialog modal-lg modal-dialog-centered"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-crown me-2" style={{ color: '#FDB022' }}></i>
              Subscribe to Remix Pro
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">
            <InlineCheckout
              priceId={priceId}
              customerEmail={customerEmail}
              customData={customData}
              onSuccess={handleSuccess}
              onClose={onClose}
              clientToken={clientToken}
              environment={environment}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
