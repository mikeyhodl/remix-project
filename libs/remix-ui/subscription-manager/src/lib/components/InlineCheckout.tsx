import React, { useEffect, useRef, useState } from 'react'
import { initializePaddle, Paddle } from '@paddle/paddle-js'

interface InlineCheckoutProps {
  priceId: string
  customerEmail?: string
  customData?: Record<string, any>
  onSuccess?: () => void
  onClose?: () => void
  clientToken: string
  environment?: 'sandbox' | 'production'
}

export const InlineCheckout: React.FC<InlineCheckoutProps> = ({
  priceId,
  customerEmail,
  customData,
  onSuccess,
  onClose,
  clientToken,
  environment = 'sandbox'
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [paddle, setPaddle] = useState<Paddle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initPaddle = async () => {
      try {
        console.log('🎯 Initializing Paddle for inline checkout...')
        const paddleInstance = await initializePaddle({
          environment,
          token: clientToken,
          eventCallback: (event) => {
            console.log('🔔 Paddle event:', event.name, event.data)
            
            if (event.name === 'checkout.completed') {
              console.log('✅ Checkout completed!')
              onSuccess?.()
            } else if (event.name === 'checkout.closed') {
              console.log('🚪 Checkout closed')
              onClose?.()
            }
          }
        })

        if (paddleInstance) {
          setPaddle(paddleInstance)
          console.log('✅ Paddle initialized')
        }
      } catch (err) {
        console.error('❌ Failed to initialize Paddle:', err)
        setError('Failed to load checkout. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    initPaddle()
  }, [clientToken, environment, onSuccess, onClose])

  useEffect(() => {
    if (paddle && containerRef.current && priceId) {
      console.log('🚀 Opening inline checkout for price:', priceId)
      
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
      } catch (err) {
        console.error('❌ Failed to open checkout:', err)
        setError('Failed to open checkout. Please try again.')
      }
    }
  }, [paddle, priceId, customerEmail, customData])

  if (loading) {
    return (
      <div className="text-center py-5">
        <i className="fas fa-spinner fa-spin fa-2x mb-3"></i>
        <p>Loading checkout...</p>
      </div>
    )
  }

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
      id="paddle-inline-checkout" 
      ref={containerRef}
      className="paddle-checkout-container"
    />
  )
}
