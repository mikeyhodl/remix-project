/**
 * PlanManagerMachine — XState v5 machine modelling the lifecycle of the
 * Plan & Credits side panel.
 *
 * Five parallel regions, one source of truth:
 *   - auth      : unknown | unauthenticated | authenticated
 *   - data      : idle | loading | ready | refreshing | error  (account-scoped)
 *   - catalog   : idle | loading | ready | error               (public)
 *   - checkout  : idle | inProgress | result                   (Paddle-driven)
 *   - overlay   : closed | open
 *
 * The machine is pure — it knows nothing about React, fetch, or the plugin
 * engine. It receives events; the plugin wires them up to the outside world
 * (auth events, Paddle events, API fetches, "out of credits" signals from
 * the AI plugin, dev-switcher buttons, etc.).
 *
 * UI reads state through the `selectors` exported below — never by digging
 * into raw context. This keeps the contract narrow.
 *
 * Catalog endpoints (`/billing/subscription-plans`, `/billing/credit-packages`)
 * are public; the catalog region loads eagerly. Account data only loads once
 * authenticated. When the server eventually exposes a per-user "available
 * plans" endpoint, we swap the `selectVisiblePlans` selector for a direct
 * `context.availablePlans` read — no other call site changes.
 */

import { setup, createActor, type AnyActorRef } from 'xstate'
import type {
  Credits,
  UserSubscription,
  SubscriptionPlan,
  CreditPackage,
  PermissionsResponse
} from '@remix-api'

// ─── Public types ───────────────────────────────────────────────────

export type CreditState = 'unknown' | 'healthy' | 'low' | 'critical' | 'empty'
export type PlanLifecycle = 'active' | 'expiring' | 'expired'
export type PlanKind = 'no_subscription' | 'beta' | 'paid'
export type DataState = 'loading' | 'error' | 'ready'
export type ActiveAlert =
  | 'beta-transition'
  | 'plan-lifecycle'
  | 'credit'
  | null

export type CheckoutResultKind = 'processing' | 'success' | 'closed' | 'error'
export type CheckoutIntent = 'subscription' | 'topup' | 'feature'

export interface CheckoutResult {
  kind: CheckoutResultKind
  intent: CheckoutIntent
  itemLabel?: string
  errorMessage?: string
  transactionId?: string
}

/** Snapshot the UI consumes — purely derived, never mutated outside the machine. */
export interface PlanManagerSnapshot {
  isAuthenticated: boolean
  dataState: DataState
  isOpen: boolean
  credits: Credits | null
  subscription: UserSubscription | null
  permissions: PermissionsResponse | null
  catalogPlans: SubscriptionPlan[]
  catalogPackages: CreditPackage[]
  checkoutResult: CheckoutResult | null
  errorMessage: string | null
}

// ─── Machine context + events ───────────────────────────────────────

/** Tuning knobs — colocated so the machine is the single source of thresholds. */
export const THRESHOLDS = {
  CREDIT_LOW_PCT: 0.20,        // <20% of monthly allowance → 'low'
  CREDIT_CRITICAL_PCT: 0.05,   // <5%                       → 'critical'
  PLAN_EXPIRING_DAYS: 7        // ≤7 days to renewal/end    → 'expiring'
} as const

interface CheckoutIntentRecord {
  intent: CheckoutIntent
  itemLabel?: string
  productId?: string
}

interface MachineContext {
  // auth
  token: string | null
  userId: number | null
  // account data
  credits: Credits | null
  subscription: UserSubscription | null
  permissions: PermissionsResponse | null
  // catalog
  catalogPlans: SubscriptionPlan[]
  catalogPackages: CreditPackage[]
  // checkout
  pendingCheckout: CheckoutIntentRecord | null
  checkoutResult: CheckoutResult | null
  // diagnostics
  lastError: string | null
}

