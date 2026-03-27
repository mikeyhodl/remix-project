/**
 * Types for the Remix IDE lifecycle state machine and event guard system.
 */

// ─── Lifecycle Events ────────────────────────────────────────────────

export type LifecycleEvent =
  | { type: 'BOOT' }
  | { type: 'PLUGINS_REGISTERED' }
  | { type: 'PLUGIN_ACTIVATED'; name: string }
  | { type: 'PLUGIN_DEACTIVATED'; name: string }
  | { type: 'PLUGIN_ACTIVATION_FAILED'; name: string; error: string }
  | { type: 'WORKSPACE_INITIALIZED' }
  | { type: 'EDITOR_MOUNTED' }
  | { type: 'CACHE_READY' }
  | { type: 'PROVIDER_CONNECTED'; name: string }
  | { type: 'PROVIDER_DISCONNECTED'; name: string }
  | { type: 'APP_LOADED' }
  | { type: 'CUSTOM'; id: string; payload?: any }

/** String identifier for a lifecycle event, used in guard conditions */
export type EventId = string

// ─── Machine Context ─────────────────────────────────────────────────

export interface AppLifecycleContext {
  activatedPlugins: Set<string>
  failedPlugins: Map<string, string>
  readyServices: Set<string>
  bootStartedAt: number
  currentPhase: string
  firedEvents: Set<string>
}

// ─── Machine State Values ────────────────────────────────────────────

export type BootPhase =
  | 'idle'
  | 'booting'
  | 'coreReady'
  | 'servicesReady'
  | 'uiReady'
  | 'toolsReady'
  | 'running'
  | 'degraded'

// ─── Event Guard Condition Combinators ───────────────────────────────

export interface AllCondition {
  kind: 'all'
  conditions: Condition[]
}

export interface AnyCondition {
  kind: 'any'
  conditions: Condition[]
}

export interface SequenceCondition {
  kind: 'sequence'
  conditions: Condition[]
}

export interface EventCondition {
  kind: 'event'
  eventId: EventId
}

export type Condition = AllCondition | AnyCondition | SequenceCondition | EventCondition

export type ConditionInput = Condition | EventId

// ─── Guard Registration ─────────────────────────────────────────────

export interface GuardRegistration {
  id: number
  condition: Condition
  callback: () => void
  once: boolean
  fired: boolean
}

// ─── Lifecycle Plugin Profile ────────────────────────────────────────

export interface LifecyclePluginMethods {
  waitFor(condition: SerializedCondition): Promise<void>
  has(eventId: string): boolean
  getState(): string
  getActivatedPlugins(): string[]
  getFiredEvents(): string[]
}

/**
 * JSON-safe representation of a Condition for cross-plugin communication.
 * Plugins pass these via `call('lifecycle', 'waitFor', condition)`.
 */
export type SerializedCondition =
  | { all: SerializedConditionInput[] }
  | { any: SerializedConditionInput[] }
  | { sequence: SerializedConditionInput[] }
  | string

export type SerializedConditionInput = SerializedCondition
