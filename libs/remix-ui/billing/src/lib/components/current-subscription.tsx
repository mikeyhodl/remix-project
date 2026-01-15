import React from 'react'
import { CurrentSubscriptionProps } from '../types'

/**
 * Display user's current subscription status
 */
export const CurrentSubscription: React.FC<CurrentSubscriptionProps> = ({
  subscription,
  loading = false,
  onManage,
  onCancel
}) => {
  if (loading) {
    return (
      <div className="d-flex justify-content-center p-3">
        <div className="spinner-border spinner-border-sm" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="p-3 bg-light rounded">
        <div className="text-muted">
          <i className="fas fa-info-circle me-2"></i>
          No active subscription
        </div>
        <small className="text-muted">
          You're on the free plan. Upgrade to get more credits!
        </small>
      </div>
    )
  }

  const getStatusBadge = () => {
    switch (subscription.status) {
      case 'active':
        return <span className="badge bg-success">Active</span>
      case 'paused':
        return <span className="badge bg-warning">Paused</span>
      case 'canceled':
        return <span className="badge bg-secondary">Canceled</span>
      case 'past_due':
        return <span className="badge bg-danger">Past Due</span>
      default:
        return <span className="badge bg-secondary">{subscription.status}</span>
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="current-subscription p-3 bg-light rounded">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div>
          <h6 className="mb-1">
            Current Subscription {getStatusBadge()}
          </h6>
          <small className="text-muted">Plan: {subscription.planId}</small>
        </div>
        <div className="text-end">
          <div className="h5 mb-0 text-primary">
            <i className="fas fa-coins me-1"></i>
            {subscription.creditsPerMonth.toLocaleString()}
          </div>
          <small className="text-muted">credits/month</small>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-6">
          <small className="text-muted d-block">Current Period</small>
          <small>
            {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
          </small>
        </div>
        {subscription.cancelAtPeriodEnd && (
          <div className="col-6">
            <small className="text-warning d-block">
              <i className="fas fa-exclamation-triangle me-1"></i>
              Cancels at period end
            </small>
          </div>
        )}
      </div>

      <div className="d-flex gap-2">
        {onManage && (
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={onManage}
          >
            <i className="fas fa-cog me-1"></i>
            Manage
          </button>
        )}
        {onCancel && subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