export type PlanManagerEvent =
  // auth
  | { type: 'AUTH_CHANGED'; isAuthenticated: boolean; token?: string | null; userId?: number | null }
  | { type: 'LOGOUT' }
  // account data
  | { type: 'REFRESH' }
  | { type: 'DATA_LOADED'; credits: Credits | null; subscription: UserSubscription | null; permissions: PermissionsResponse | null }
  | { type: 'DATA_FAILED'; message: string }
  // catalog
  | { type: 'CATALOG_LOAD' }
  | { type: 'CATALOG_LOADED'; plans: SubscriptionPlan[]; packages: CreditPackage[] }
  | { type: 'CATALOG_FAILED'; message: string }
  // checkout
  | { type: 'CHECKOUT_INTENT'; intent: CheckoutIntent; itemLabel?: string; productId?: string }
  | { type: 'CHECKOUT_OPENED' }
  | { type: 'CHECKOUT_COMPLETED'; transactionId?: string }
  | { type: 'CHECKOUT_CLOSED' }
  | { type: 'CHECKOUT_ERROR'; message?: string; transactionId?: string }
  | { type: 'CHECKOUT_RESULT_DISMISS' }
  // External signal — e.g. AI plugin received a 402 from upstream.
  | { type: 'CREDITS_EXHAUSTED' }
  // overlay
  | { type: 'OPEN_OVERLAY' }
  | { type: 'CLOSE_OVERLAY' }
  | { type: 'TOGGLE_OVERLAY' }
  // dev — inject a synthetic snapshot for the side-panel scenario buttons.
  | { type: 'DEV_INJECT'; partial: Partial<MachineContext> }

const initialContext: MachineContext = {
  token: null,
  userId: null,
  credits: null,
  subscription: null,
  permissions: null,
  catalogPlans: [],
  catalogPackages: [],
  pendingCheckout: null,
  checkoutResult: null,
  lastError: null
}

// ─── Machine ─────────────────────────────────────────────────────────

