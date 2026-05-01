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
  methods: ['open', 'close', 'toggle'],
  events: ['opened', 'closed'],
  icon: PLAN_ICON,
  location: 'sidePanel',
  version: packageJson.version,
  maintainedBy: 'Remix'
}

export class PlanManagerPlugin extends ViewPlugin {
  dispatch: React.Dispatch<any> = () => {}
  private _isOpen = false

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') plugin.close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [plugin])

  const live = MOCK_SCENARIOS[scenario]
  const status = deriveCreditStatus(live.total, live.used)
  const { remaining, used, total, usedPct, state } = status
  const refreshDate = MOCK_BALANCE.refreshDate
  const canUpgrade = true // current plan is 'beta', so upgrade is available

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

          {/* Dev scenario switcher — remove when wiring real API */}
          <div className="pm-scenario" title="Dev: preview credit states">
            <i className="fas fa-flask"></i>
            {(Object.keys(MOCK_SCENARIOS) as Array<keyof typeof MOCK_SCENARIOS>).map(k => (
              <button
                key={k}
                className={`pm-scenario__btn ${scenario === k ? 'is-active' : ''}`}
                onClick={() => setScenario(k)}
              >{MOCK_SCENARIOS[k].label}</button>
            ))}
          </div>

          <button className="pm-close" onClick={() => plugin.close()} aria-label="Close">
            <i className="fas fa-times"></i>
          </button>
        </header>

        {/* Low / critical / empty alert banner */}
        {state !== 'healthy' && (
          <CreditAlert
            status={status}
            refreshDate={refreshDate}
            canUpgrade={canUpgrade}
            onTopUp={() => setActiveSection('topup')}
            onUpgrade={() => setActiveSection('plans')}
          />
        )}

        {/* Hero — credits balance */}
        <section className={`pm-hero pm-hero--${state}`}>
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
              <span className="pm-hero__div">·</span>
              <span>refreshes <em>{refreshDate}</em></span>
            </div>

            <div className="pm-hero__bar">
              <div
                className="pm-hero__bar-fill"
                style={{ width: `${usedPct}%` }}
              />
              <div
                className="pm-hero__bar-marker"
                style={{ left: `${usedPct}%` }}
              />
            </div>
          </div>

          <div className="pm-hero__right">
            <div className="pm-ring" style={{ '--pm-pct': `${usedPct}` } as React.CSSProperties}>
              <div className="pm-ring__inner">
                <div className="pm-ring__pct">{Math.round(usedPct)}<span>%</span></div>
                <div className="pm-ring__caption">consumed</div>
              </div>
            </div>
            <button
              className="pm-cta"
              onClick={() => setActiveSection('topup')}
            >
              <i className="fas fa-bolt"></i> Top&nbsp;up
            </button>
          </div>
        </section>

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
