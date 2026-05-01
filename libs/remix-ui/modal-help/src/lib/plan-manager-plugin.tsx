/**
 * PlanManagerPlugin — Remix `sidePanel` ViewPlugin for the
 * "Plan & Credits" experience.
 *
 * The plugin is a thin shell around `PlanManagerStore` (XState v5 actor).
 * All UI state lives in the machine; the plugin's job is to:
 *   - bridge auth-plugin events → `AUTH_CHANGED`
 *   - fetch account data (credits, subscription, permissions) → `DATA_LOADED`
 *   - fetch the public catalog (plans, packages) → `CATALOG_LOADED`
 *   - bridge Paddle checkout events → `CHECKOUT_*`
 *   - expose `reportCreditsExhausted()` so any plugin that hits a 402 can
 *     ask the panel to refresh + reveal itself
 *   - render the React tree, which subscribes to the store
 *
 * The plugin owns NO derived state — every visible string is a selector.
 */

import { ViewPlugin } from '@remixproject/engine-web'
import React, { useEffect, useMemo, useSyncExternalStore } from 'react'
import { PluginViewWrapper } from '@remix-ui/helper'
import * as packageJson from '../../../../../package.json'

import {
  PlanManagerStore,
  type PlanManagerSnapshot,
  type CheckoutResult,
  type CheckoutResultKind,
  type CheckoutIntent,
  type PlanState,
  type CreditStatus,
  type CreditState,
  type PlanLifecycle,
  type ActiveAlert,
  selectActiveAlert,
  selectPlanState,
  selectCreditStatus,
  selectVisiblePlans,
  selectVisiblePackages,
  selectCanUpgrade,
  selectCheckoutResult
} from './plan-manager-machine'

import './plan-manager.css'