export const planManagerMachine = setup({
  types: {
    context: {} as MachineContext,
    events: {} as PlanManagerEvent
  },
  guards: {
    isAuthenticated: ({ context, event }) => {
      if (event.type === 'AUTH_CHANGED') return event.isAuthenticated
      return context.token !== null
    }
  },
  actions: {
    setAuth: ({ context, event }) => {
      if (event.type !== 'AUTH_CHANGED') return
      context.token = event.isAuthenticated ? (event.token ?? context.token) : null
      context.userId = event.isAuthenticated ? (event.userId ?? context.userId) : null
    },
    clearAuth: ({ context }) => {
      context.token = null
      context.userId = null
      context.credits = null
      context.subscription = null
      context.permissions = null
      context.lastError = null
    },
    setData: ({ context, event }) => {
      if (event.type !== 'DATA_LOADED') return
      context.credits = event.credits
      context.subscription = event.subscription
      context.permissions = event.permissions
      context.lastError = null
    },
    setDataError: ({ context, event }) => {
      if (event.type !== 'DATA_FAILED') return
      context.lastError = event.message
    },
    setCatalog: ({ context, event }) => {
      if (event.type !== 'CATALOG_LOADED') return
      context.catalogPlans = event.plans
      context.catalogPackages = event.packages
    },
    setCatalogError: ({ context, event }) => {
      if (event.type !== 'CATALOG_FAILED') return
      context.lastError = event.message
    },
    captureCheckoutIntent: ({ context, event }) => {
      if (event.type !== 'CHECKOUT_INTENT') return
      context.pendingCheckout = {
        intent: event.intent,
        itemLabel: event.itemLabel,
        productId: event.productId
      }
    },
    setCheckoutProcessing: ({ context, event }) => {
      if (event.type !== 'CHECKOUT_COMPLETED') return
      const intent = context.pendingCheckout?.intent ?? 'subscription'
      const itemLabel = context.pendingCheckout?.itemLabel
      context.checkoutResult = {
        kind: 'processing',
        intent,
        itemLabel,
        transactionId: event.transactionId
      }
    },
    setCheckoutSuccess: ({ context }) => {
      // Promotion from 'processing' → 'success' once the data refresh confirms.
      if (context.checkoutResult?.kind !== 'processing') return
      context.checkoutResult = { ...context.checkoutResult, kind: 'success' }
    },
    setCheckoutClosed: ({ context }) => {
      const intent = context.pendingCheckout?.intent ?? 'subscription'
      const itemLabel = context.pendingCheckout?.itemLabel
      context.checkoutResult = { kind: 'closed', intent, itemLabel }
      context.pendingCheckout = null
    },
    setCheckoutError: ({ context, event }) => {
      if (event.type !== 'CHECKOUT_ERROR') return
      const intent = context.pendingCheckout?.intent ?? 'subscription'
      const itemLabel = context.pendingCheckout?.itemLabel
      context.checkoutResult = {
        kind: 'error',
        intent,
        itemLabel,
        errorMessage: event.message,
        transactionId: event.transactionId
      }
      context.pendingCheckout = null
    },
    clearCheckoutResult: ({ context }) => {
      context.checkoutResult = null
    },
    devInject: ({ context, event }) => {
      if (event.type !== 'DEV_INJECT') return
      Object.assign(context, event.partial)
    }
  }
}).createMachine({
  id: 'planManager',
  type: 'parallel',
  context: initialContext,
  states: {
    auth: {
      initial: 'unknown',
      on: {
        AUTH_CHANGED: [
          {
            guard: 'isAuthenticated',
            target: '.authenticated',
            actions: ['setAuth']
          },
          {
            target: '.unauthenticated',
            actions: ['clearAuth']
          }
        ],
        LOGOUT: { target: '.unauthenticated', actions: ['clearAuth'] }
      },
      states: {
        unknown: {},
        unauthenticated: {},
        authenticated: {}
      }
    },
    data: {
      initial: 'idle',
      on: {
        // Whenever auth flips to authenticated we want a fresh load.
        AUTH_CHANGED: [
          { guard: 'isAuthenticated', target: '.loading' },
          { target: '.idle' }
        ],
        LOGOUT: { target: '.idle' }
      },
      states: {
        idle: {
          on: {
            REFRESH: 'loading'
          }
        },
        loading: {
          on: {
            DATA_LOADED: { target: 'ready', actions: ['setData'] },
            DATA_FAILED: { target: 'error', actions: ['setDataError'] }
          }
        },
        ready: {
          on: {
            REFRESH: 'refreshing',
            // External signal "I just got a 402 from the API" → re-fetch to
            // sync the UI with reality, but stay 'ready' so the panel doesn't
            // flash the skeleton.
            CREDITS_EXHAUSTED: 'refreshing'
          }
        },
        refreshing: {
          on: {
            DATA_LOADED: {
              target: 'ready',
              actions: ['setData', 'setCheckoutSuccess']
            },
            DATA_FAILED: { target: 'error', actions: ['setDataError'] }
          }
        },
        error: {
          on: {
            REFRESH: 'loading'
          }
        }
      }
    },
    catalog: {
      initial: 'idle',
      on: {
        CATALOG_LOAD: { target: '.loading' }
      },
      states: {
        idle: {},
        loading: {
          on: {
            CATALOG_LOADED: { target: 'ready', actions: ['setCatalog'] },
            CATALOG_FAILED: { target: 'error', actions: ['setCatalogError'] }
          }
        },
        ready: {
          on: {
            CATALOG_LOAD: 'loading'
          }
        },
        error: {
          on: {
            CATALOG_LOAD: 'loading'
          }
        }
      }
    },
    checkout: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            CHECKOUT_INTENT: {
              target: 'inProgress',
              actions: ['captureCheckoutIntent']
            }
          }
        },
        inProgress: {
          on: {
            CHECKOUT_OPENED: {},
            CHECKOUT_COMPLETED: {
              target: 'result',
              actions: ['setCheckoutProcessing']
            },
            CHECKOUT_CLOSED: {
              target: 'result',
              actions: ['setCheckoutClosed']
            },
            CHECKOUT_ERROR: {
              target: 'result',
              actions: ['setCheckoutError']
            }
          }
        },
        result: {
          on: {
            CHECKOUT_RESULT_DISMISS: {
              target: 'idle',
              actions: ['clearCheckoutResult']
            },
            // A new purchase starts — supersede the previous result.
            CHECKOUT_INTENT: {
              target: 'inProgress',
              actions: ['clearCheckoutResult', 'captureCheckoutIntent']
            }
          }
        }
      }
    },
    overlay: {
      initial: 'closed',
      on: {
        // Surface checkout outcomes immediately — auto-open if closed.
        CHECKOUT_COMPLETED: { target: '.open' },
        CHECKOUT_CLOSED: { target: '.open' },
        CHECKOUT_ERROR: { target: '.open' },
        // External signal "out of credits" should also reveal the panel.
        CREDITS_EXHAUSTED: { target: '.open' }
      },
      states: {
        closed: {
          on: {
            OPEN_OVERLAY: 'open',
            TOGGLE_OVERLAY: 'open'
          }
        },
        open: {
          on: {
            CLOSE_OVERLAY: 'closed',
            TOGGLE_OVERLAY: 'closed'
          }
        }
      }
    }
  },
  on: {
    DEV_INJECT: { actions: ['devInject'] }
  }
})

