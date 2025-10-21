import React from 'react'
import {
  ActiveSubscriptionView,
  CurrentPlanBadge,
  NoSubscriptionView,
  PricingCard,
  SubscriptionCard,
  SubscriptionDetailsCard
} from './components'
import { SubscriptionDetails } from './types'

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
    console.log('🔵 SubscriptionManagerUI: handleUpgrade called with priceId:', priceId)
    console.log('🔵 SubscriptionManagerUI: ghId:', ghId)
    
    // Store GitHub user data in localStorage for the popup
    // localStorage is shared across same-origin windows, so the popup can read it
    if (ghId) {
      window.localStorage.setItem('gh_id', ghId)
      console.log('✅ SubscriptionManagerUI: Stored gh_id in localStorage:', ghId)
    } else {
      console.warn('⚠️ SubscriptionManagerUI: No ghId available!')
    }
    
    const w = 900, h = 900
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
    
    console.log('🔵 SubscriptionManagerUI: Opening popup with URL:', url)
    console.log('🔵 SubscriptionManagerUI: Popup features:', features)
    
    const popup = window.open(url, 'remix-pro-subscribe', features)
    
    if (popup) {
      console.log('✅ SubscriptionManagerUI: Popup window opened successfully')
      
      // Check if popup was closed and refresh subscription
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          console.log('🔵 SubscriptionManagerUI: Popup closed, refreshing subscription...')
          clearInterval(checkClosed)
          // Refresh subscription after popup closes
          if (ghId && onRefresh) {
            setTimeout(() => {
              console.log('🔵 SubscriptionManagerUI: Calling onRefresh callback')
              onRefresh()
            }, 1000) // Wait 1 second for Paddle to process
          }else{
            console.warn('⚠️ SubscriptionManagerUI: Cannot refresh subscription, ghId or onRefresh not available')
          }
        }
      }, 1000)
    } else {
      console.error('❌ SubscriptionManagerUI: Failed to open popup (might be blocked)')
    }
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
                    const features = plan.product?.description ? [plan.product.description] : []
                    
                    if (plan.trialPeriod) {
                      features.push(`${plan.trialPeriod.frequency} ${plan.trialPeriod.interval} free trial`)
                    }
                    
                    return (
                      <div key={plan.id} className="col-md-6">
                        <PricingCard
                          title={plan.product?.name || plan.description}
                          price={new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: currency
                          }).format(price)}
                          period={`per ${plan.billingCycle?.interval || 'month'}`}
                          features={features}
                          highlighted={isYearly}
                          onSelect={() => {}} // No-op when disabled
                          buttonText="Log in to Subscribe"
                          disabled={true}
                          imageUrl={plan.product?.imageUrl}
                        />
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
        <NoSubscriptionView onUpgrade={() => handleUpgrade()} />

        {loadingPlans ? (
          <div className="text-center mt-4">
            <i className="fas fa-spinner fa-spin"></i>
            <p className="text-muted mt-2">Loading plans...</p>
          </div>
        ) : availablePlans.length > 0 && (
          <div className="row g-4 mt-3" style={{ maxWidth: '900px', margin: '0 auto' }}>
            {availablePlans.map((plan) => {
              const price = plan.unitPrice ? parseFloat(plan.unitPrice.amount) / 100 : 0
              const currency = plan.unitPrice?.currencyCode || 'USD'
              const isYearly = plan.billingCycle?.interval === 'year'
              
              return (
                <div key={plan.id} className="col-md-6">
                  <PricingCard
                    title={plan.product?.name || plan.description}
                    price={new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: currency
                    }).format(price)}
                    period={`per ${plan.billingCycle?.interval || 'month'}`}
                    features={plan.product?.description ? [plan.product.description] : []}
                    highlighted={isYearly}
                    onSelect={() => handleUpgrade(plan.id)}
                    buttonText={`Subscribe ${isYearly ? 'Yearly' : 'Monthly'}`}
                    badge={isYearly ? 'Best Value' : undefined}
                  />
                </div>
              )
            })}
          </div>
        )}
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

        <SubscriptionDetailsCard 
          subscription={subscription}
          statusColor={statusColor}
        />

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
                const isYearly = plan.billingCycle?.interval === 'year'
                const features = plan.product?.description ? [plan.product.description] : []
                
                if (plan.trialPeriod) {
                  features.push(`${plan.trialPeriod.frequency} ${plan.trialPeriod.interval} free trial`)
                }
                
                return (
                  <div key={plan.id} className="col-md-6">
                    {isCurrentPlan ? (
                      <CurrentPlanBadge
                        planName={plan.product?.name || plan.description}
                        price={new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: currency
                        }).format(price)}
                        interval={plan.billingCycle?.interval || 'month'}
                        imageUrl={plan.product?.imageUrl}
                      />
                    ) : (
                      <PricingCard
                        title={plan.product?.name || plan.description}
                        price={new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: currency
                        }).format(price)}
                        period={`per ${plan.billingCycle?.interval || 'month'}`}
                        features={features}
                        highlighted={false}
                        onSelect={() => handleUpgrade(plan.id)}
                        buttonText="Switch to this plan"
                      />
                    )}
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