const PLAN_ICON = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a2a3bd" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 6v6c0 5 3.4 9.5 8 10 4.6-.5 8-5 8-10V6l-8-4z"/><path d="M9 12l2 2 4-4"/></svg>`)

const profile = {
  name: 'planManager',
  displayName: 'Plan & Credits',
  description: 'Manage your subscription, top up credits and review AI usage',
  methods: ['open', 'close', 'toggle', 'setCheckoutResult', 'reportCreditsExhausted', 'refresh'],
  events: ['opened', 'closed', 'checkoutResultChanged'],
  icon: PLAN_ICON,
  location: 'sidePanel',
  version: packageJson.version,
  maintainedBy: 'Remix'
}

// Re-export public types for other packages.
export type { CheckoutResult, CheckoutResultKind, CheckoutIntent }

export class PlanManagerPlugin extends ViewPlugin {
  dispatch: React.Dispatch<any> = () => {}
  readonly store: PlanManagerStore

  // Memo to detect repeated AUTH events (auth-plugin re-emits a lot).
  private lastAuthSig = ''

  constructor() {
    super(profile)
    this.store = new PlanManagerStore({ debug: false })

    // Surface checkout results as a plugin event so external listeners
    // (e.g. analytics) can react without subscribing to the store.
    let lastResult: CheckoutResult | null = null
    this.store.subscribe(() => {
      const next = this.store.getSnapshot().checkoutResult
      if (next !== lastResult) {
        lastResult = next
        this.emit('checkoutResultChanged', next)
      }
    })

    // Same for overlay open/closed.
    let wasOpen = false
    this.store.subscribe(() => {
      const open = this.store.getSnapshot().isOpen
      if (open !== wasOpen) {
        wasOpen = open
        this.emit(open ? 'opened' : 'closed')
        this.renderComponent()
      }
    })
  }

  async onActivation(): Promise<void> {
    this.renderComponent()

    // Catalog is public — load it eagerly so plan/package cards are ready
    // even before the user signs in.
    this.store.send({ type: 'CATALOG_LOAD' })
    void this.loadCatalog()

    // Bridge auth events. Re-fired on token refresh so we tolerate noise.
    const onAuthChange = (s: { isAuthenticated: boolean; token?: string; user?: { id?: number } }) => {
      const sig = `${s.isAuthenticated}|${s.token ?? ''}`
      if (sig === this.lastAuthSig) return
      this.lastAuthSig = sig
      this.store.send({
        type: 'AUTH_CHANGED',
        isAuthenticated: !!s.isAuthenticated,
        token: s.token ?? null,
        userId: s.user?.id ?? null
      })
      if (s.isAuthenticated) void this.loadAccountData()
    }
    try {
      this.on('auth', 'authStateChanged', onAuthChange as any)
      this.on('auth', 'creditsUpdated', () => { void this.loadAccountData() })
      // Initial sync — auth might already be settled by the time we activate.
      const user = await this.call('auth', 'getUser').catch(() => null)
      if (user) {
        const token = await this.call('auth', 'getToken').catch(() => null)
        onAuthChange({ isAuthenticated: true, token, user })
      } else {
        this.store.send({ type: 'AUTH_CHANGED', isAuthenticated: false })
      }
    } catch (err) {
      console.warn('[PlanManager] auth bridge failed', err)
    }
  }

  /** Public API — called by the menu icon and by feature-badges.tsx. */
  async open(): Promise<void> {
    this.store.send({ type: 'OPEN_OVERLAY' })
    try {
      await this.call('menuicons', 'select', 'planManager')
    } catch { /* noop */ }
  }

  close(): void {
    this.store.send({ type: 'CLOSE_OVERLAY' })
  }

  toggle(): void {
    this.store.send({ type: 'TOGGLE_OVERLAY' })
  }

  /**
   * Set or clear the checkout result screen. Auto-opens the panel when
   * a result is supplied so the user always sees the outcome.
   *
   * Today this maps onto the machine's CHECKOUT_* events for backwards
   * compatibility with billing-manager.tsx — once that file is updated to
   * emit CHECKOUT_* directly, this method becomes redundant.
   */
  setCheckoutResult(result: CheckoutResult | null): void {
    if (!result) {
      this.store.send({ type: 'CHECKOUT_RESULT_DISMISS' })
      return
    }
    // We weren't told the intent up-front, so capture it now from the result.
    this.store.send({
      type: 'CHECKOUT_INTENT',
      intent: result.intent,
      itemLabel: result.itemLabel
    })
    switch (result.kind) {
    case 'processing':
    case 'success':
      this.store.send({ type: 'CHECKOUT_COMPLETED', transactionId: result.transactionId })
      // Trigger a refresh so 'processing' promotes to 'success' once data
      // confirms (the machine handles the promotion in its DATA_LOADED action).
      void this.loadAccountData()
      break
    case 'closed':
      this.store.send({ type: 'CHECKOUT_CLOSED' })
      break
    case 'error':
      this.store.send({
        type: 'CHECKOUT_ERROR',
        message: result.errorMessage,
        transactionId: result.transactionId
      })
      break
    }
  }

  /**
   * Called by other plugins (e.g. AI chat) when an upstream API call
   * returned "insufficient credits" / 402. The machine refreshes its
   * data and reveals the panel — the API stays the source of truth.
   */
  reportCreditsExhausted(): void {
    this.store.send({ type: 'CREDITS_EXHAUSTED' })
    void this.loadAccountData()
  }

  /** Manual refresh — called from the error state's retry button. */
  async refresh(): Promise<void> {
    this.store.send({ type: 'REFRESH' })
    await this.loadAccountData()
  }

  // ─── Internals ──────────────────────────────────────────────────

  private async loadCatalog(): Promise<void> {
    try {
      const billingApi: any = await this.call('auth', 'getBillingApi').catch(() => null)
      if (!billingApi) {
        this.store.send({ type: 'CATALOG_FAILED', message: 'Billing API unavailable' })
        return
      }
      const [plansResp, packagesResp] = await Promise.all([
        billingApi.getSubscriptionPlans(),
        billingApi.getCreditPackages()
      ])
      if (!plansResp?.ok || !packagesResp?.ok) {
        this.store.send({
          type: 'CATALOG_FAILED',
          message: plansResp?.error || packagesResp?.error || 'Failed to load catalog'
        })
        return
      }
      this.store.send({
        type: 'CATALOG_LOADED',
        plans: plansResp.data?.plans ?? [],
        packages: packagesResp.data?.packages ?? []
      })
    } catch (err: any) {
      this.store.send({ type: 'CATALOG_FAILED', message: err?.message ?? 'Catalog load failed' })
    }
  }

  private async loadAccountData(): Promise<void> {
    try {
      const [credits, subResp, permissions] = await Promise.all([
        this.call('auth', 'getCredits').catch(() => null) as Promise<any>,
        (async () => {
          const billingApi: any = await this.call('auth', 'getBillingApi').catch(() => null)
          if (!billingApi) return null
          const r = await billingApi.getSubscription()
          return r?.ok ? r.data : null
        })(),
        (async () => {
          const permissionsApi: any = await this.call('auth', 'getPermissionsApi').catch(() => null)
          if (!permissionsApi) return null
          const r = await permissionsApi.getPermissions()
          return r?.ok ? r.data : null
        })()
      ])
      this.store.send({
        type: 'DATA_LOADED',
        credits: credits ?? null,
        subscription: subResp?.subscription ?? null,
        permissions: permissions ?? null
      })
    } catch (err: any) {
      this.store.send({ type: 'DATA_FAILED', message: err?.message ?? 'Failed to load account data' })
    }
  }

  setDispatch(dispatch: React.Dispatch<any>): void {
    this.dispatch = dispatch
    this.renderComponent()
  }

  renderComponent(): void {
    this.dispatch({ plugin: this })
  }

  updateComponent(state: any): JSX.Element {
    return <PlanManagerUI plugin={state.plugin || this} />
  }

  render(): JSX.Element {
    return (
      <div id="planManager" className="h-100">
        <PluginViewWrapper plugin={this} />
      </div>
    )
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   React glue
   ───────────────────────────────────────────────────────────────────────── */

/** Subscribe a component to the store via `useSyncExternalStore`. */
function useStoreSnapshot(plugin: PlanManagerPlugin): PlanManagerSnapshot {
  return useSyncExternalStore(
    plugin.store.subscribe,
    plugin.store.getSnapshot,
    plugin.store.getSnapshot
  )
}

const PlanManagerUI: React.FC<{ plugin: PlanManagerPlugin }> = ({ plugin }) => {
  const snap = useStoreSnapshot(plugin)
  if (!snap.isOpen) return <PlanManagerStub plugin={plugin} />
  return <PlanManagerOverlay plugin={plugin} snap={snap} />
}

const PlanManagerStub: React.FC<{ plugin: PlanManagerPlugin }> = ({ plugin }) => (
  <div className="plan-manager-stub">
    <div className="plan-manager-stub-glyph">
      <i className="fas fa-bolt"></i>
    </div>
    <h5>Plan & Credits</h5>
    <p>Open the manager to inspect plans, top up credits and review your AI usage.</p>
    <button className="plan-manager-stub-btn" onClick={() => plugin.open()}>
      Open manager
    </button>
  </div>
)

/* ─────────────────────────────────────────────────────────────────────────────
   Overlay
   ───────────────────────────────────────────────────────────────────────── */

const PlanManagerOverlay: React.FC<{
  plugin: PlanManagerPlugin
  snap: PlanManagerSnapshot
}> = ({ plugin, snap }) => {
  const [activeSection, setActiveSection] = React.useState<'plans' | 'topup' | 'usage'>('plans')

  // Close-on-Escape — UI concern, stays in React.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') plugin.close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [plugin])

  // Pure derivations — every render reads fresh from the snapshot.
  const planCtx = useMemo(() => selectPlanState(snap), [snap])
  const status = useMemo(() => selectCreditStatus(snap), [snap])
  const activeAlert: ActiveAlert = useMemo(() => selectActiveAlert(snap), [snap])
  const visiblePlans = useMemo(() => selectVisiblePlans(snap), [snap])
  const visiblePackages = useMemo(() => selectVisiblePackages(snap), [snap])
  const canUpgrade = useMemo(() => selectCanUpgrade(snap), [snap])
  const checkoutResult = selectCheckoutResult(snap)

  const refreshDate = formatDate(status.refreshDate)

  return (
    <div className="pm-backdrop" onClick={() => plugin.close()}>
      <div className={`pm-shell pm-shell--${status.state}`} onClick={(e) => e.stopPropagation()}>
        <div className="pm-atmosphere" aria-hidden>
          <div className="pm-atmosphere__orb pm-atmosphere__orb--a" />
          <div className="pm-atmosphere__orb pm-atmosphere__orb--b" />
          <div className="pm-atmosphere__orb pm-atmosphere__orb--c" />
          <div className="pm-atmosphere__grid" />
          <div className="pm-atmosphere__grain" />
        </div>

        <header className="pm-topbar">
          <div className="pm-topbar__brand">
            <span className="pm-topbar__dot" />
            <span className="pm-topbar__eyebrow">Account</span>
            <span className="pm-topbar__sep">/</span>
            <span className="pm-topbar__title">Plan&nbsp;&amp;&nbsp;Credits</span>
          </div>

          <DevSwitchers plugin={plugin} snap={snap} />

          <button className="pm-close" onClick={() => plugin.close()} aria-label="Close">
            <i className="fas fa-times"></i>
          </button>
        </header>

        {checkoutResult && (
          <CheckoutResultScreen
            result={checkoutResult}
            onDismiss={() => plugin.setCheckoutResult(null)}
            onViewPlans={() => { plugin.setCheckoutResult(null); setActiveSection('plans') }}
            onViewTopUps={() => { plugin.setCheckoutResult(null); setActiveSection('topup') }}
          />
        )}

        {!checkoutResult && snap.dataState === 'loading' && <PlanManagerSkeleton />}
        {!checkoutResult && snap.dataState === 'error' && (
          <PlanManagerError
            message={snap.errorMessage}
            onRetry={() => plugin.refresh()}
          />
        )}
        {!checkoutResult && snap.dataState === 'ready' && <>

          {activeAlert === 'beta-transition' && (
            <BetaTransitionAlert
              planCtx={planCtx}
              onUpgrade={() => setActiveSection('plans')}
              onTopUp={() => setActiveSection('topup')}
            />
          )}

          {activeAlert === 'plan-lifecycle' && (
            <PlanLifecycleAlert
              planCtx={planCtx}
              onRenew={() => setActiveSection('plans')}
              onUpgrade={() => setActiveSection('plans')}
            />
          )}

          {activeAlert === 'credit' && (
            <CreditAlert
              status={status}
              refreshDate={refreshDate}
              canUpgrade={canUpgrade}
              onTopUp={() => setActiveSection('topup')}
              onUpgrade={() => setActiveSection('plans')}
            />
          )}

          <Hero
            status={status}
            refreshDate={refreshDate}
            heroCompact={activeAlert === 'beta-transition' || activeAlert === 'plan-lifecycle'}
            onTopUp={() => setActiveSection('topup')}
          />

          <nav className="pm-nav">
            {([
              { id: 'plans', label: 'Plans', icon: 'fas fa-layer-group' },
              { id: 'topup', label: 'Top up', icon: 'fas fa-bolt' },
              { id: 'usage', label: 'Usage breakdown', icon: 'fas fa-chart-bar' }
            ] as const).map(s => (
              <button
                key={s.id}
                className={`pm-nav__item ${activeSection === s.id ? 'is-active' : ''}`}
                onClick={() => setActiveSection(s.id)}
              >
                <i className={s.icon}></i>
                <span>{s.label}</span>
              </button>
            ))}
          </nav>

          <main className="pm-main">
            {activeSection === 'plans' && (
              <PlansSection plans={visiblePlans} currentPlanId={planCtx.planId} />
            )}
            {activeSection === 'topup' && (
              <TopUpSection packages={visiblePackages} />
            )}
            {activeSection === 'usage' && <UsageSection />}
          </main>

        </>}

        <footer className="pm-footer">
          <div className="pm-footer__legal">
            {snap.isAuthenticated
              ? <>Signed in · billing data live</>
              : <>Catalog only · sign in to manage your subscription</>}
          </div>
          <div className="pm-footer__links">
            <a href="https://remix-ide.readthedocs.io/" target="_blank" rel="noreferrer">Docs</a>
            <a href="https://discord.gg/TWfKkZVwJW" target="_blank" rel="noreferrer">Support</a>
          </div>
        </footer>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Hero
   ───────────────────────────────────────────────────────────────────────── */

const Hero: React.FC<{
  status: CreditStatus
  refreshDate: string | null
  heroCompact: boolean
  onTopUp: () => void
}> = ({ status, refreshDate, heroCompact, onTopUp }) => {
  const { remaining, used, total, usedPct, state } = status

  return (
    <section className={`pm-hero pm-hero--${state} ${heroCompact ? 'pm-hero--compact' : ''}`}>
      <div className="pm-hero__left">
        <div className="pm-hero__eyebrow">Credit balance</div>
        <div className="pm-hero__amount">
          <span className="pm-hero__num">{remaining.toLocaleString()}</span>
          <span className="pm-hero__unit">credits</span>
        </div>
        <div className="pm-hero__sub">
          <span className="pm-hero__used">{used.toLocaleString()} used</span>
          <span className="pm-hero__div">·</span>
          <span>{total.toLocaleString()} included this cycle</span>
          {!heroCompact && refreshDate && <>
            <span className="pm-hero__div">·</span>
            <span>refreshes <em>{refreshDate}</em></span>
          </>}
        </div>

        {!heroCompact && (
          <div className="pm-hero__bar">
            <div className="pm-hero__bar-fill" style={{ width: `${usedPct}%` }} />
            <div className="pm-hero__bar-marker" style={{ left: `${usedPct}%` }} />
          </div>
        )}
      </div>

      <div className="pm-hero__right">
        {!heroCompact && (
          <div className="pm-ring" style={{ '--pm-pct': `${usedPct}` } as React.CSSProperties}>
            <div className="pm-ring__inner">
              <div className="pm-ring__pct">{Math.round(usedPct)}<span>%</span></div>
              <div className="pm-ring__caption">consumed</div>
            </div>
          </div>
        )}
        <button className="pm-cta" onClick={onTopUp}>
          <i className="fas fa-bolt"></i> Top&nbsp;up
        </button>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Dev switchers — inject scenarios via DEV_INJECT events
   ───────────────────────────────────────────────────────────────────────── */

const SCENARIOS = {
  credit: {
    label: 'Credits',
    icon: 'fas fa-coins',
    options: [
      { key: 'healthy',  label: 'Healthy',         credits: { balance: 800,  free_credits: 800,  paid_credits: 0 } },
      { key: 'low',      label: 'Low (15%)',       credits: { balance: 150,  free_credits: 150,  paid_credits: 0 } },
      { key: 'critical', label: 'Critical (1.8%)', credits: { balance: 18,   free_credits: 18,   paid_credits: 0 } },
      { key: 'empty',    label: 'Empty',           credits: { balance: 0,    free_credits: 0,    paid_credits: 0 } }
    ] as Array<{ key: string; label: string; credits: any }>
  },
  plan: {
    label: 'Plan',
    icon: 'fas fa-calendar-alt',
    options: [
      { key: 'beta-active',    permissions: makeBetaPermissions(null), subscription: null },
      { key: 'beta-ending',    permissions: makeBetaPermissions(daysFromNow(5)), subscription: null },
      { key: 'beta-ended',     permissions: makeBetaPermissions(daysFromNow(-3)), subscription: null },
      { key: 'paid-active',    permissions: { feature_groups: [], features: {} }, subscription: makeSub('active', 28, false) },
      { key: 'paid-expiring',  permissions: { feature_groups: [], features: {} }, subscription: makeSub('active', 4, true) },
      { key: 'paid-expired',   permissions: { feature_groups: [], features: {} }, subscription: makeSub('canceled', -2, true) }
    ] as Array<{ key: string; permissions: any; subscription: any }>
  }
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

function makeBetaPermissions(expiresAt: string | null) {
  return {
    user_id: 1, group_id: 1, is_authenticated: true, is_admin: false, is_blocked: false,
    feature_groups: [{
      name: 'beta', display_name: 'Beta Testers', description: 'Early access',
      priority: 5, source_type: 'admin_grant',
      starts_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      expires_at: expiresAt, is_recurring: false, grant_reason: null,
      created_at: new Date(Date.now() - 30 * 86_400_000).toISOString()
    }],
    features: {}
  }
}

function makeSub(status: string, daysToEnd: number, cancelled: boolean) {
  const endsAt = daysFromNow(daysToEnd)
  return {
    id: 'sub_dev', status, customerId: 'cus_dev',
    currentBillingPeriod: { startsAt: daysFromNow(daysToEnd - 30), endsAt },
    scheduledChange: cancelled ? { action: 'cancel', effectiveAt: endsAt } : null,
    items: [{ priceId: 'pri_pro', productId: 'pro_pro', description: 'Pro plan',
      quantity: 1, unitPrice: { amount: '2900', currencyCode: 'USD' },
      billingCycle: { interval: 'month', frequency: 1 },
      product: { id: 'pro_pro', name: 'Pro', description: 'Builder', imageUrl: null }
    }],
    nextBilledAt: endsAt, createdAt: '', updatedAt: '', firstBilledAt: '',
    discount: null, collectionMode: 'automatic', billingDetails: null,
    currencyCode: 'USD', planId: 'pro', creditsPerMonth: 1000
  }
}

const DevSwitchers: React.FC<{ plugin: PlanManagerPlugin; snap: PlanManagerSnapshot }> = ({ plugin, snap }) => {
  // Show the dev switchers only in non-production builds. The check is the
  // env hook used elsewhere in the project (NX_NODE_ENV / NODE_ENV).
  // Keep them on for now while we wire real flows; flip to a feature flag
  // once we ship.
  return (
    <div className="pm-scenario-stack">
      <div className="pm-scenario" title="Dev: inject credit scenario">
        <i className={SCENARIOS.credit.icon}></i>
        {SCENARIOS.credit.options.map(o => (
          <button
            key={o.key}
            className="pm-scenario__btn"
            onClick={() => plugin.store.send({ type: 'DEV_INJECT', partial: { credits: o.credits } })}
          >{o.label}</button>
        ))}
      </div>
      <div className="pm-scenario" title="Dev: inject plan scenario">
        <i className={SCENARIOS.plan.icon}></i>
        {SCENARIOS.plan.options.map(o => (
          <button
            key={o.key}
            className="pm-scenario__btn"
            onClick={() => plugin.store.send({
              type: 'DEV_INJECT',
              partial: { permissions: o.permissions, subscription: o.subscription }
            })}
          >{o.key}</button>
        ))}
      </div>
      <div className="pm-scenario" title="Dev: inject data state">
        <i className="fas fa-cloud-download-alt"></i>
        <button className="pm-scenario__btn" onClick={() => plugin.refresh()}>refresh</button>
        <button
          className="pm-scenario__btn"
          onClick={() => plugin.store.send({ type: 'DATA_FAILED', message: 'Simulated failure' })}
        >error</button>
      </div>
      <div className="pm-scenario" title="Dev: inject checkout result">
        <i className="fas fa-credit-card"></i>
        <button
          className={`pm-scenario__btn ${!snap.checkoutResult ? 'is-active' : ''}`}
          onClick={() => plugin.setCheckoutResult(null)}
        >none</button>
        {([
          { kind: 'processing', label: 'processing', intent: 'subscription', itemLabel: 'Builder plan' },
          { kind: 'success',    label: 'success',    intent: 'topup',        itemLabel: '50,000 credits', transactionId: 'txn_01H8…' },
          { kind: 'closed',     label: 'closed',     intent: 'subscription', itemLabel: 'Builder plan' },
          { kind: 'error',      label: 'error',      intent: 'topup',        itemLabel: '50,000 credits',
            errorMessage: 'Your card was declined (insufficient funds).', transactionId: 'txn_01H9…' }
        ] as const).map(s => (
          <button
            key={s.kind}
            className={`pm-scenario__btn ${snap.checkoutResult?.kind === s.kind ? 'is-active' : ''}`}
            onClick={() => plugin.setCheckoutResult({
              kind: s.kind, intent: s.intent, itemLabel: s.itemLabel,
              errorMessage: 'errorMessage' in s ? s.errorMessage : undefined,
              transactionId: 'transactionId' in s ? s.transactionId : undefined
            })}
          >{s.label}</button>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sections
   ───────────────────────────────────────────────────────────────────────── */

const PlansSection: React.FC<{
  plans: any[]
  currentPlanId: string | null
}> = ({ plans, currentPlanId }) => {
  if (plans.length === 0) {
    return (
      <div className="pm-empty">
        <p>No plans available right now.</p>
      </div>
    )
  }
  // Sort cheap → expensive so the upgrade path reads left-to-right.
  const sorted = [...plans].sort((a, b) => (a.priceUsd ?? 0) - (b.priceUsd ?? 0))
  // The mid-priced plan is the "recommended" by default (matches typical SaaS pricing pages).
  const recommendedId = sorted.length >= 3 ? sorted[1].id : null

  return (
    <div className="pm-plans">
      {sorted.map(plan => {
        const isCurrent = plan.id === currentPlanId
        const isRecommended = plan.id === recommendedId
        const accent = pickAccent(plan.id)
        const priceLabel = plan.priceUsd === 0 ? 'Free' : `$${(plan.priceUsd / 100).toFixed(0)}`
        const cadence = plan.priceUsd === 0
          ? 'forever'
          : plan.billingInterval === 'year' ? 'per year' : 'per month'
        return (
          <article
            key={plan.id}
            className={`pm-plan ${isCurrent ? 'is-current' : ''} ${isRecommended ? 'is-recommended' : ''}`}
            style={{ '--pm-accent': accent } as React.CSSProperties}
          >
            {isRecommended && !isCurrent && <div className="pm-plan__ribbon">Recommended</div>}
            {isCurrent && <div className="pm-plan__current">Current</div>}

            <header className="pm-plan__head">
              <div className="pm-plan__name">{plan.name}</div>
              <div className="pm-plan__tag">{plan.description}</div>
            </header>

            <div className="pm-plan__price">
              <span className="pm-plan__price-num">{priceLabel}</span>
              <span className="pm-plan__price-cad">{cadence}</span>
            </div>

            <ul className="pm-plan__features">
              <li>
                <i className="fas fa-check"></i>
                <span>{plan.creditsPerMonth.toLocaleString()} credits / month</span>
              </li>
              {(plan.features ?? []).map((f: string) => (
                <li key={f}>
                  <i className="fas fa-check"></i>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <button
              className={`pm-plan__btn ${isCurrent ? 'is-disabled' : ''}`}
              disabled={isCurrent}
              // TODO: wire to billingApi.subscribe() + paddle checkout when
              // we move the purchase flow inside this plugin.
            >
              {isCurrent ? 'Active' : `Switch to ${plan.name}`}
            </button>
          </article>
        )
      })}
    </div>
  )
}

const TopUpSection: React.FC<{ packages: any[] }> = ({ packages }) => {
  if (packages.length === 0) {
    return (
      <div className="pm-empty">
        <p>No top-up packages available right now.</p>
      </div>
    )
  }
  return (
    <div className="pm-topup">
      <div className="pm-topup__intro">
        <h3>One-off credits</h3>
        <p>Top up without changing your plan. Credits never expire.</p>
      </div>
      <div className="pm-topup__grid">
        {packages.map(t => {
          const price = `$${(t.priceUsd / 100).toFixed(0)}`
          const perK = ((t.priceUsd / 100) / (t.credits / 1000)).toFixed(2)
          return (
            <button key={t.id} className={`pm-topup__card ${t.popular ? 'is-popular' : ''}`}>
              {t.popular && <div className="pm-topup__pop">Best value</div>}
              <div className="pm-topup__credits">
                <span className="pm-topup__credits-num">{t.credits.toLocaleString()}</span>
                <span className="pm-topup__credits-unit">credits</span>
              </div>
              <div className="pm-topup__price">{price}</div>
              <div className="pm-topup__perk">${perK} per 1k credits</div>
              <span className="pm-topup__buy">
                Buy <i className="fas fa-arrow-right"></i>
              </span>
            </button>
          )
        })}
      </div>
      <div className="pm-topup__custom">
        <span>Need a custom amount?</span>
        <a href="mailto:remix@ethereum.org">Contact us</a>
      </div>
    </div>
  )
}

const UsageSection: React.FC = () => (
  <div className="pm-empty">
    <div className="pm-empty__icon">
      <i className="fas fa-chart-bar"></i>
    </div>
    <div className="pm-empty__title">Per-model usage coming soon</div>
    <p className="pm-empty__body">
      We're working on a detailed breakdown of credits and tokens per model. For
      now, total consumption is shown in the credit balance hero above.
    </p>
  </div>
)

/* ─────────────────────────────────────────────────────────────────────────────
   Alerts
   ───────────────────────────────────────────────────────────────────────── */

const ALERT_COPY: Record<Exclude<CreditState, 'healthy' | 'unknown'>, {
  eyebrow: string
  title: (n: number) => string
  body: (refresh: string | null) => string
  icon: string
}> = {
  low: {
    eyebrow: 'Running low',
    title: (n) => `${n.toLocaleString()} credits left`,
    body: (r) => `You'll likely run out${r ? ` before your refill on ${r}` : ''}. Top up or upgrade to keep your AI workflows uninterrupted.`,
    icon: 'fas fa-exclamation'
  },
  critical: {
    eyebrow: 'Almost out',
    title: (n) => `Only ${n.toLocaleString()} credits remain`,
    body: (r) => `Your next AI request may not complete. Add credits now or upgrade your plan${r ? ` — refill is on ${r}` : ''}.`,
    icon: 'fas fa-exclamation-triangle'
  },
  empty: {
    eyebrow: 'Out of credits',
    title: () => 'You\'ve used all your credits',
    body: (r) => `AI features are paused until you top up, upgrade your plan${r ? `, or your free allowance refills on ${r}` : ''}.`,
    icon: 'fas fa-bolt'
  }
}

