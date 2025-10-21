import React from 'react'
import { SubscriptionCard } from './SubscriptionCard'
import { SubscriptionDetails } from '../types'

interface ActiveSubscriptionViewProps {
  subscription: SubscriptionDetails
  onManage: () => void
}

export const ActiveSubscriptionView: React.FC<ActiveSubscriptionViewProps> = ({
  subscription,
  onManage
}) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div>
      <div className="alert alert-success d-flex align-items-center mb-4">
        <i className="fas fa-check-circle fa-2x me-3"></i>
        <div>
          <h5 className="mb-0">Active Subscription</h5>
          <small className="text-muted">Status: {subscription.status}</small>
        </div>
      </div>

      <h5 className="mb-3">Current Plan</h5>
      {subscription.items && subscription.items.map((item, index) => (
        <SubscriptionCard key={index} item={item} />
      ))}

      {subscription.scheduledChange && (
        <div className="alert alert-info">
          <i className="fas fa-info-circle me-2"></i>
          <strong>Scheduled Change:</strong> {subscription.scheduledChange.action} on{' '}
          {formatDate(subscription.scheduledChange.effectiveAt)}
        </div>
      )}

      {subscription.currentBillingPeriod && (
        <div className="card mb-3">
          <div className="card-body">
            <p className="mb-1">
              <strong>Next billing date:</strong>{' '}
              {formatDate(subscription.currentBillingPeriod.endsAt)}
            </p>
          </div>
        </div>
      )}

      <button className="btn btn-outline-primary w-100" onClick={onManage}>
        <i className="fas fa-cog me-2"></i>
        Manage Subscription
      </button>
    </div>
  )
}
