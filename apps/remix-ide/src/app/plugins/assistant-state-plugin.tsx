import { Plugin } from '@remixproject/engine'
import * as packageJson from '../../../../../package.json'
import {
  createAssistantActor,
  snapshotFromActor,
  selectCanAskAI,
  selectPlanManagerHandoff,
  selectAllowedModelIds,
  selectCooldownRemaining,
  selectCooldownDisplay,
  type AssistantSnapshot,
  type AIError,
  type CooldownDisplay,
  type PlanManagerHandoff
} from '@remix/remix-ai-core'
import { AVAILABLE_MODELS } from '@remix/remix-ai-core'

/**
 * AssistantStatePlugin — owns the AssistantMachine actor and exposes a
 * narrow query/report API to every other plugin.
 *
 * Policy lives here. Mechanism (the actual fetch / inferencer) lives in
 * `remixAIPlugin`. This split mirrors `planManager` (policy + UI) vs the
 * billing API services (mechanism).
 *
 * Lifecycle bridges this plugin owns:
 *   - on `auth.authStateChanged` → AUTH_CHANGED (also fired by auth after
 *     refreshPermissions(), so this single event covers entitlement updates
 *     after plan upgrades / email verification)
 *   - 1s ticker while `cooldown === 'rate-limited'` → COOLDOWN_TICK
 *
 * Other plugins call:
 *   - getSnapshot() → AssistantSnapshot          (read once)
 *   - subscribe(cb) → unsubscribe                (re-render on changes)
 *   - canAskAI() → boolean                       (cheap pre-check)
 *   - requireReady({ feature? }) → boolean       (gate + auto-open planManager)
 *   - getAllowedModels() → AIModel[]             (drive model picker)
 *   - reportRequestStarted() / reportRequestSucceeded()
 *   - reportError(error)                         (parsed AIError envelope)
 */

const profile = {
  name: 'assistantState',
  displayName: 'Assistant State',
  methods: [
    'getSnapshot',
    'subscribe',
    'canAskAI',
    'requireReady',
    'getAllowedModels',
    'getCooldownRemaining',
    'getCooldownDisplay',
    'reportRequestStarted',
    'reportStreamStarted',
    'reportRequestSucceeded',
    'reportError',
    'reportSuccess',
    'resetSession',
    'refreshPermissions'
  ],
  events: ['stateChanged'],
  description: 'Owns the AI assistant state machine — auth/permission gating, cooldowns, and error policy.',
  kind: '',
  location: 'none',
  version: packageJson.version,
  maintainedBy: 'Remix'
}

type Unsubscribe = () => void

export class AssistantStatePlugin extends Plugin {
  // The XState actor. Created in the constructor so methods are safe to
  // call before onActivation completes.
  private actor = createAssistantActor()
  private cachedSnapshot: AssistantSnapshot
  private cooldownTimer: ReturnType<typeof setInterval> | null = null
  // Single in-flight permissions fetch — auth events can fire in bursts.
  private permissionsRefreshing: Promise<void> | null = null

  constructor() {
    super(profile)
    this.actor.start()
    this.cachedSnapshot = snapshotFromActor(this.actor)
    // Re-emit `stateChanged` on every transition so React subscribers
    // re-render. Snapshot is recomputed lazily via getSnapshot().
    this.actor.subscribe(() => {
      this.cachedSnapshot = snapshotFromActor(this.actor)
      this.maintainCooldownTicker()
      this.emit('stateChanged', this.cachedSnapshot)
    })
  }

  async onActivation(): Promise<void> {
    // The auth plugin re-emits `authStateChanged` after refreshPermissions(),
    // so a single listener covers both login/logout and entitlement changes.
    this.on('auth' as any, 'authStateChanged', (s: { isAuthenticated: boolean }) => {
      const isAuthed = !!s?.isAuthenticated
      this.actor.send({ type: 'AUTH_CHANGED', isAuthenticated: isAuthed })
      if (isAuthed) void this.refreshPermissions()
      else this.actor.send({ type: 'PERMISSIONS_LOADED', permissions: null })
    })

    // Best-effort initial probe — if the user is already signed in by the
    // time we activate (cached JWT), pull permissions now.
    try {
      const isAuthed = await this.call('auth' as any, 'isAuthenticated')
      this.actor.send({ type: 'AUTH_CHANGED', isAuthenticated: !!isAuthed })
      if (isAuthed) void this.refreshPermissions()
    } catch { /* auth not ready yet — auth events will catch us up */ }
  }

