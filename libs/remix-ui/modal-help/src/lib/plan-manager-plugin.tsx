import { ViewPlugin } from '@remixproject/engine-web'
import React, { useEffect, useMemo, useState } from 'react'
import { PluginViewWrapper } from '@remix-ui/helper'
import * as packageJson from '../../../../../package.json'

import './plan-manager.css'

const PLAN_ICON = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a2a3bd" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 6v6c0 5 3.4 9.5 8 10 4.6-.5 8-5 8-10V6l-8-4z"/><path d="M9 12l2 2 4-4"/></svg>`)

const profile = {
  name: 'planManager',
  displayName: 'Plan & Credits',
  description: 'Manage your subscription, top up credits and review AI usage',
  methods: ['open', 'close', 'toggle', 'setCheckoutResult'],
  events: ['opened', 'closed', 'checkoutResultChanged'],
  icon: PLAN_ICON,
  location: 'sidePanel',
  version: packageJson.version,
  maintainedBy: 'Remix'
}

/**
 * Outcome of a Paddle checkout, surfaced as an in-overlay screen so the user
 * lands somewhere meaningful after the Paddle modal closes.
 * - 'processing' : modal closed, webhook still pending (optimistic state)
 * - 'success'    : checkout.completed, plan/credits applied
 * - 'closed'     : checkout.closed without completion (no charge)
 * - 'error'      : checkout.error / payment declined / 3DS failed
 */
export type CheckoutResultKind = 'processing' | 'success' | 'closed' | 'error'

export interface CheckoutResult {
  kind: CheckoutResultKind
  /** What was being purchased — drives copy. */
  intent: 'subscription' | 'topup' | 'feature'
  /** Human-readable summary, e.g. "Builder plan" or "50,000 credits". */
  itemLabel?: string
  /** Error message from Paddle, if kind === 'error'. */
  errorMessage?: string
  /** Optional Paddle transaction id for support reference. */
  transactionId?: string
}

export class PlanManagerPlugin extends ViewPlugin {
  dispatch: React.Dispatch<any> = () => {}
  private _isOpen = false
  private _checkoutResult: CheckoutResult | null = null

  constructor() {
    super(profile)
  }

  async onActivation(): Promise<void> {
    this.renderComponent()
  }

  async open(): Promise<void> {
    this._isOpen = true
    this.renderComponent()
    this.emit('opened')
    try {
      await this.call('menuicons', 'select', 'planManager')
    } catch { /* noop */ }
  }

  close(): void {
    this._isOpen = false
    this.renderComponent()
    this.emit('closed')
  }

  toggle(): void {
    if (this._isOpen) this.close()
    else this.open()
  }

  get isOpen(): boolean {
    return this._isOpen
  }

  /**
   * Surface a Paddle checkout outcome inside the overlay. Auto-opens the panel
   * if it isn't already, so the user always sees the result.
   * Pass null to clear the screen.
   */
  setCheckoutResult(result: CheckoutResult | null): void {
    this._checkoutResult = result
    if (result) this.open()
    else this.renderComponent()
    this.emit('checkoutResultChanged', result)
  }

  get checkoutResult(): CheckoutResult | null {
    return this._checkoutResult
  }

  /** Internal: clear without re-emitting open/close. */
  clearCheckoutResult(): void {
    this._checkoutResult = null
    this.renderComponent()
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
   MOCK DATA — to be replaced with real billing/usage APIs
   ───────────────────────────────────────────────────────────────────────── */

interface PlanDef {
  id: string
  name: string
  tagline: string
  priceLabel: string
  cadence: string
  features: string[]
  highlight?: string
  accent: string
  recommended?: boolean
}

const MOCK_PLANS: PlanDef[] = [
  {
    id: 'beta',
    name: 'Beta Tester',
    tagline: 'You — shaping the future of Remix',
    priceLabel: 'Free',
    cadence: 'while in beta',
    accent: '#2fbfb1',
    features: [
      'Early access to every new module',
      '50 000 AI credits / month included',
      'Priority feedback channel',
      'Cloud workspaces (limited)'
    ],
    highlight: 'Current plan'
  },
  {
    id: 'pro',
    name: 'Builder',
    tagline: 'For solo devs shipping production contracts',
    priceLabel: '$19',
    cadence: 'per month',
    accent: '#5b9cf5',
    features: [
      '250 000 AI credits / month',
      'Unlimited cloud workspaces',
      'All MCP integrations',
      'Standard support'
    ],
    recommended: true
  },
  {
    id: 'studio',
    name: 'Studio',
    tagline: 'Teams that need higher throughput',
    priceLabel: '$79',
    cadence: 'per month',
    accent: '#9b7dff',
    features: [
      '1 500 000 AI credits / month',
      'Seats for up to 5 collaborators',
      'Frontier model access (GPT-4 / Claude Opus)',
      'Slack & priority support'
    ]
  }
]

const MOCK_TOPUPS = [
  { id: 'tu-25', credits: 25_000, price: '$5', perK: '0.20' },
  { id: 'tu-100', credits: 100_000, price: '$15', perK: '0.15', popular: true },
  { id: 'tu-500', credits: 500_000, price: '$60', perK: '0.12' }
]

interface ModelUsage {
  id: string
  label: string
  vendor: string
  credits: number
  tokens: number
  color: string
}

const MOCK_USAGE: ModelUsage[] = [
  { id: 'gpt-4o', label: 'GPT-4o', vendor: 'OpenAI', credits: 12_400, tokens: 4_120_000, color: '#10a37f' },
  { id: 'claude-sonnet', label: 'Claude 3.5 Sonnet', vendor: 'Anthropic', credits: 8_950, tokens: 2_770_000, color: '#d97757' },
  { id: 'mistral-large', label: 'Mistral Large', vendor: 'Mistral', credits: 4_120, tokens: 1_980_000, color: '#ff6f3c' },
  { id: 'llama-3-70b', label: 'Llama 3 70B', vendor: 'Meta', credits: 1_380, tokens: 1_540_000, color: '#1877f2' },
  { id: 'gemini-pro', label: 'Gemini 1.5 Pro', vendor: 'Google', credits: 540, tokens: 410_000, color: '#fbbc04' }
]

const MOCK_BALANCE = {
  total: 50_000,
  used: 27_390,
  refreshDate: 'May 14, 2026'
}

/* ─────────────────────────────────────────────────────────────────────────────
   Credit state — derived severity
   ───────────────────────────────────────────────────────────────────────── */

type CreditState = 'healthy' | 'low' | 'critical' | 'empty'

const LOW_THRESHOLD = 0.20      // <20% remaining → "low"
const CRITICAL_THRESHOLD = 0.05 // <5% remaining → "critical"

interface CreditStatus {
  state: CreditState
  remaining: number
  total: number
  used: number
  usedPct: number
  remainingPct: number
}

function deriveCreditStatus(total: number, used: number): CreditStatus {
  const remaining = Math.max(0, total - used)
  const remainingPct = total > 0 ? remaining / total : 0
  const usedPct = Math.min(100, total > 0 ? (used / total) * 100 : 0)

  let state: CreditState = 'healthy'
  if (remaining <= 0) state = 'empty'
  else if (remainingPct < CRITICAL_THRESHOLD) state = 'critical'
  else if (remainingPct < LOW_THRESHOLD) state = 'low'

  return { state, remaining, total, used, usedPct, remainingPct }
}

/* Dev preview — cycle through balance scenarios */
const MOCK_SCENARIOS: Record<string, { total: number; used: number; label: string }> = {
  healthy:  { total: 50_000, used: 27_390, label: 'Healthy' },
  low:      { total: 50_000, used: 42_500, label: 'Low (15%)' },
  critical: { total: 50_000, used: 49_100, label: 'Critical (1.8%)' },
  empty:    { total: 50_000, used: 50_000, label: 'Empty' }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Plan lifecycle state
   ───────────────────────────────────────────────────────────────────────── */

type PlanLifecycle = 'active' | 'expiring' | 'expired'

const EXPIRING_DAYS = 7 // ≤ 7 days → 'expiring'

interface PlanContext {
  planId: string
  planName: string
  isBeta: boolean
  isCancelled: boolean   // user already cancelled, will not auto-renew
  daysUntilExpiry: number  // negative means already expired
  expiresOn: string
  lifecycle: PlanLifecycle
}

function derivePlanLifecycle(daysUntilExpiry: number): PlanLifecycle {
  if (daysUntilExpiry < 0) return 'expired'
  if (daysUntilExpiry <= EXPIRING_DAYS) return 'expiring'
  return 'active'
}

/* Dev preview — plan lifecycle scenarios */
const MOCK_PLAN_SCENARIOS: Record<string, Omit<PlanContext, 'lifecycle'>> = {
  'beta-active': {
    planId: 'beta', planName: 'Beta Tester', isBeta: true, isCancelled: false,
    daysUntilExpiry: 42, expiresOn: 'Jun 12, 2026'
  },
  'beta-ending': {
    planId: 'beta', planName: 'Beta Tester', isBeta: true, isCancelled: false,
    daysUntilExpiry: 5, expiresOn: 'May 6, 2026'
  },
  'beta-ended': {
    planId: 'beta', planName: 'Beta Tester', isBeta: true, isCancelled: false,
    daysUntilExpiry: -3, expiresOn: 'Apr 28, 2026'
  },
  'paid-active': {
    planId: 'pro', planName: 'Builder', isBeta: false, isCancelled: false,
    daysUntilExpiry: 28, expiresOn: 'May 29, 2026'
  },
  'paid-expiring': {
    planId: 'pro', planName: 'Builder', isBeta: false, isCancelled: true,
    daysUntilExpiry: 4, expiresOn: 'May 5, 2026'
  },
  'paid-expired': {
    planId: 'pro', planName: 'Builder', isBeta: false, isCancelled: true,
    daysUntilExpiry: -2, expiresOn: 'Apr 29, 2026'
  }
}

function buildPlanContext(key: keyof typeof MOCK_PLAN_SCENARIOS): PlanContext {
  const base = MOCK_PLAN_SCENARIOS[key]
  return { ...base, lifecycle: derivePlanLifecycle(base.daysUntilExpiry) }
}

/* ─────────────────────────────────────────────────────────────────────────────
   UI
   ───────────────────────────────────────────────────────────────────────── */

const PlanManagerUI: React.FC<{ plugin: PlanManagerPlugin }> = ({ plugin }) => {
  if (!plugin.isOpen) return <PlanManagerStub plugin={plugin} />
  return <PlanManagerOverlay plugin={plugin} />
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

const PlanManagerOverlay: React.FC<{ plugin: PlanManagerPlugin }> = ({ plugin }) => {
  const [activeSection, setActiveSection] = useState<'plans' | 'topup' | 'usage'>('plans')
  const [scenario, setScenario] = useState<keyof typeof MOCK_SCENARIOS>('healthy')
  const [planScenario, setPlanScenario] = useState<keyof typeof MOCK_PLAN_SCENARIOS>('beta-active')
  // Data fetch state. When wiring real APIs, drive this from the actual fetch lifecycle.
  // 'ready' is the default for the mocked layer so dev preview keeps working.
  const [dataState, setDataState] = useState<'loading' | 'error' | 'ready'>('ready')

  // Read the current checkout result directly off the plugin. setCheckoutResult()
  // triggers a re-dispatch on the plugin, which re-renders this component.
  const checkoutResult = plugin.checkoutResult

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') plugin.close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [plugin])

  const live = MOCK_SCENARIOS[scenario]
  const status = deriveCreditStatus(live.total, live.used)
  const planCtx = useMemo(() => buildPlanContext(planScenario), [planScenario])
  const { remaining, used, total, usedPct, state } = status
  const refreshDate = MOCK_BALANCE.refreshDate
  const canUpgrade = planCtx.planId !== 'studio' // top tier can't upgrade further

  // Severity hierarchy decides which alert wins (only one shown at top).
  // Plan-level (expired/expiring) outranks credit-level for paid users; for beta we always
  // show the beta-transition card when the beta is ending or ended.
  const showBetaAlert = planCtx.isBeta && planCtx.lifecycle !== 'active'
  const showPlanAlert = !planCtx.isBeta && planCtx.lifecycle !== 'active'
  const showCreditAlert = !showBetaAlert && !showPlanAlert && status.state !== 'healthy'

  const totalUsageCredits = useMemo(
    () => MOCK_USAGE.reduce((s, u) => s + u.credits, 0),
    []
  )

  return (
    <div className="pm-backdrop" onClick={() => plugin.close()}>
      <div className={`pm-shell pm-shell--${state}`} onClick={(e) => e.stopPropagation()}>
        {/* Atmospheric background */}
        <div className="pm-atmosphere" aria-hidden>
          <div className="pm-atmosphere__orb pm-atmosphere__orb--a" />
          <div className="pm-atmosphere__orb pm-atmosphere__orb--b" />
          <div className="pm-atmosphere__orb pm-atmosphere__orb--c" />
          <div className="pm-atmosphere__grid" />
          <div className="pm-atmosphere__grain" />
        </div>

        {/* Top bar */}
        <header className="pm-topbar">
          <div className="pm-topbar__brand">
            <span className="pm-topbar__dot" />
            <span className="pm-topbar__eyebrow">Account</span>
            <span className="pm-topbar__sep">/</span>
            <span className="pm-topbar__title">Plan&nbsp;&amp;&nbsp;Credits</span>
          </div>

          {/* Dev scenario switchers — remove when wiring real API */}
          <div className="pm-scenario-stack">
            <div className="pm-scenario" title="Dev: preview credit states">
              <i className="fas fa-coins"></i>
              {(Object.keys(MOCK_SCENARIOS) as Array<keyof typeof MOCK_SCENARIOS>).map(k => (
                <button
                  key={k}
                  className={`pm-scenario__btn ${scenario === k ? 'is-active' : ''}`}
                  onClick={() => setScenario(k)}
                >{MOCK_SCENARIOS[k].label}</button>
              ))}
            </div>
            <div className="pm-scenario" title="Dev: preview plan lifecycle">
              <i className="fas fa-calendar-alt"></i>
              {(Object.keys(MOCK_PLAN_SCENARIOS) as Array<keyof typeof MOCK_PLAN_SCENARIOS>).map(k => (
                <button
                  key={k}
                  className={`pm-scenario__btn ${planScenario === k ? 'is-active' : ''}`}
                  onClick={() => setPlanScenario(k)}
                >{k}</button>
              ))}
            </div>
            <div className="pm-scenario" title="Dev: preview data fetch state">
              <i className="fas fa-cloud-download-alt"></i>
              {(['ready', 'loading', 'error'] as const).map(k => (
                <button
                  key={k}
                  className={`pm-scenario__btn ${dataState === k ? 'is-active' : ''}`}
                  onClick={() => setDataState(k)}
                >{k}</button>
              ))}
            </div>
            <div className="pm-scenario" title="Dev: preview checkout result">
              <i className="fas fa-credit-card"></i>
              <button
                className={`pm-scenario__btn ${!checkoutResult ? 'is-active' : ''}`}
                onClick={() => plugin.setCheckoutResult(null)}
              >none</button>
              {([
                { kind: 'processing', label: 'processing', intent: 'subscription', itemLabel: 'Builder plan' },
                { kind: 'success',    label: 'success',    intent: 'topup',        itemLabel: '50,000 credits', transactionId: 'txn_01H8…' },
                { kind: 'closed',     label: 'closed',     intent: 'subscription', itemLabel: 'Builder plan' },
                { kind: 'error',      label: 'error',      intent: 'topup',        itemLabel: '50,000 credits',
                  errorMessage: 'Your card was declined (insufficient funds).', transactionId: 'txn_01H9…' },
              ] as const).map(s => (
                <button
                  key={s.kind}
                  className={`pm-scenario__btn ${checkoutResult?.kind === s.kind ? 'is-active' : ''}`}
                  onClick={() => plugin.setCheckoutResult({
                    kind: s.kind,
                    intent: s.intent,
                    itemLabel: s.itemLabel,
                    errorMessage: 'errorMessage' in s ? s.errorMessage : undefined,
                    transactionId: 'transactionId' in s ? s.transactionId : undefined,
                  })}
                >{s.label}</button>
              ))}
            </div>
          </div>

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

        {!checkoutResult && dataState === 'loading' && <PlanManagerSkeleton />}
        {!checkoutResult && dataState === 'error' && <PlanManagerError onRetry={() => setDataState('ready')} />}
        {!checkoutResult && dataState === 'ready' && <>

        {/* Beta transition (highest priority for beta users) */}
        {showBetaAlert && (
          <BetaTransitionAlert
            planCtx={planCtx}
            onUpgrade={() => setActiveSection('plans')}
            onTopUp={() => setActiveSection('topup')}
          />
        )}

        {/* Plan lifecycle alert (paid users) */}
        {showPlanAlert && (
          <PlanLifecycleAlert
            planCtx={planCtx}
            onRenew={() => setActiveSection('plans')}
            onUpgrade={() => setActiveSection('plans')}
          />
        )}

        {/* Credit alert (when no plan-level alert is active) */}
        {showCreditAlert && (
          <CreditAlert
            status={status}
            refreshDate={refreshDate}
            canUpgrade={canUpgrade}
            onTopUp={() => setActiveSection('topup')}
            onUpgrade={() => setActiveSection('plans')}
          />
        )}

        {/* Hero — credits balance. Collapses to a slim strip when a top-level alert is shown. */}
        {(() => {
          const heroCompact = showBetaAlert || showPlanAlert
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
                  {!heroCompact && <>
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
                <button
                  className="pm-cta"
                  onClick={() => setActiveSection('topup')}
                >
                  <i className="fas fa-bolt"></i> Top&nbsp;up
                </button>
              </div>
            </section>
          )
        })()}

        {/* Section nav */}
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

        {/* Sections */}
        <main className="pm-main">
          {activeSection === 'plans' && <PlansSection />}
          {activeSection === 'topup' && <TopUpSection />}
          {activeSection === 'usage' && <UsageSection totalCredits={totalUsageCredits} />}
        </main>

        </>}

        {/* Footer */}
        <footer className="pm-footer">
          <div className="pm-footer__legal">
            Mocked view · Wire to <code>billing</code> &amp; <code>usage</code> APIs to go live
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

/* ─── Plans section ─── */

const PlansSection: React.FC = () => (
  <div className="pm-plans">
    {MOCK_PLANS.map(plan => {
      const isCurrent = !!plan.highlight
      return (
        <article
          key={plan.id}
          className={`pm-plan ${isCurrent ? 'is-current' : ''} ${plan.recommended ? 'is-recommended' : ''}`}
          style={{ '--pm-accent': plan.accent } as React.CSSProperties}
        >
          {plan.recommended && <div className="pm-plan__ribbon">Recommended</div>}
          {isCurrent && <div className="pm-plan__current">Current</div>}

          <header className="pm-plan__head">
            <div className="pm-plan__name">{plan.name}</div>
            <div className="pm-plan__tag">{plan.tagline}</div>
          </header>

          <div className="pm-plan__price">
            <span className="pm-plan__price-num">{plan.priceLabel}</span>
            <span className="pm-plan__price-cad">{plan.cadence}</span>
          </div>

          <ul className="pm-plan__features">
            {plan.features.map(f => (
              <li key={f}>
                <i className="fas fa-check"></i>
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <button
            className={`pm-plan__btn ${isCurrent ? 'is-disabled' : ''}`}
            disabled={isCurrent}
          >
            {isCurrent ? 'Active' : `Switch to ${plan.name}`}
          </button>
        </article>
      )
    })}
  </div>
)

/* ─── Top-up section ─── */

const TopUpSection: React.FC = () => (
  <div className="pm-topup">
    <div className="pm-topup__intro">
      <h3>One-off credits</h3>
      <p>Top up without changing your plan. Credits never expire.</p>
    </div>
    <div className="pm-topup__grid">
      {MOCK_TOPUPS.map(t => (
        <button key={t.id} className={`pm-topup__card ${t.popular ? 'is-popular' : ''}`}>
          {t.popular && <div className="pm-topup__pop">Best value</div>}
          <div className="pm-topup__credits">
            <span className="pm-topup__credits-num">{t.credits.toLocaleString()}</span>
            <span className="pm-topup__credits-unit">credits</span>
          </div>
          <div className="pm-topup__price">{t.price}</div>
          <div className="pm-topup__perk">${t.perK} per 1k credits</div>
          <span className="pm-topup__buy">
            Buy <i className="fas fa-arrow-right"></i>
          </span>
        </button>
      ))}
    </div>
    <div className="pm-topup__custom">
      <span>Need a custom amount?</span>
      <a href="mailto:remix@ethereum.org">Contact us</a>
    </div>
  </div>
)

/* ─── Usage section ─── */

const UsageSection: React.FC<{ totalCredits: number }> = ({ totalCredits }) => {
  const max = Math.max(...MOCK_USAGE.map(u => u.credits))

  return (
    <div className="pm-usage">
      <div className="pm-usage__intro">
        <div>
          <h3>Per-model breakdown</h3>
          <p>Credits and tokens consumed by each model in this billing cycle.</p>
        </div>
        <div className="pm-usage__total">
          <span className="pm-usage__total-num">{totalCredits.toLocaleString()}</span>
          <span className="pm-usage__total-lbl">credits used</span>
        </div>
      </div>

      <div className="pm-usage__list">
        {MOCK_USAGE.map(u => {
          const pct = (u.credits / max) * 100
          const sharePct = (u.credits / totalCredits) * 100
          return (
            <div key={u.id} className="pm-usage__row" style={{ '--pm-bar': u.color } as React.CSSProperties}>
              <div className="pm-usage__meta">
                <div className="pm-usage__model">
                  <span className="pm-usage__swatch" />
                  <span className="pm-usage__name">{u.label}</span>
                  <span className="pm-usage__vendor">{u.vendor}</span>
                </div>
                <div className="pm-usage__nums">
                  <span className="pm-usage__credits">{u.credits.toLocaleString()}</span>
                  <span className="pm-usage__credits-lbl">credits</span>
                  <span className="pm-usage__share">{sharePct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="pm-usage__bar">
                <div className="pm-usage__bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="pm-usage__tokens">
                {u.tokens.toLocaleString()} tokens
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Credit alert banner ─── */

const ALERT_COPY: Record<Exclude<CreditState, 'healthy'>, {
  eyebrow: string
  title: (n: number) => string
  body: (refresh: string) => string
  icon: string
}> = {
  low: {
    eyebrow: 'Running low',
    title: (n) => `${n.toLocaleString()} credits left`,
    body: (r) => `You'll likely run out before your refill on ${r}. Top up or upgrade to keep your AI workflows uninterrupted.`,
    icon: 'fas fa-exclamation'
  },
  critical: {
    eyebrow: 'Almost out',
    title: (n) => `Only ${n.toLocaleString()} credits remain`,
    body: (r) => `Your next AI request may not complete. Add credits now or upgrade your plan — refill is on ${r}.`,
    icon: 'fas fa-exclamation-triangle'
  },
  empty: {
    eyebrow: 'Out of credits',
    title: () => 'You\'ve used all your credits',
    body: (r) => `AI features are paused until you top up, upgrade your plan, or your free allowance refills on ${r}.`,
    icon: 'fas fa-bolt'
  }
}

