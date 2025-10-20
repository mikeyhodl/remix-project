import React from 'react'
import { ViewPlugin } from '@remixproject/engine-web'
import { PluginViewWrapper } from '@remix-ui/helper'
import { SubscriptionManagerUI } from '@remix-ui/subscription-manager'

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
}

export class SubscriptionManager extends ViewPlugin {
  dispatch: React.Dispatch<any> = () => {}
  private subscriptionData: SubscriptionData = {
    loading: true,
    error: null,
    subscription: null,
    hasActiveSubscription: false,
    ghId: null
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
        ghId: null
      }
      this.renderComponent()
    })

    // Initial load - get current status from SubscriptionPlugin
    await this.loadFromSubscriptionPlugin()
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
        loading: false,
        error: 'Please log in with GitHub to view your subscription',
        subscription: null,
        hasActiveSubscription: false,
        ghId: null
      }
    } else {
      this.subscriptionData = {
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
    if (this.subscriptionData.subscription?.customerId) {
      const paddleUrl = `https://www.paddle.com/customer/manage/${this.subscriptionData.subscription.customerId}`
      window.open(paddleUrl, '_blank')
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
