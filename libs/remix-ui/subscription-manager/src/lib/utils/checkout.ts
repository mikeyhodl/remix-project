// Popup flow removed — we only support overlay and inline.

import type { Paddle } from '@paddle/paddle-js'

/**
 * Open Paddle checkout as an overlay (no popup window).
 * Requires an already initialized Paddle instance.
 */
export const openCheckoutOverlay = (
  paddle: Paddle,
  priceId: string,
  options?: {
    customerEmail?: string
    customData?: Record<string, any>
    onSuccess?: () => void
    onClose?: () => void
  }
) => {
  console.log('🔵 openCheckoutOverlay: priceId:', priceId)

  try {
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: options?.customerEmail ? { email: options.customerEmail } : undefined,
      customData: options?.customData,
      settings: {
        displayMode: 'overlay',
        theme: 'dark',
        locale: 'en'
      }
    })
    console.log('✅ Overlay checkout opened')
  } catch (err) {
    console.error('❌ Failed to open overlay checkout:', err)
  }
}