  async onDeactivation(): Promise<void> {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer)
      this.cooldownTimer = null
    }
    this.actor.stop()
  }

  // ─── Read API ─────────────────────────────────────────────────────

  getSnapshot(): AssistantSnapshot {
    return this.cachedSnapshot
  }

  /**
   * Cross-plugin subscription. Returns an unsubscribe function. Do not use
   * inside React render — use `useSyncExternalStore` against the same
   * cached snapshot instead (helper exposed from remix-ai-core).
   */
  subscribe(cb: (snap: AssistantSnapshot) => void): Unsubscribe {
    const sub = this.actor.subscribe(() => cb(this.cachedSnapshot))
    return () => sub.unsubscribe()
  }

  canAskAI(): boolean {
    return selectCanAskAI(this.cachedSnapshot)
  }

  /** Filtered AIModel[] driven by the user's `ai:*` feature flags. */
  getAllowedModels() {
    const ids = new Set(selectAllowedModelIds(this.cachedSnapshot, AVAILABLE_MODELS))
    return AVAILABLE_MODELS.filter((m) => ids.has(m.id))
  }

  getCooldownRemaining(): number | null {
    return selectCooldownRemaining(this.cachedSnapshot)
  }

  /** Rich cooldown view: countdown, expiresAt, message, terminal flag, feature… */
  getCooldownDisplay(): CooldownDisplay | null {
    return selectCooldownDisplay(this.cachedSnapshot)
  }

  /**
   * Gate helper. Returns true if the caller may proceed; returns false
   * AND opens the plan manager with the right reason if not.
   *
   * `feature` is optional — pass it when the call site is for a specific
   * `ai:*` capability so the planManager can highlight it on the upgrade
   * screen.
   */
  async requireReady(opts: { feature?: string } = {}): Promise<boolean> {
    const snap = this.cachedSnapshot
    if (selectCanAskAI(snap)) return true

    // Cooldown-only block (rate-limit / blocked) → DO NOT open the plan
    // manager. The chat UI shows a countdown banner; the user waits or
    // contacts support. Plan upgrades don't lift rate-limits.
    if (snap.cooldown !== 'none' && !snap.gateReason) return false

    // Decide the hand-off reason. If the snapshot already carries a
    // gate, use it. If there's no gate but cooldown is active, we don't
    // open the planManager — the UI shows a countdown and the user waits.
    let handoff: PlanManagerHandoff | null = selectPlanManagerHandoff(snap)
    if (!handoff && snap.availability === 'gated' && !snap.isAuthenticated) {
      handoff = { reason: 'auth-required' }
    }
    if (!handoff && opts.feature && snap.availability !== 'available') {
      handoff = { reason: 'feature-required', requiredFeature: opts.feature }
    }
    if (handoff) {
      try {
        await this.call('planManager' as any, 'open', handoff)
      } catch (e) {
        console.warn('[assistantState] failed to open planManager', e)
      }
    }
    return false
  }

  // ─── Write API (called by remixAIPlugin) ─────────────────────────

  reportRequestStarted(): void {
    this.actor.send({ type: 'REQUEST_STARTED' })
  }
  reportStreamStarted(): void {
    this.actor.send({ type: 'STREAM_STARTED' })
  }
  reportRequestSucceeded(): void {
    this.actor.send({ type: 'REQUEST_SUCCEEDED' })
  }
  /** Alias for symmetry — some call sites prefer the shorter name. */
  reportSuccess(): void {
    this.reportRequestSucceeded()
  }
  /** Caller must pass an already-parsed AIError envelope. */
  reportError(error: AIError): void {
    this.actor.send({ type: 'ERROR_RECEIVED', error })
  }
  resetSession(): void {
    this.actor.send({ type: 'RESET_SESSION' })
  }

  // ─── Internal ────────────────────────────────────────────────────

  /** Idempotent — coalesces concurrent calls into a single fetch. */
  async refreshPermissions(): Promise<void> {
    if (this.permissionsRefreshing) return this.permissionsRefreshing
    this.permissionsRefreshing = (async () => {
      this.actor.send({ type: 'PERMISSIONS_LOADING' })
      try {
        const api: any = await this.call('auth' as any, 'getPermissionsApi')
        if (!api) {
          this.actor.send({ type: 'PERMISSIONS_LOADED', permissions: null })
          return
        }
        const r = await api.getPermissions()
        if (r?.ok) {
          this.actor.send({ type: 'PERMISSIONS_LOADED', permissions: r.data })
        } else {
          this.actor.send({ type: 'PERMISSIONS_FAILED', message: r?.error ?? 'Failed to load permissions' })
        }
      } catch (e: any) {
        this.actor.send({ type: 'PERMISSIONS_FAILED', message: e?.message ?? 'Failed to load permissions' })
      } finally {
        this.permissionsRefreshing = null
      }
    })()
    return this.permissionsRefreshing
  }

  /**
   * The 1-second ticker keeps `selectCooldownRemaining` re-evaluating so
   * countdown chips re-render. Self-stops once cooldown clears.
   */
  private maintainCooldownTicker(): void {
    const needsTicker = this.cachedSnapshot.cooldown === 'rate-limited'
    if (needsTicker && !this.cooldownTimer) {
      this.cooldownTimer = setInterval(() => {
        this.actor.send({ type: 'COOLDOWN_TICK' })
      }, 1000)
    } else if (!needsTicker && this.cooldownTimer) {
      clearInterval(this.cooldownTimer)
      this.cooldownTimer = null
    }
  }
}
