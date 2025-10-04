'use strict'
import { Plugin } from '@remixproject/engine'
import { MatomoEvent } from '@remix-api'
import MatomoManager, { IMatomoManager, InitializationOptions, InitializationPattern, MatomoCommand, MatomoConfig, MatomoDiagnostics, MatomoState, MatomoStatus, ModeSwitchOptions, TrackingMode } from '../matomo/MatomoManager'

const profile = {
  name: 'matomo',
  description: 'send analytics to Matomo',
  methods: [
    'track', 'getManager', 'initialize', 'switchMode', 'giveConsent', 'revokeConsent',
    'trackEvent', 'trackPageView', 'setCustomDimension', 'getState', 'getStatus',
    'isMatomoLoaded', 'getMatomoCookies', 'deleteMatomoCookies', 'loadScript',
    'waitForLoad', 'getPreInitQueue', 'getQueueStatus', 'processPreInitQueue',
    'clearPreInitQueue', 'testConsentBehavior', 'getDiagnostics', 'inspectPaqArray',
    'batch', 'reset', 'addMatomoListener', 'removeMatomoListener', 'getMatomoManager',
    'shouldShowConsentDialog'
  ],
  events: ['matomo-initialized', 'matomo-consent-changed', 'matomo-mode-switched'],
  version: '1.0.0'
}

const matomoManager = window._matomoManagerInstance
export class Matomo extends Plugin {

  constructor() {
    super(profile)
  }

  /**
   * Get the full IMatomoManager interface
   * Use this to access all MatomoManager functionality including event listeners
   * Example: this.call('matomo', 'getManager').trackEvent('category', 'action')
   */
  getManager(): IMatomoManager {
    return matomoManager
  }

  // ================== INITIALIZATION METHODS ==================

  async initialize(pattern?: InitializationPattern, options?: InitializationOptions): Promise<void> {
    return matomoManager.initialize(pattern, options)
  }

  async loadScript(): Promise<void> {
    return matomoManager.loadScript()
  }

  async waitForLoad(timeout?: number): Promise<void> {
    return matomoManager.waitForLoad(timeout)
  }

  // ================== MODE SWITCHING & CONSENT ==================

  async switchMode(mode: TrackingMode, options?: ModeSwitchOptions & { processQueue?: boolean }): Promise<void> {
    return matomoManager.switchMode(mode, options)
  }

  async giveConsent(options?: { processQueue?: boolean }): Promise<void> {
    return matomoManager.giveConsent(options)
  }

  async revokeConsent(): Promise<void> {
    return matomoManager.revokeConsent()
  }

  // ================== TRACKING METHODS ==================

  // Support both type-safe MatomoEvent objects and legacy string signatures
  trackEvent(event: MatomoEvent): number;
  trackEvent(category: string, action: string, name?: string, value?: number): number;
  trackEvent(eventObjOrCategory: MatomoEvent | string, action?: string, name?: string, value?: number): number {
    if (typeof eventObjOrCategory === 'string') {
      // Legacy string-based approach - convert to type-safe call
      return matomoManager.trackEvent(eventObjOrCategory, action!, name, value)
    } else {
      // Type-safe MatomoEvent object
      return matomoManager.trackEvent(eventObjOrCategory)
    }
  }

  trackPageView(title?: string): void {
    return matomoManager.trackPageView(title)
  }

  setCustomDimension(id: number, value: string): void {
    return matomoManager.setCustomDimension(id, value)
  }

  // ================== STATE & STATUS ==================

  getState(): MatomoState & MatomoStatus {
    return matomoManager.getState()
  }

  getStatus(): MatomoStatus {
    return matomoManager.getStatus()
  }

  isMatomoLoaded(): boolean {
    return matomoManager.isMatomoLoaded()
  }

  getMatomoCookies(): string[] {
    return matomoManager.getMatomoCookies()
  }

  async deleteMatomoCookies(): Promise<void> {
    return matomoManager.deleteMatomoCookies()
  }

  // ================== QUEUE MANAGEMENT ==================

  getPreInitQueue(): MatomoCommand[] {
    return matomoManager.getPreInitQueue()
  }

  getQueueStatus(): { queueLength: number; initialized: boolean; commands: MatomoCommand[] } {
    return matomoManager.getQueueStatus()
  }

  async processPreInitQueue(): Promise<void> {
    return matomoManager.processPreInitQueue()
  }

  clearPreInitQueue(): number {
    return matomoManager.clearPreInitQueue()
  }

  // ================== UTILITY & DIAGNOSTICS ==================

  async testConsentBehavior(): Promise<void> {
    return matomoManager.testConsentBehavior()
  }

  getDiagnostics(): MatomoDiagnostics {
    return matomoManager.getDiagnostics()
  }

  inspectPaqArray(): { length: number; contents: any[]; trackingCommands: any[] } {
    return matomoManager.inspectPaqArray()
  }

  batch(commands: MatomoCommand[]): void {
    return matomoManager.batch(commands)
  }

  async reset(): Promise<void> {
    return matomoManager.reset()
  }

  // ================== EVENT SYSTEM ==================

  /**
   * Add event listener to MatomoManager events
   * Note: Renamed to avoid conflict with Plugin base class
   */
  addMatomoListener<T = any>(event: string, callback: (data: T) => void): void {
    return matomoManager.on(event, callback)
  }

  /**
   * Remove event listener from MatomoManager events
   * Note: Renamed to avoid conflict with Plugin base class
   */
  removeMatomoListener<T = any>(event: string, callback: (data: T) => void): void {
    return matomoManager.off(event, callback)
  }

  // ================== PLUGIN-SPECIFIC METHODS ==================

  /**
   * Get direct access to the underlying MatomoManager instance
   * Use this if you need access to methods not exposed by the interface
   */
  getMatomoManager(): MatomoManager {
    return matomoManager
  }

  /**
   * Check whether the Matomo consent dialog should be shown
   */
  shouldShowConsentDialog(configApi?: any): boolean {
    return matomoManager.shouldShowConsentDialog(configApi)
  }

  /**
   * Track events using type-safe MatomoEvent objects or legacy string parameters
   * @param eventObjOrCategory Type-safe MatomoEvent object or category string
   * @param action Action string (if using legacy approach)
   * @param name Optional name parameter
   * @param value Optional value parameter
   */
  async track(event: MatomoEvent): Promise<void>;
  async track(category: string, action: string, name?: string, value?: number): Promise<void>;
  async track(eventObjOrCategory: MatomoEvent | string, action?: string, name?: string, value?: number): Promise<void> {
    if (typeof eventObjOrCategory === 'string') {
      // Legacy string-based approach
      await matomoManager.trackEvent(eventObjOrCategory, action!, name, value);
    } else {
      // Type-safe MatomoEvent object
      await matomoManager.trackEvent(eventObjOrCategory);
    }
  }
}