import React, { useState } from 'react'
import {
  CheckoutModal,
  CheckoutModeSelector,
  CheckoutMode,
  CurrentPlanBadge,
  NoSubscriptionView,
  PricingCard,
  SubscriptionDetailsCard
} from './components'
import { SubscriptionDetails } from './types'
import { openCheckoutPopup } from './utils/checkout'

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
  paddleClientToken?: string
  paddleEnvironment?: 'sandbox' | 'production'
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
  onCancel,
  paddleClientToken,
  paddleEnvironment = 'sandbox'
}) => {
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>('popup')
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [selectedPriceId, setSelectedPriceId] = useState<string | undefined>()

  const handleUpgrade = (priceId?: string) => {
    if (checkoutMode === 'popup' || !paddleClientToken) {
      openCheckoutPopup(priceId, ghId, onRefresh)
    } else {
      setSelectedPriceId(priceId)
      setShowCheckoutModal(true)
    }
  }

  const handleCheckoutSuccess = () => {
    console.log('✅ Checkout completed, refreshing subscription...')
    setShowCheckoutModal(false)
    setTimeout(() => onRefresh(), 1000)
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
      <>
        <div className="p-4">
          <NoSubscriptionView onUpgrade={() => handleUpgrade()} />

          {paddleClientToken && (
            <div className="text-center mb-3">
              <CheckoutModeSelector mode={checkoutMode} onModeChange={setCheckoutMode} />
            </div>
          )}

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

        {paddleClientToken && selectedPriceId && (
          <CheckoutModal
            isOpen={showCheckoutModal}
            onClose={() => setShowCheckoutModal(false)}
            priceId={selectedPriceId}
            customData={{ ghId }}
            onSuccess={handleCheckoutSuccess}
            clientToken={paddleClientToken}
            environment={paddleEnvironment}
          />
        )}
      </>
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
