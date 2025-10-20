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
  private checkingSubscription: boolean = false

  constructor() {
    super(profile)
  }

  async onActivation() {
    console.log('Subscription plugin activated')
  }

  /**
   * Check subscription status for a given GitHub ID
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
        this.hasActiveSub = data.hasActiveSubscription || false
        
        // Emit event if status changed
        if (wasActive !== this.hasActiveSub) {
          this.emit('subscriptionStatusChanged', this.hasActiveSub)
        }
        
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
   * Get full subscription status including GitHub ID
   * @returns object with hasActiveSubscription and ghId
   */
  getSubscriptionStatus() {
    return {
      hasActiveSubscription: this.hasActiveSub,
      ghId: this.ghId
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
