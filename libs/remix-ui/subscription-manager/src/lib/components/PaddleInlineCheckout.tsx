import React, { useEffect, useRef, useState } from 'react'
import { Paddle } from '@paddle/paddle-js'

interface PaddleInlineCheckoutProps {
  paddle: Paddle
  priceId: string
  customerEmail?: string
  customData?: Record<string, any>
  onSuccess?: () => void
  onClose?: () => void
}

/**
 * Inline checkout component that uses an already-initialized Paddle instance
 * This avoids multiple Paddle.Initialize() calls
 */
export const PaddleInlineCheckout: React.FC<PaddleInlineCheckoutProps> = ({
  paddle,
  priceId,
  customerEmail,
  customData,
  onSuccess,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const checkoutOpenedRef = useRef(false)

  useEffect(() => {
    if (!paddle || !containerRef.current || !priceId || checkoutOpenedRef.current) {
      return
    }

    console.log('🚀 Opening inline checkout for price:', priceId)
    checkoutOpenedRef.current = true

    try {
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: customerEmail ? { email: customerEmail } : undefined,
        customData,
        settings: {
          displayMode: 'inline',
          frameTarget: containerRef.current.id,
          frameInitialHeight: 450,
          frameStyle: 'width: 100%; min-width: 312px; background-color: transparent; border: none;'
        }
      })

      console.log('✅ Inline checkout opened')
    } catch (err) {
      console.error('❌ Failed to open checkout:', err)
      setError('Failed to open checkout. Please try again.')
      checkoutOpenedRef.current = false
    }

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up inline checkout')
      checkoutOpenedRef.current = false
    }
  }, [paddle, priceId, customerEmail, customData])

  // Listen for checkout events via the global Paddle instance
  useEffect(() => {
    if (!paddle) return

    const handleEvent = (event: any) => {
      if (event.name === 'checkout.completed') {
        console.log('✅ Checkout completed in inline mode')
        onSuccess?.()
      } else if (event.name === 'checkout.closed') {
        console.log('🚪 Checkout closed in inline mode')
        onClose?.()
      }
    }

    // Note: Paddle events are already handled globally via eventCallback
    // This is just for component-specific logic
    
    return () => {
      // Cleanup if needed
    }
  }, [paddle, onSuccess, onClose])

  if (error) {
    return (
      <div className="alert alert-danger">
        <i className="fas fa-exclamation-circle me-2"></i>
        {error}
      </div>
    )
  }

  return (
    <div 
      id="paddle-inline-checkout-container" 
      ref={containerRef}
      className="paddle-checkout-container"
      style={{ minHeight: '450px' }}
    />
  )
}