const CreditAlert: React.FC<{
  status: CreditStatus
  refreshDate: string | null
  canUpgrade: boolean
  onTopUp: () => void
  onUpgrade: () => void
}> = ({ status, refreshDate, canUpgrade, onTopUp, onUpgrade }) => {
  if (status.state === 'healthy' || status.state === 'unknown') return null
  const copy = ALERT_COPY[status.state]

  return (
    <section className={`pm-alert pm-alert--${status.state}`}>
      <div className="pm-alert__glow" aria-hidden />
      <div className="pm-alert__icon">
        <i className={copy.icon}></i>
      </div>
      <div className="pm-alert__body">
        <div className="pm-alert__eyebrow">{copy.eyebrow}</div>
        <div className="pm-alert__title">{copy.title(status.remaining)}</div>
        <p className="pm-alert__desc">{copy.body(refreshDate)}</p>
      </div>
      <div className="pm-alert__actions">
        {canUpgrade && (
          <button className="pm-alert__btn pm-alert__btn--ghost" onClick={onUpgrade}>
            <i className="fas fa-arrow-up"></i> Upgrade plan
          </button>
        )}
        <button className="pm-alert__btn pm-alert__btn--solid" onClick={onTopUp}>
          <i className="fas fa-bolt"></i> Buy credits
        </button>
      </div>
    </section>
  )
}