// ─── Selectors ──────────────────────────────────────────────────────
//
// The UI consumes nothing but selectors. Each selector takes a snapshot
// (or context) and returns a pure derived value. Tested in isolation; no
// React, no async, no plugin engine.

/**
 * Snapshot adapter. Pulls the cross-cutting state into a flat shape the
 * UI can `useSyncExternalStore` against.
 */
export function snapshotFromActor(actor: AnyActorRef): PlanManagerSnapshot {
  const snap = actor.getSnapshot() as { value: any; context: MachineContext }
  const value = snap.value as Record<string, string>
  const ctx = snap.context

  const dataState: DataState =
    value.data === 'loading' ? 'loading'
      : value.data === 'error' ? 'error'
        : 'ready'

  return {
    isAuthenticated: value.auth === 'authenticated',
    dataState,
    isOpen: value.overlay === 'open',
    credits: ctx.credits,
    subscription: ctx.subscription,
    permissions: ctx.permissions,
    catalogPlans: ctx.catalogPlans,
    catalogPackages: ctx.catalogPackages,
    checkoutResult: ctx.checkoutResult,
    errorMessage: ctx.lastError
  }
}

/** Plan derivation. Folds subscription + permissions into a single shape. */
export interface PlanState {
  kind: PlanKind
  planId: string | null
  planName: string
  isBeta: boolean
  isCancelled: boolean
  daysUntilExpiry: number      // negative → already expired
  expiresOn: string | null     // ISO date string
  lifecycle: PlanLifecycle
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

function daysBetween(now: number, iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY
  return Math.floor((t - now) / MS_PER_DAY)
}

function deriveLifecycle(daysUntilExpiry: number): PlanLifecycle {
  if (daysUntilExpiry < 0) return 'expired'
  if (daysUntilExpiry <= THRESHOLDS.PLAN_EXPIRING_DAYS) return 'expiring'
  return 'active'
}

/**
 * Beta detection — confirmed against /permissions/ live response:
 *   { feature_groups: [{ name: 'beta', expires_at: null|string, ... }] }
 */
export function selectBetaGroup(snap: PlanManagerSnapshot) {
  const groups = snap.permissions?.feature_groups
  if (!groups) return null
  return groups.find(g => g.name === 'beta' || g.name === 'beta_tester') ?? null
}

export function selectPlanState(snap: PlanManagerSnapshot, now: number = Date.now()): PlanState {
  const beta = selectBetaGroup(snap)
  const sub = snap.subscription

  // Beta first — beta is a permissions group, NOT a billing plan.
  if (beta) {
    const expiresIso = beta.expires_at
    const days = daysBetween(now, expiresIso)
    const lifecycle = deriveLifecycle(days)
    return {
      kind: 'beta',
      planId: 'beta',
      planName: 'Beta Tester',
      isBeta: true,
      isCancelled: false,
      daysUntilExpiry: Number.isFinite(days) ? days : Number.POSITIVE_INFINITY,
      expiresOn: expiresIso ?? null,
      lifecycle: expiresIso ? lifecycle : 'active'
    }
  }

  if (!sub) {
    return {
      kind: 'no_subscription',
      planId: null,
      planName: 'Free',
      isBeta: false,
      isCancelled: false,
      daysUntilExpiry: Number.POSITIVE_INFINITY,
      expiresOn: null,
      lifecycle: 'active'
    }
  }

  // Paddle-native subscription
  const endsAt = sub.currentBillingPeriod?.endsAt ?? sub.currentPeriodEnd ?? null
  const days = daysBetween(now, endsAt)
  const isCancelled =
    sub.scheduledChange?.action === 'cancel' ||
    sub.cancelAtPeriodEnd === true ||
    sub.status === 'canceled'

  // For active auto-renewing subs the period end is just the next bill date,
  // not a "lifecycle event". Only mark expiring/expired when the user has
  // cancelled or the status itself signals it.
  const lifecycle =
    sub.status === 'active' && !isCancelled ? 'active'
      : sub.status === 'past_due' ? 'expiring'
        : deriveLifecycle(days)

  const planName =
    sub.items?.[0]?.product?.name ||
    sub.planId ||
    'Subscription'

  return {
    kind: 'paid',
    planId: sub.planId ?? sub.items?.[0]?.priceId ?? null,
    planName,
    isBeta: false,
    isCancelled,
    daysUntilExpiry: Number.isFinite(days) ? days : Number.POSITIVE_INFINITY,
    expiresOn: endsAt,
    lifecycle
  }
}

/**
 * Credit severity. Total = credits per cycle (subscription's allowance,
 * else permissions/free quota, else just balance for accuracy when nothing
 * else is known).
 */
export interface CreditStatus {
  state: CreditState
  remaining: number
  total: number
  used: number
  usedPct: number     // 0–100
  remainingPct: number // 0–1
  refreshDate: string | null  // ISO, when the next allowance lands
}

export function selectCreditStatus(snap: PlanManagerSnapshot): CreditStatus {
  const credits = snap.credits
  if (!credits) {
    return { state: 'unknown', remaining: 0, total: 0, used: 0, usedPct: 0, remainingPct: 0, refreshDate: null }
  }

  const remaining = Math.max(0, credits.balance ?? 0)

  // Total (this cycle's allowance) — best-effort:
  //   1. subscription.creditsPerMonth (legacy field on UserSubscription)
  //   2. matching catalog plan's creditsPerMonth
  //   3. (free + paid) — gives a sensible baseline when no plan signal exists
  const sub = snap.subscription
  let total = 0
  if (sub?.creditsPerMonth) total = sub.creditsPerMonth
  if (!total && sub?.planId) {
    const match = snap.catalogPlans.find(p => p.id === sub.planId)
    if (match) total = match.creditsPerMonth
  }
  if (!total) {
    // Best fallback: balance + any consumed paid credits we can infer.
    // Free-credits + paid-credits gives the *current* split, not the
    // monthly cap — but it's better than zero for severity calc.
    total = (credits.free_credits ?? 0) + (credits.paid_credits ?? 0)
  }
  if (!total) total = remaining // last resort; severity will read 'healthy'

  const used = Math.max(0, total - remaining)
  const remainingPct = total > 0 ? remaining / total : 1
  const usedPct = total > 0 ? Math.min(100, (used / total) * 100) : 0

  let state: CreditState
  if (remaining <= 0) state = 'empty'
  else if (remainingPct < THRESHOLDS.CREDIT_CRITICAL_PCT) state = 'critical'
  else if (remainingPct < THRESHOLDS.CREDIT_LOW_PCT) state = 'low'
  else state = 'healthy'

  const refreshDate = sub?.currentBillingPeriod?.endsAt ?? sub?.nextBilledAt ?? null

  return { state, remaining, total, used, usedPct, remainingPct, refreshDate }
}

/**
 * Severity hierarchy — only ONE alert ever shows at the top.
 *   1. beta-transition (beta tester whose access is ending/ended)
 *   2. plan-lifecycle  (paid user with cancelled / past_due / expired)
 *   3. credit          (any non-healthy credit state)
 * Returns null when the panel is calm.
 */
export function selectActiveAlert(snap: PlanManagerSnapshot): ActiveAlert {
  if (snap.dataState !== 'ready') return null
  const plan = selectPlanState(snap)
  if (plan.isBeta && plan.lifecycle !== 'active') return 'beta-transition'
  if (!plan.isBeta && plan.kind === 'paid' && plan.lifecycle !== 'active') return 'plan-lifecycle'
  const credit = selectCreditStatus(snap)
  if (credit.state !== 'healthy' && credit.state !== 'unknown') return 'credit'
  return null
}

/**
 * Visible plans for this user. Today the catalog is identical for all
 * users (server filtering is planned). Once the API exposes a per-user
 * "available plans" endpoint, swap this for `snap.availablePlans`.
 */
export function selectVisiblePlans(snap: PlanManagerSnapshot): SubscriptionPlan[] {
  return snap.catalogPlans
}

export function selectVisiblePackages(snap: PlanManagerSnapshot): CreditPackage[] {
  return snap.catalogPackages
}

/** Top tier? Then nothing to upgrade to. */
export function selectCanUpgrade(snap: PlanManagerSnapshot): boolean {
  const plans = snap.catalogPlans
  if (plans.length === 0) return false
  const plan = selectPlanState(snap)
  if (plan.kind === 'no_subscription' || plan.isBeta) return true
  const sorted = [...plans].sort((a, b) => a.priceUsd - b.priceUsd)
  const top = sorted[sorted.length - 1]
  return plan.planId !== top.id
}

export function selectCheckoutResult(snap: PlanManagerSnapshot): CheckoutResult | null {
  return snap.checkoutResult
}

// ─── Facade ─────────────────────────────────────────────────────────

/**
 * Lightweight wrapper that owns the actor and exposes a stable API.
 * The plugin holds one of these; React components subscribe via the
 * `subscribe` method (compatible with `useSyncExternalStore`).
 */
export class PlanManagerStore {
  private actor: AnyActorRef
  private snapshot: PlanManagerSnapshot
  private listeners = new Set<() => void>()

