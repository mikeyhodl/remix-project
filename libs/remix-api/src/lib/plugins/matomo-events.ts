/**
 * Matomo Analytics Events - Quick Reference
 * 
 * @example Usage
 * ```ts
 * import { trackMatomoEvent, AIEvents, UdappEvents } from '@remix-api'
 * 
 * trackMatomoEvent(plugin, AIEvents.remixAI('code_generation'))
 * trackMatomoEvent(plugin, UdappEvents.DeployAndPublish('mainnet'))
 * ```
 * 
 * @example Common Events
 * ```ts
 * // AI
 * AIEvents.remixAI(), AIEvents.explainFunction()
 * 
 * // Contracts  
 * UdappEvents.DeployAndPublish(), UdappEvents.sendTransactionFromGui()
 * 
 * // Editor
 * EditorEvents.save(), EditorEvents.format()
 * 
 * // Files
 * FileExplorerEvents.contextMenu(), WorkspaceEvents.create()
 * ```
 * 
 * @example Add New Event
 * ```ts
 * // In ./matomo/events/[category]-events.ts:
 * export interface MyEvent extends MatomoEventBase {
 *   category: 'myCategory'
 *   action: 'myAction'
 * }
 * 
 * export const MyEvents = {
 *   myAction: (name?: string): MyEvent => ({
 *     category: 'myCategory',
 *     action: 'myAction',
 *     name,
 *     isClick: true
 *   })
 * }
 * ```
 */

// Re-export everything from the modular system
export * from './matomo';