import React from 'react'
import { Paddle } from '@paddle/paddle-js'
import { PaddleInlineCheckout } from './PaddleInlineCheckout'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  priceId: string
  paddle: Paddle | null
  customerEmail?: string
  customData?: Record<string, any>
  onSuccess?: () => void
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  priceId,
  paddle,
  customerEmail,
  customData,
  onSuccess
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
            {paddle ? (
              <PaddleInlineCheckout
                paddle={paddle}
                priceId={priceId}
                customerEmail={customerEmail}
                customData={customData}
                onSuccess={handleSuccess}
                onClose={onClose}
              />
            ) : (
              <div className="alert alert-warning">
                <i className="fas fa-exclamation-triangle me-2"></i>
                Paddle is not initialized. Please wait or refresh the page.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
