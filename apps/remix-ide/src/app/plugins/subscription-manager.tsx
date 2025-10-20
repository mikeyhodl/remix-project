import React from 'react'
import { ViewPlugin } from '@remixproject/engine-web'
import { PluginViewWrapper } from '@remix-ui/helper'
import { SubscriptionManagerUI } from '@remix-ui/subscription-manager'
import { endpointUrls } from '@remix-endpoints-helper'

const profile = {
  name: 'subscriptionManager',
  displayName: 'Subscription Manager',
  description: 'Manage your Remix Pro subscription',
  location: 'mainPanel',
  methods: ['showSubscription', 'refresh'],
  events: []
}

interface SubscriptionData {
  loading: boolean
  error: string | null
  subscription: any
  hasActiveSubscription: boolean
  ghId: string | null
  availablePlans: any[]
  loadingPlans: boolean
}

export class SubscriptionManager extends ViewPlugin {
  dispatch: React.Dispatch<any> = () => {}
  private subscriptionData: SubscriptionData = {
    loading: true,
    error: null,
    subscription: null,
    hasActiveSubscription: false,
    ghId: null,
    availablePlans: [],
    loadingPlans: false
  }

  constructor() {
    super(profile)
  }

  async onActivation() {
    console.log('SubscriptionManager plugin activated')
    
    // Listen for subscription status changes from SubscriptionPlugin
    this.on('subscription' as any, 'subscriptionStatusChanged', (status: any) => {
      console.log('SubscriptionManager: subscription status changed', status)
      this.updateSubscriptionData(status)
    })

    // Listen for GitHub logout to update UI immediately
    this.on('dgitApi' as any, 'loggedOut', () => {
      console.log('SubscriptionManager: user logged out, clearing UI')
      this.subscriptionData = {
        loading: false,
        error: 'Please log in with GitHub to view your subscription',
        subscription: null,
        hasActiveSubscription: false,
        ghId: null,
        availablePlans: this.subscriptionData.availablePlans,
        loadingPlans: false
      }
      this.renderComponent()
    })

    // Listen for checkout completion messages from popup window
    const handleMessage = async (event: MessageEvent) => {
      // Verify origin
      if (event.origin !== window.location.origin) return
      
      if (event.data?.type === 'SUBSCRIPTION_COMPLETED') {
        console.log('SubscriptionManager: Received SUBSCRIPTION_COMPLETED message')
        const ghId = event.data.ghId
        if (ghId) {
          console.log('SubscriptionManager: Waiting 2 seconds for Paddle to process...')
          // Wait for Paddle to process the subscription
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          console.log('SubscriptionManager: Refreshing subscription for ghId:', ghId)
          try {
            // Tell SubscriptionPlugin to refresh
            await this.call('subscription' as any, 'checkSubscription', ghId)
            console.log('SubscriptionManager: Subscription refreshed successfully')
          } catch (err) {
            console.error('SubscriptionManager: Failed to refresh subscription:', err)
          }
        }
      }
    }
    
    window.addEventListener('message', handleMessage)
    
    // Store reference for cleanup
    ;(this as any)._messageHandler = handleMessage

    // Initial load - get current status from SubscriptionPlugin
    await this.loadFromSubscriptionPlugin()
    
    // Also load available plans
    await this.loadAvailablePlans()
  }

  async onDeactivation() {
    // Clean up message listener
    if ((this as any)._messageHandler) {
      window.removeEventListener('message', (this as any)._messageHandler)
    }
  }

  /**
   * Load available subscription plans from API
   */
  async loadAvailablePlans() {
    try {
      this.subscriptionData = { ...this.subscriptionData, loadingPlans: true }
      this.renderComponent()

      const response = await fetch(`${endpointUrls.billing}/prices`)
      if (!response.ok) {
        throw new Error('Failed to load plans')
      }

      const data = await response.json()
      this.subscriptionData = {
        ...this.subscriptionData,
        availablePlans: data.prices || [],
        loadingPlans: false
      }
      this.renderComponent()
    } catch (err: any) {
      console.error('SubscriptionManager: error loading plans:', err)
      this.subscriptionData = {
        ...this.subscriptionData,
        availablePlans: [],
        loadingPlans: false
      }
      this.renderComponent()
    }
  }

  /**
   * Load subscription data from SubscriptionPlugin
   */
  async loadFromSubscriptionPlugin() {
    try {
      this.subscriptionData = { ...this.subscriptionData, loading: true, error: null }
      this.renderComponent()

      // Get status from SubscriptionPlugin (it has the data already)
      const status = await this.call('subscription' as any, 'getSubscriptionStatus')
      console.log('SubscriptionManager: got status from plugin', status)

      this.updateSubscriptionData(status)
    } catch (err: any) {
      console.error('SubscriptionManager: error loading from plugin:', err)
      this.subscriptionData = {
        ...this.subscriptionData,
        loading: false,
        error: err.message || 'Failed to load subscription'
      }
      this.renderComponent()
    }
  }

  /**
   * Update local state from SubscriptionPlugin status
   */
  updateSubscriptionData(status: any) {
    if (!status.ghId) {
      this.subscriptionData = {
        ...this.subscriptionData,
        loading: false,
        error: 'Please log in with GitHub to view your subscription',
        subscription: null,
        hasActiveSubscription: false,
        ghId: null
      }
    } else {
      this.subscriptionData = {
        ...this.subscriptionData,
        loading: false,
        error: null,
        subscription: status.subscription,
        hasActiveSubscription: status.hasActiveSubscription,
        ghId: status.ghId
      }
    }
    this.renderComponent()
  }

  async refresh() {
    // Trigger SubscriptionPlugin to refresh (it will emit event when done)
    await this.call('subscription' as any, 'refreshSubscriptionStatus')
  }

  async manageSubscription() {
    try {
      const { subscription } = this.subscriptionData
      if (!subscription?.customerId || !subscription?.id) {
        alert('Unable to open customer portal: missing subscription details')
        return
      }

      // Get customer portal URL from backend
      const response = await fetch(
        `${endpointUrls.billing}/customer-portal/${subscription.customerId}/${subscription.id}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to generate customer portal URL')
      }

      const data = await response.json()
      if (data.portalUrl) {
        window.open(data.portalUrl, '_blank')
      } else {
        throw new Error('No portal URL returned')
      }
    } catch (error: any) {
      console.error('Error opening customer portal:', error)
      alert(`Failed to open customer portal: ${error.message}`)
    }
  }

  async cancelSubscription() {
    if (this.subscriptionData.subscription?.id) {
      // TODO: Implement cancel endpoint
      alert('Cancel functionality will be implemented soon')
    }
  }

  setDispatch(dispatch: React.Dispatch<any>) {
    this.dispatch = dispatch
    this.renderComponent()
  }

  renderComponent() {
    this.dispatch({
      ...this.subscriptionData
    })
  }

  async showSubscription() {
    await this.call('tabs', 'focus', 'subscriptionManager')
  }

  updateComponent(state: SubscriptionData) {
    return (
      <SubscriptionManagerUI 
        loading={state.loading}
        error={state.error}
        subscription={state.subscription}
        hasActiveSubscription={state.hasActiveSubscription}
        ghId={state.ghId}
        availablePlans={state.availablePlans}
        loadingPlans={state.loadingPlans}
        onRefresh={() => this.refresh()}
        onManage={() => this.manageSubscription()}
        onCancel={() => this.cancelSubscription()}
      />
    )
  }

  render() {
    return (
      <div id="subscriptionManager">
        <PluginViewWrapper plugin={this} />
      </div>
    )
  }
}
