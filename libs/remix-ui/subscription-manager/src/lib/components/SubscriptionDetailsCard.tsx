import React from 'react'
import { SubscriptionDetails } from '../types'
import { SubscriptionCard } from './SubscriptionCard'

interface SubscriptionDetailsCardProps {
  subscription: SubscriptionDetails
  statusColor: string
}

export const SubscriptionDetailsCard: React.FC<SubscriptionDetailsCardProps> = ({
  subscription,
  statusColor
}) => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  return (
    <div className="card mb-4">
      <div className="card-body">
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="text-muted small">Status</label>
            <div>
              <span className={`badge bg-${statusColor}`}>
                {subscription.status.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="col-md-6">
            <label className="text-muted small">Subscription ID</label>
            <div className="font-monospace small">
              {subscription.id}
            </div>
          </div>
        </div>

        {subscription.items && subscription.items.length > 0 && (
          <div className="mb-3">
            <label className="text-muted small">Current Plan</label>
            {subscription.items.map((item, idx) => (
              <SubscriptionCard key={idx} item={item} />
            ))}
          </div>
        )}

        <div className="row mb-3">
          <div className="col-md-6">
            <label className="text-muted small">Billing Period Start</label>
            <div>
              {subscription.currentBillingPeriod.startsAt && 
                formatDate(subscription.currentBillingPeriod.startsAt)}
            </div>
          </div>
          <div className="col-md-6">
            <label className="text-muted small">Billing Period End</label>
            <div>
              {subscription.currentBillingPeriod.endsAt && 
                formatDate(subscription.currentBillingPeriod.endsAt)}
            </div>
          </div>
        </div>

        {subscription.nextBilledAt && (
          <div className="row mb-3">
            <div className="col-md-6">
              <label className="text-muted small">Next Billing Date</label>
              <div className="fw-bold">
                {formatDate(subscription.nextBilledAt)}
              </div>
            </div>
            {subscription.currencyCode && (
              <div className="col-md-6">
                <label className="text-muted small">Currency</label>
                <div>
                  {subscription.currencyCode}
                </div>
              </div>
            )}
          </div>
        )}

        {subscription.scheduledChange && (
          <div className="alert alert-info mb-3">
            <i className="fas fa-info-circle me-2"></i>
            <strong>Scheduled Change:</strong> {subscription.scheduledChange.action} on{' '}
            {formatDate(subscription.scheduledChange.effectiveAt)}
          </div>
        )}

        {subscription.discount && (
          <div className="alert alert-success mb-3">
            <i className="fas fa-tag me-2"></i>
            <strong>Discount Applied</strong>
          </div>
        )}

        <div className="row">
          <div className="col-md-6">
            <label className="text-muted small">Customer ID</label>
            <div className="font-monospace small">
              {subscription.customerId}
            </div>
          </div>
          {subscription.createdAt && (
            <div className="col-md-6">
              <label className="text-muted small">Subscription Started</label>
              <div className="small">
                {formatDate(subscription.createdAt)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
