import React from 'react'

interface SubscriptionItem {
  priceId: string
  productId: string
  description: string
  quantity: number
  unitPrice: {
    amount: string
    currencyCode: string
  }
  billingCycle: {
    interval: string
    frequency: number
  }
}

interface SubscriptionDetails {
  id: string
  status: string
  customerId: string
  currentBillingPeriod: {
    startsAt: string
    endsAt: string
  }
  items?: SubscriptionItem[]
  nextBilledAt?: string
  scheduledChange?: {
    action: string
    effectiveAt: string
  }
  createdAt?: string
  updatedAt?: string
  firstBilledAt?: string
  discount?: any
  currencyCode?: string
  billingDetails?: {
    enableCheckout: boolean
    purchaseOrderNumber?: string
    paymentTerms?: {
      interval: string
      frequency: number
    }
  }
}

export interface SubscriptionManagerProps {
  loading: boolean
  error: string | null
  subscription: SubscriptionDetails | null
  hasActiveSubscription: boolean
  ghId: string | null
  availablePlans: any[]
  loadingPlans: boolean
  onRefresh: () => void
  onManage: () => void
  onCancel: () => void
}

export const SubscriptionManagerUI: React.FC<SubscriptionManagerProps> = ({ 
  loading, 
  error, 
  subscription, 
  hasActiveSubscription,
  ghId,
  availablePlans,
  loadingPlans,
  onRefresh,
  onManage,
  onCancel
}) => {

  const handleUpgrade = (priceId?: string) => {
    const w = 720, h = 760
    const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : (window as any).screenX
    const dualScreenTop = window.screenTop !== undefined ? window.screenTop : (window as any).screenY
    const width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth
    const height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight
    const systemZoom = width / window.screen.availWidth
    const left = (width - w) / 2 / systemZoom + dualScreenLeft
    const top = (height - h) / 2 / systemZoom + dualScreenTop
    const features = `scrollbars=yes, width=${w / systemZoom}, height=${h / systemZoom}, top=${top}, left=${left}`
    const url = priceId 
      ? `${window.location.origin}/#source=subscription-checkout&priceId=${priceId}`
      : `${window.location.origin}/#source=subscription-checkout`
    window.open(url, 'remix-pro-subscribe', features)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const formatPrice = (amount: string, currencyCode: string) => {
    // Paddle stores prices in smallest currency unit (cents for USD)
    const num = parseFloat(amount) / 100
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD'
    }).format(num)
  }

  const formatBillingCycle = (billingCycle: { interval: string, frequency: number }) => {
    if (!billingCycle) return ''
    const { interval, frequency } = billingCycle
    if (frequency === 1) {
      return interval === 'month' ? 'Monthly' : interval === 'year' ? 'Yearly' : `Per ${interval}`
    }
    return `Every ${frequency} ${interval}s`
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
          <div className="text-center">
            <i className="fas fa-spinner fa-spin fa-2x mb-3"></i>
            <p>Loading subscription details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="alert alert-warning">
          <i className="fas fa-exclamation-triangle me-2"></i>
          {error}
        </div>
        {!ghId && (
          <>
            <div className="text-center mt-4 mb-4">
              <p className="text-muted">Log in with GitHub to manage your subscription</p>
            </div>

            {/* Show available plans even when not logged in */}
            <div className="text-center" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div className="mb-4">
                <i className="fas fa-crown" style={{ fontSize: '48px', color: '#FDB022' }}></i>
              </div>
              <h4 className="mb-3">Available Subscription Plans</h4>
              
              {loadingPlans ? (
                <div className="text-center">
                  <i className="fas fa-spinner fa-spin"></i>
                  <p className="text-muted mt-2">Loading plans...</p>
                </div>
              ) : availablePlans.length > 0 ? (
                <div className="row g-4 mb-4">
                  {availablePlans.map((plan) => {
                    const isYearly = plan.billingCycle?.interval === 'year'
                    const price = plan.unitPrice ? parseFloat(plan.unitPrice.amount) / 100 : 0
                    const currency = plan.unitPrice?.currencyCode || 'USD'
                    
                    return (
                      <div key={plan.id} className="col-md-6">
                        <div className="card h-100">
                          <div className="card-body text-center">
                            <h5 className="card-title mb-3">
                              {plan.description || 'Pro Plan'}
                            </h5>
                            <div className="mb-3">
                              <span className="h2 fw-bold">
                                {new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: currency
                                }).format(price)}
                              </span>
                              <span className="text-muted">
                                /{plan.billingCycle?.interval || 'month'}
                              </span>
                            </div>
                            {plan.trialPeriod && (
                              <div className="mb-3">
                                <span className="badge bg-info">
                                  {plan.trialPeriod.frequency} {plan.trialPeriod.interval} free trial
                                </span>
                              </div>
                            )}
                            <button 
                              className={`btn ${isYearly ? 'btn-primary' : 'btn-warning'} w-100`}
                              disabled
                              title="Please log in with GitHub first"
                            >
                              <i className="fas fa-lock me-2"></i>
                              Log in to Subscribe
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    )
  }

  if (!hasActiveSubscription) {
    return (
      <div className="p-4">
        <div className="text-center" style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '40px' }}>
          <div className="mb-4">
            <i className="fas fa-crown" style={{ fontSize: '64px', color: '#FDB022' }}></i>
          </div>
          <h3 className="mb-3">Upgrade to Remix Pro</h3>
          <p className="text-muted mb-5">
            Get access to advanced AI features, priority support, and more.
          </p>

          {loadingPlans ? (
            <div className="text-center">
              <i className="fas fa-spinner fa-spin"></i>
              <p className="text-muted mt-2">Loading plans...</p>
            </div>
          ) : availablePlans.length > 0 ? (
            <div className="row g-4 mb-4">
              {availablePlans.map((plan) => {
                const isYearly = plan.billingCycle?.interval === 'year'
                const price = plan.unitPrice ? parseFloat(plan.unitPrice.amount) / 100 : 0
                const currency = plan.unitPrice?.currencyCode || 'USD'
                
                return (
                  <div key={plan.id} className="col-md-6">
                    <div className="card h-100">
                      <div className="card-body text-center">
                        <h5 className="card-title mb-3">
                          {plan.description || 'Pro Plan'}
                        </h5>
                        <div className="mb-3">
                          <span className="h2 fw-bold">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: currency
                            }).format(price)}
                          </span>
                          <span className="text-muted">
                            /{plan.billingCycle?.interval || 'month'}
                          </span>
                        </div>
                        {plan.trialPeriod && (
                          <div className="mb-3">
                            <span className="badge bg-info">
                              {plan.trialPeriod.frequency} {plan.trialPeriod.interval} free trial
                            </span>
                          </div>
                        )}
                        <button 
                          className={`btn ${isYearly ? 'btn-primary' : 'btn-warning'} w-100`}
                          onClick={() => handleUpgrade(plan.id)}
                        >
                          <i className="fas fa-crown me-2"></i>
                          Subscribe {isYearly ? 'Yearly' : 'Monthly'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <button 
              className="btn btn-warning btn-lg"
              onClick={() => handleUpgrade()}
            >
              <i className="fas fa-crown me-2"></i>
              Upgrade to Pro
            </button>
          )}
        </div>
      </div>
    )
  }

  const statusColor = subscription?.status === 'active' ? 'success' : 
                       subscription?.status === 'trialing' ? 'info' : 'secondary'

  return (
    <div className="p-4">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="mb-0">
            <i className="fas fa-crown me-2" style={{ color: '#FDB022' }}></i>
            Subscription Details
          </h4>
          <button 
            className="btn btn-sm btn-outline-secondary"
            onClick={onRefresh}
            disabled={loading}
          >
            <i className="fas fa-sync-alt me-1"></i>
            Refresh
          </button>
        </div>

        <div className="card mb-4">
          <div className="card-body">
            <div className="row mb-3">
              <div className="col-md-6">
                <label className="text-muted small">Status</label>
                <div>
                  <span className={`badge bg-${statusColor}`}>
                    {subscription?.status?.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="col-md-6">
                <label className="text-muted small">Subscription ID</label>
                <div className="font-monospace small">
                  {subscription?.id}
                </div>
              </div>
            </div>

            {subscription?.items && subscription.items.length > 0 && (
              <div className="mb-3">
                <label className="text-muted small">Plan Details</label>
                {subscription.items.map((item, idx) => (
                  <div key={idx} className="mb-2 p-3 bg-light rounded">
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
                  </div>
                ))}
              </div>
            )}

            <div className="row mb-3">
              <div className="col-md-6">
                <label className="text-muted small">Billing Period Start</label>
                <div>
                  {subscription?.currentBillingPeriod?.startsAt && 
                    formatDate(subscription.currentBillingPeriod.startsAt)}
                </div>
              </div>
              <div className="col-md-6">
                <label className="text-muted small">Billing Period End</label>
                <div>
                  {subscription?.currentBillingPeriod?.endsAt && 
                    formatDate(subscription.currentBillingPeriod.endsAt)}
                </div>
              </div>
            </div>

            {subscription?.nextBilledAt && (
              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="text-muted small">Next Billing Date</label>
                  <div className="fw-bold">
                    {formatDate(subscription.nextBilledAt)}
                  </div>
                </div>
                {subscription?.currencyCode && (
                  <div className="col-md-6">
                    <label className="text-muted small">Currency</label>
                    <div>
                      {subscription.currencyCode}
                    </div>
                  </div>
                )}
              </div>
            )}

            {subscription?.scheduledChange && (
              <div className="alert alert-info mb-3">
                <i className="fas fa-info-circle me-2"></i>
                <strong>Scheduled Change:</strong> {subscription.scheduledChange.action} on{' '}
                {formatDate(subscription.scheduledChange.effectiveAt)}
              </div>
            )}

            {subscription?.discount && (
              <div className="alert alert-success mb-3">
                <i className="fas fa-tag me-2"></i>
                <strong>Discount Applied</strong>
              </div>
            )}

            <div className="row">
              <div className="col-md-6">
                <label className="text-muted small">Customer ID</label>
                <div className="font-monospace small">
                  {subscription?.customerId}
                </div>
              </div>
              {subscription?.createdAt && (
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

        <div className="d-flex gap-2">
          <button 
            className="btn btn-primary"
            onClick={onManage}
          >
            <i className="fas fa-external-link-alt me-2"></i>
            Manage in Paddle
          </button>
          
          <button 
            className="btn btn-outline-danger"
            onClick={onCancel}
          >
            {false ? (
              <>
                <i className="fas fa-spinner fa-spin me-2"></i>
                Canceling...
              </>
            ) : (
              <>
                <i className="fas fa-times-circle me-2"></i>
                Cancel Subscription
              </>
            )}
          </button>
        </div>

        {/* Other Available Plans */}
        {availablePlans.length > 0 && (
          <div className="mt-5">
            <h5 className="mb-3">
              <i className="fas fa-list me-2"></i>
              Other Available Plans
            </h5>
            <div className="row g-3">
              {availablePlans.map((plan) => {
                const isCurrentPlan = subscription?.items?.some(
                  (item: any) => item.priceId === plan.id
                )
                const price = plan.unitPrice ? parseFloat(plan.unitPrice.amount) / 100 : 0
                const currency = plan.unitPrice?.currencyCode || 'USD'
                
                return (
                  <div key={plan.id} className="col-md-6">
                    <div className={`card h-100 ${isCurrentPlan ? 'border-success' : ''}`}>
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h6 className="card-title mb-0">
                            {plan.description || 'Pro Plan'}
                          </h6>
                          {isCurrentPlan && (
                            <span className="badge bg-success">Current Plan</span>
                          )}
                        </div>
                        <div className="mb-2">
                          <span className="h5 fw-bold">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: currency
                            }).format(price)}
                          </span>
                          <span className="text-muted">
                            /{plan.billingCycle?.interval || 'month'}
                          </span>
                        </div>
                        {plan.trialPeriod && (
                          <div className="mb-2">
                            <span className="badge bg-info">
                              {plan.trialPeriod.frequency} {plan.trialPeriod.interval} trial
                            </span>
                          </div>
                        )}
                        {!isCurrentPlan && (
                          <button 
                            className="btn btn-sm btn-outline-primary w-100"
                            onClick={() => handleUpgrade(plan.id)}
                          >
                            Switch to this plan
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
