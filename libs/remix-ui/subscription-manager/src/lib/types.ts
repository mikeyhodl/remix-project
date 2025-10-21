export interface Product {
  id: string
  name: string
  description?: string
  imageUrl?: string
}

export interface SubscriptionItem {
  priceId: string
  productId: string
  description: string
  quantity: number
  unitPrice?: {
    amount: string
    currencyCode: string
  }
  billingCycle?: {
    interval: string
    frequency: number
  }
  product?: Product
}

export interface SubscriptionDetails {
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