  constructor(opts?: { debug?: boolean }) {
    const debug = opts?.debug ?? false
    this.actor = createActor(planManagerMachine, {
      inspect: debug
        ? (ev: any) => {
          if (ev.type === '@xstate.event') {
             
            console.log('%c[PlanManager] event %c%s',
              'color:#8be9fd', 'color:#50fa7b;font-weight:bold',
              JSON.stringify(ev.event))
          } else if (ev.type === '@xstate.snapshot') {
             
            console.log('%c[PlanManager] state %c%s',
              'color:#8be9fd', 'color:#f1fa8c',
              JSON.stringify(ev.snapshot?.value))
          }
        }
        : undefined
    })
    this.actor.subscribe(() => {
      this.snapshot = snapshotFromActor(this.actor)
      for (const fn of this.listeners) {
        try { fn() } catch (e) { console.error('[PlanManagerStore] listener error', e) }
      }
    })
    this.actor.start()
    this.snapshot = snapshotFromActor(this.actor)
  }

  send(event: PlanManagerEvent): void {
    this.actor.send(event)
  }

  getSnapshot = (): PlanManagerSnapshot => this.snapshot

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb)
    return () => { this.listeners.delete(cb) }
  }

  stop(): void {
    this.actor.stop()
    this.listeners.clear()
  }
}