const PLAN_ALERT_COPY: Record<Exclude<PlanLifecycle, 'active'>, {
  eyebrow: string
  title: (planName: string, days: number) => string
  body: (planName: string, days: number, isCancelled: boolean) => string
  icon: string
}> = {
  expiring: {
    eyebrow: 'Renewal needed',
    title: (plan, days) =>
      days <= 1 ? `${plan} ends tomorrow` : `${plan} ends in ${days} days`,
    body: (_plan, _days, isCancelled) =>
      isCancelled
        ? 'Your subscription is set to cancel. Renew now to keep your AI credits, project history, and team access without interruption.'
        : 'Your billing cycle is closing. Confirm your plan or step up to a higher tier before access pauses.',
    icon: 'fas fa-hourglass-half'
  },
  expired: {
    eyebrow: 'Plan expired',
    title: (plan, days) =>
      `${plan} ended ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`,
    body: () =>
      'AI features and premium tooling are paused. Renew to pick up where you left off, or upgrade to unlock more credits and capacity.',
    icon: 'fas fa-circle-exclamation'
  }
}

const PlanLifecycleAlert: React.FC<{
  planCtx: PlanState
  onRenew: () => void
  onUpgrade: () => void
}> = ({ planCtx, onRenew, onUpgrade }) => {
  if (planCtx.lifecycle === 'active') return null
  const copy = PLAN_ALERT_COPY[planCtx.lifecycle]
  const variant = planCtx.lifecycle

  return (
    <section className={`pm-alert pm-alert--plan pm-alert--plan-${variant}`}>
      <div className="pm-alert__glow" aria-hidden />
      <div className="pm-alert__icon">
        <i className={copy.icon}></i>
      </div>
      <div className="pm-alert__body">
        <div className="pm-alert__eyebrow">{copy.eyebrow}</div>
        <div className="pm-alert__title">
          {copy.title(planCtx.planName, planCtx.daysUntilExpiry)}
        </div>
        <p className="pm-alert__desc">
          {copy.body(planCtx.planName, planCtx.daysUntilExpiry, planCtx.isCancelled)}
          {planCtx.expiresOn && <> <span className="pm-alert__meta">Expired on {formatDate(planCtx.expiresOn)}.</span></>}
        </p>
      </div>
      <div className="pm-alert__actions">
        <button className="pm-alert__btn pm-alert__btn--ghost" onClick={onUpgrade}>
          <i className="fas fa-arrow-up"></i> Upgrade plan
        </button>
        <button className="pm-alert__btn pm-alert__btn--solid" onClick={onRenew}>
          <i className="fas fa-rotate-right"></i>
          {planCtx.lifecycle === 'expired' ? ' Renew plan' : ' Keep my plan'}
        </button>
      </div>
    </section>
  )
}

