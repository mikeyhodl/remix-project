import React from 'react'
import { SubscriptionItem } from '../types'

interface SubscriptionCardProps {
  item: SubscriptionItem
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({ item }) => {
  const formatPrice = (amount: string, currency: string) => {
    const numAmount = parseFloat(amount) / 100 // Paddle amounts are in cents
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numAmount)
  }

  const formatBillingCycle = (billingCycle?: { interval: string; frequency: number }) => {
    if (!billingCycle) return ''
    const { interval, frequency } = billingCycle
    const period = frequency > 1 ? `${frequency} ${interval}s` : interval
    return period
  }

  return (
    <div className="mb-3 p-3 border rounded">
      {item.product ? (
        <div className="d-flex align-items-start mb-3">
          {item.product.imageUrl && (
            <img 
              src={item.product.imageUrl} 
              alt={item.product.name}
              className="me-3"
              style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
            />
          )}
          <div className="flex-grow-1">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="fw-bold fs-5">{item.product.name}</div>
                {item.product.description && (
                  <div className="text-muted small mt-1">
                    {item.product.description}
                  </div>
                )}
              </div>
              {item.unitPrice && (
                <div className="text-end ms-3">
                  <div className="fw-bold fs-5">
                    {formatPrice(item.unitPrice.amount, item.unitPrice.currencyCode)}
                  </div>
                  {item.billingCycle && (
                    <div className="text-muted small">
                      per {formatBillingCycle(item.billingCycle)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <div className="fw-bold">{item.description || 'Subscription Plan'}</div>
            {item.billingCycle && (
              <div className="text-muted small">
                {formatBillingCycle(item.billingCycle)}
              </div>
            )}
          </div>
          {item.unitPrice && (
            <div className="text-end">
              <div className="fw-bold">
                {formatPrice(item.unitPrice.amount, item.unitPrice.currencyCode)}
              </div>
              {item.quantity > 1 && (
                <div className="text-muted small">Qty: {item.quantity}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
