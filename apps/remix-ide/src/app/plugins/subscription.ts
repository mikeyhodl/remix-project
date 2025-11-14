import { Plugin } from '@remixproject/engine'
import { CustomRemixApi } from '@remix-api'
import { endpointUrls } from '@remix-endpoints-helper'

const profile = {
  name: 'subscription',
  displayName: 'Subscription Manager',
  description: 'Manages user subscriptions for AI features',
  methods: ['hasActiveSubscription', 'checkSubscription', 'getSubscriptionStatus', 'refreshSubscriptionStatus'],
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
    
    const clearOnLogout = (source: string) => {
      console.log(`[Subscription] Logout detected from ${source}, clearing subscription state`)
      this.hasActiveSub = false
      this.ghId = null
      this.subscriptionData = null
      // Always emit so listeners reset their UI promptly
      this.emit('subscriptionStatusChanged', this.getSubscriptionStatus())
    }

    // Clear subscription on logout (compat listeners)
    this.on('dgitApi' as any, 'loggedOut', () => clearOnLogout('dgitApi.loggedOut'))
    // Primary logout event from Git plugin
    this.on('dgit' as any, 'disconnect', () => clearOnLogout('dgit.disconnect'))
  }

  /**
   * Check subscription status for a given GitHub ID
   * Fetches full subscription data and stores it
   * @param ghId GitHub user ID
   * @returns Promise<boolean> true if user has active subscription
   */
  async checkSubscription(ghId: string): Promise<boolean> {
    console.log('🔵 SubscriptionPlugin: checkSubscription() called with ghId:', ghId)
    
    // Wait for any in-progress check to complete
    while (this.checkingSubscription) {
      console.log('⏳ SubscriptionPlugin: Waiting for in-progress check to complete...')
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    this.checkingSubscription = true
    this.ghId = ghId

    try {
      console.log('🔵 SubscriptionPlugin: Making API call to /subscription/' + ghId)
      const response = await fetch(`${endpointUrls.billing}/subscription/${ghId}`, {
        credentials: 'include' // Send cookies for authentication
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ SubscriptionPlugin: API returned data:', data)
        const wasActive = this.hasActiveSub
        
        // Store full subscription data
        this.hasActiveSub = data.hasActiveSubscription || false
        this.subscriptionData = data.subscription
        
        console.log('🔵 SubscriptionPlugin: Emitting subscriptionStatusChanged event')
        // Emit event with full status (including subscription data)
        this.emit('subscriptionStatusChanged', this.getSubscriptionStatus())
        
        return this.hasActiveSub
      } else {
        console.error('❌ SubscriptionPlugin: API returned error status:', response.status)
      }
    } catch (e) {
      console.error('❌ SubscriptionPlugin: Failed to check subscription:', e)
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
    console.log('🔵 SubscriptionPlugin: refreshSubscriptionStatus() called, ghId:', this.ghId)
    if (this.ghId) {
      const result = await this.checkSubscription(this.ghId)
      console.log('✅ SubscriptionPlugin: checkSubscription returned:', result)
      return result
    }
    console.warn('⚠️ SubscriptionPlugin: No ghId set, cannot refresh')
    return false
  }
}
