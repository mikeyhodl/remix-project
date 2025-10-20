import { Plugin } from '@remixproject/engine'
import { CustomRemixApi } from '@remix-api'
import { endpointUrls } from '@remix-endpoints-helper'

const profile = {
  name: 'subscription',
  displayName: 'Subscription Manager',
  description: 'Manages user subscriptions for AI features',
  methods: ['hasActiveSubscription', 'checkSubscription', 'getSubscriptionStatus'],
  events: ['subscriptionStatusChanged'],
  version: '1.0.0'
}

export class SubscriptionPlugin extends Plugin<any, CustomRemixApi> {
  private hasActiveSub: boolean = false
  private ghId: string | null = null
  private subscriptionData: any = null
  private checkingSubscription: boolean = false

  constructor() {
    super(profile)
  }

  async onActivation() {
    console.log('Subscription plugin activated')
    
    // Clear subscription on logout
    this.on('dgitApi' as any, 'loggedOut', () => {
      console.log('User logged out, clearing subscription')
      const wasActive = this.hasActiveSub
      this.hasActiveSub = false
      this.ghId = null
      this.subscriptionData = null
      if (wasActive) {
        this.emit('subscriptionStatusChanged', this.getSubscriptionStatus())
      }
    })
  }

  /**
   * Check subscription status for a given GitHub ID
   * Fetches full subscription data and stores it
   * @param ghId GitHub user ID
   * @returns Promise<boolean> true if user has active subscription
   */
  async checkSubscription(ghId: string): Promise<boolean> {
    if (this.checkingSubscription) return this.hasActiveSub
    
    this.checkingSubscription = true
    this.ghId = ghId

    try {
      const response = await fetch(`${endpointUrls.billing}/subscription/${ghId}`)
      
      if (response.ok) {
        const data = await response.json()
        const wasActive = this.hasActiveSub
        
        // Store full subscription data
        this.hasActiveSub = data.hasActiveSubscription || false
        this.subscriptionData = data.subscription
        
        // Emit event with full status (including subscription data)
        this.emit('subscriptionStatusChanged', this.getSubscriptionStatus())
        
        return this.hasActiveSub
      }
    } catch (e) {
      console.error('Failed to check subscription:', e)
    } finally {
      this.checkingSubscription = false
    }

    return false
  }

  /**
   * Get current subscription status without making API call
   * @returns boolean
   */
  hasActiveSubscription(): boolean {
    return this.hasActiveSub
  }

  /**
   * Get full subscription status including GitHub ID and subscription details
   * @returns object with hasActiveSubscription, ghId, and subscription data
   */
  getSubscriptionStatus() {
    return {
      hasActiveSubscription: this.hasActiveSub,
      ghId: this.ghId,
      subscription: this.subscriptionData
    }
  }

  /**
   * Refresh subscription status (makes API call)
   * @returns Promise<boolean>
   */
  async refreshSubscriptionStatus(): Promise<boolean> {
    if (this.ghId) {
      return await this.checkSubscription(this.ghId)
    }
    return false
  }
}