const BETA_ALERT_COPY: Record<Exclude<PlanLifecycle, 'active'>, {
  eyebrow: string
  title: string
  lede: (days: number, expiresOn: string | null) => string
  body: string
  primary: string
  secondary: string
}> = {
  expiring: {
    eyebrow: 'Beta program',
    title: 'Thanks for shaping Remix.',
    lede: (days, expiresOn) =>
      `The free beta wraps up ${days <= 1 ? 'tomorrow' : `in ${days} days`}${expiresOn ? ` (${formatDate(expiresOn)})` : ''}. Your feedback got us here — now it's time to pick a plan that fits how you build.`,
    body: 'Pick any paid tier before your beta ends and your projects, history, and AI credits keep flowing without a hiccup. As a thank-you, your first month carries over a bonus credit pack.',
    primary: 'See paid plans',
    secondary: 'Top up credits'
  },
  expired: {
    eyebrow: 'Beta has ended',
    title: 'You helped build this. Let\'s keep going.',
    lede: (days, expiresOn) =>
      `The beta ended ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago${expiresOn ? ` (${formatDate(expiresOn)})` : ''}. AI features are paused while you choose a plan — your workspaces and history are safe and waiting.`,
    body: 'Pick a paid plan to switch everything back on. Beta testers get a one-time bonus credit pack on their first paid month — our way of saying thanks for being early.',
    primary: 'Choose a plan',
    secondary: 'Top up credits'
  }
}

