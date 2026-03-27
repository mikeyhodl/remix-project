/**
 * State machine module public API.
 *
 * Provides:
 * - AppLifecycle: XState machine + EventGuard facade for boot orchestration
 * - EventGuard: Standalone event prerequisite registry with combinators
 * - LifecyclePlugin: Remix engine plugin wrapper for cross-plugin access
 * - Combinators: all(), any(), sequence() for building conditions
 * - Types: Full TypeScript type definitions
 */

// Core classes
export { AppLifecycle } from './app-lifecycle'
export { EventGuard, all, any, sequence, deserializeCondition } from './event-guard'
export { LifecyclePlugin } from './lifecycle-plugin'

// Types
export type {
  LifecycleEvent,
  EventId,
  AppLifecycleContext,
  BootPhase,
  Condition,
  ConditionInput,
  AllCondition,
  AnyCondition,
  SequenceCondition,
  EventCondition,
  GuardRegistration,
  SerializedCondition,
  SerializedConditionInput,
  LifecyclePluginMethods
} from './types'