const CreditAlert: React.FC<{
  status: CreditStatus
  refreshDate: string
  canUpgrade: boolean
  onTopUp: () => void
  onUpgrade: () => void
}> = ({ status, refreshDate, canUpgrade, onTopUp, onUpgrade }) => {
  if (status.state === 'healthy') return null
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

/* ─── Plan lifecycle alert (paid plans) ─── */

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
  planCtx: PlanContext
  onRenew: () => void
  onUpgrade: () => void
}> = ({ planCtx, onRenew, onUpgrade }) => {
  if (planCtx.lifecycle === 'active') return null
  const copy = PLAN_ALERT_COPY[planCtx.lifecycle]
  const variant = planCtx.lifecycle // 'expiring' | 'expired'

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
          {' '}
          <span className="pm-alert__meta">Expired on {planCtx.expiresOn}.</span>
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

/* ─── Beta transition alert (special, gracious tone) ─── */

const BETA_ALERT_COPY: Record<Exclude<PlanLifecycle, 'active'>, {
  eyebrow: string
  title: string
  lede: (days: number, expiresOn: string) => string
  body: string
  primary: string
  secondary: string
}> = {
  expiring: {
    eyebrow: 'Beta program',
    title: 'Thanks for shaping Remix.',
    lede: (days, expiresOn) =>
      `The free beta wraps up ${days <= 1 ? 'tomorrow' : `in ${days} days`} (${expiresOn}). Your feedback got us here — now it's time to pick a plan that fits how you build.`,
    body: 'Pick any paid tier before your beta ends and your projects, history, and AI credits keep flowing without a hiccup. As a thank-you, your first month carries over a bonus credit pack.',
    primary: 'See paid plans',
    secondary: 'Top up credits'
  },
  expired: {
    eyebrow: 'Beta has ended',
    title: 'You helped build this. Let\'s keep going.',
    lede: (days, expiresOn) =>
      `The beta ended ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago (${expiresOn}). AI features are paused while you choose a plan — your workspaces and history are safe and waiting.`,
    body: 'Pick a paid plan to switch everything back on. Beta testers get a one-time bonus credit pack on their first paid month — our way of saying thanks for being early.',
    primary: 'Choose a plan',
    secondary: 'Top up credits'
  }
}

const BetaTransitionAlert: React.FC<{
  planCtx: PlanContext
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

/* ─── Loading skeleton ─── */

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

/* ─── Error state ─── */

const PlanManagerError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="pm-empty pm-empty--error">
    <div className="pm-empty__icon">
      <i className="fas fa-cloud-exclamation"></i>
    </div>
    <div className="pm-empty__title">We couldn't load your billing details</div>
    <p className="pm-empty__body">
      The billing service didn't respond. Your plan and credits are safe — this is
      just a display issue. Try again in a moment, or check your connection.
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

/* ─── Checkout result screen ─── */

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