const BetaTransitionAlert: React.FC<{
  planCtx: PlanState
  onUpgrade: () => void
  onTopUp: () => void
}> = ({ planCtx, onUpgrade, onTopUp }) => {
  if (planCtx.lifecycle === 'active') return null
  const copy = BETA_ALERT_COPY[planCtx.lifecycle]
  const variant = planCtx.lifecycle

  return (
    <section className={`pm-beta-alert pm-beta-alert--${variant}`}>
      <div className="pm-beta-alert__aurora" aria-hidden />
      <div className="pm-beta-alert__sparkles" aria-hidden>
        <span></span><span></span><span></span><span></span>
      </div>
      <div className="pm-beta-alert__inner">
        <div className="pm-beta-alert__badge">
          <i className="fas fa-seedling"></i>
          <span>{copy.eyebrow}</span>
        </div>
        <h2 className="pm-beta-alert__title">{copy.title}</h2>
        <p className="pm-beta-alert__lede">
          {copy.lede(planCtx.daysUntilExpiry, planCtx.expiresOn)}
        </p>
        <p className="pm-beta-alert__body">{copy.body}</p>
        <div className="pm-beta-alert__actions">
          <button className="pm-beta-alert__btn pm-beta-alert__btn--primary" onClick={onUpgrade}>
            <i className="fas fa-arrow-right"></i> {copy.primary}
          </button>
          <button className="pm-beta-alert__btn pm-beta-alert__btn--ghost" onClick={onTopUp}>
            <i className="fas fa-bolt"></i> {copy.secondary}
          </button>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Loading + error
   ───────────────────────────────────────────────────────────────────────── */

const PlanManagerSkeleton: React.FC = () => (
  <div className="pm-skeleton" aria-busy="true" aria-label="Loading billing information">
    <div className="pm-skeleton__hero">
      <div className="pm-skel pm-skel--eyebrow" />
      <div className="pm-skel pm-skel--num" />
      <div className="pm-skel pm-skel--sub" />
      <div className="pm-skel pm-skel--bar" />
    </div>
    <div className="pm-skeleton__nav">
      <div className="pm-skel pm-skel--tab" />
      <div className="pm-skel pm-skel--tab" />
      <div className="pm-skel pm-skel--tab" />
    </div>
    <div className="pm-skeleton__cards">
      {[0, 1, 2].map(i => (
        <div key={i} className="pm-skeleton__card">
          <div className="pm-skel pm-skel--title" />
          <div className="pm-skel pm-skel--line" />
          <div className="pm-skel pm-skel--price" />
          <div className="pm-skel pm-skel--line pm-skel--short" />
          <div className="pm-skel pm-skel--line pm-skel--short" />
          <div className="pm-skel pm-skel--line pm-skel--short" />
          <div className="pm-skel pm-skel--btn" />
        </div>
      ))}
    </div>
  </div>
)

const PlanManagerError: React.FC<{ message?: string | null; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="pm-empty pm-empty--error">
    <div className="pm-empty__icon">
      <i className="fas fa-cloud-exclamation"></i>
    </div>
    <div className="pm-empty__title">We couldn't load your billing details</div>
    <p className="pm-empty__body">
      {message
        ? <>The billing service responded with: <code>{message}</code>. Your plan and credits are safe — this is just a display issue.</>
        : <>The billing service didn't respond. Your plan and credits are safe — this is just a display issue. Try again in a moment, or check your connection.</>}
    </p>
    <div className="pm-empty__actions">
      <button className="pm-empty__btn pm-empty__btn--primary" onClick={onRetry}>
        <i className="fas fa-rotate-right"></i> Try again
      </button>
      <a
        className="pm-empty__btn pm-empty__btn--ghost"
        href="https://status.remix-project.org"
        target="_blank"
        rel="noreferrer"
      >
        <i className="fas fa-arrow-up-right-from-square"></i> Service status
      </a>
    </div>
  </div>
)

/* ─────────────────────────────────────────────────────────────────────────────
   Checkout result screen
   ───────────────────────────────────────────────────────────────────────── */

const CHECKOUT_COPY: Record<CheckoutResultKind, {
  eyebrow: string
  icon: string
  title: (intent: string, itemLabel?: string) => string
  body: (intent: string, itemLabel?: string) => string
}> = {
  processing: {
    eyebrow: 'Processing',
    icon: 'fas fa-spinner fa-spin',
    title: () => 'Confirming your payment…',
    body: (_intent, item) =>
      `We're waiting for confirmation from the payment processor${item ? ` for ${item}` : ''}. This usually takes a few seconds — feel free to keep this open or close it; we'll notify you when it lands.`
  },
  success: {
    eyebrow: 'Payment confirmed',
    icon: 'fas fa-check',
    title: (intent, item) =>
      intent === 'topup' ? `${item || 'Credits'} added to your account` :
        intent === 'subscription' ? `Welcome to ${item || 'your new plan'}` :
          'Purchase confirmed',
    body: (intent) =>
      intent === 'topup'
        ? 'Your balance has been updated. AI workflows are ready to go.'
        : intent === 'subscription'
          ? 'Your plan is active. New limits, integrations, and credits are available now.'
          : 'You can start using your new entitlements right away.'
  },
  closed: {
    eyebrow: 'Checkout cancelled',
    icon: 'fas fa-arrow-left',
    title: () => 'No payment was made',
    body: (intent) =>
      intent === 'topup'
        ? 'You closed the checkout before completing the purchase. No card was charged. Pick a top-up amount whenever you\'re ready.'
        : 'You closed the checkout before completing the upgrade. Your current plan is unchanged. Take another look at the options below when you\'re ready.'
  },
  error: {
    eyebrow: 'Payment failed',
    icon: 'fas fa-circle-exclamation',
    title: () => 'We couldn\'t complete your payment',
    body: (intent) =>
      intent === 'topup'
        ? 'Your top-up didn\'t go through. No credits were added and no card was charged.'
        : 'Your subscription change didn\'t go through. Your current plan is unchanged and no card was charged.'
  }
}

const CheckoutResultScreen: React.FC<{
  result: CheckoutResult
  onDismiss: () => void
  onViewPlans: () => void
  onViewTopUps: () => void
}> = ({ result, onDismiss, onViewPlans, onViewTopUps }) => {
  const copy = CHECKOUT_COPY[result.kind]
  const tryAgain = result.intent === 'topup' ? onViewTopUps : onViewPlans
  const tryAgainLabel = result.intent === 'topup' ? 'Choose a top-up' : 'Back to plans'

  return (
    <section className={`pm-result pm-result--${result.kind}`}>
      <div className={`pm-result__halo pm-result__halo--${result.kind}`} aria-hidden />

      <div className={`pm-result__icon pm-result__icon--${result.kind}`}>
        <i className={copy.icon}></i>
      </div>

      <div className="pm-result__eyebrow">{copy.eyebrow}</div>
      <h2 className="pm-result__title">{copy.title(result.intent, result.itemLabel)}</h2>
      <p className="pm-result__body">{copy.body(result.intent, result.itemLabel)}</p>

      {result.kind === 'error' && result.errorMessage && (
        <div className="pm-result__detail">
          <i className="fas fa-info-circle"></i>
          <span>{result.errorMessage}</span>
        </div>
      )}

      {result.transactionId && (
        <div className="pm-result__txn">
          <span className="pm-result__txn-label">Reference</span>
          <code className="pm-result__txn-id">{result.transactionId}</code>
        </div>
      )}

      <div className="pm-result__actions">
        {result.kind === 'success' && (
          <button className="pm-result__btn pm-result__btn--primary" onClick={onDismiss}>
            <i className="fas fa-arrow-right"></i> Continue
          </button>
        )}

        {result.kind === 'closed' && (
          <>
            <button className="pm-result__btn pm-result__btn--primary" onClick={tryAgain}>
              <i className="fas fa-arrow-left"></i> {tryAgainLabel}
            </button>
            <button className="pm-result__btn pm-result__btn--ghost" onClick={onDismiss}>
              Dismiss
            </button>
          </>
        )}

        {result.kind === 'error' && (
          <>
            <button className="pm-result__btn pm-result__btn--primary" onClick={tryAgain}>
              <i className="fas fa-rotate-right"></i> Try again
            </button>
            <a
              className="pm-result__btn pm-result__btn--ghost"
              href="https://discord.gg/TWfKkZVwJW"
              target="_blank"
              rel="noreferrer"
            >
              <i className="fas fa-life-ring"></i> Contact support
            </a>
          </>
        )}

        {result.kind === 'processing' && (
          <button className="pm-result__btn pm-result__btn--ghost" onClick={onDismiss}>
            Close — I'll wait
          </button>
        )}
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────────────────── */

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const PLAN_ACCENTS = ['#2fbfb1', '#5b9cf5', '#9b7dff', '#f59f5b', '#e75b89']
function pickAccent(planId: string): string {
  let h = 0
  for (let i = 0; i < planId.length; i++) h = (h * 31 + planId.charCodeAt(i)) >>> 0
  return PLAN_ACCENTS[h % PLAN_ACCENTS.length]
}
