'use strict'
import { Plugin } from '@remixproject/engine'
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
    'batch', 'reset', 'addMatomoListener', 'removeMatomoListener', 'getMatomoManager'
  ],
  events: ['matomo-initialized', 'matomo-consent-changed', 'matomo-mode-switched'],
  version: '1.0.0'
}

const allowedPlugins = ['LearnEth', 'etherscan', 'vyper', 'circuit-compiler', 'doc-gen', 'doc-viewer', 'solhint', 'walletconnect', 'scriptRunner', 'scriptRunnerBridge', 'dgit', 'contract-verification', 'noir-compiler']



const matomoManager = window._matomoManagerInstance
export class Matomo extends Plugin {

  constructor() {
    super(profile)
    console.log('Matomo plugin loaded')
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
  
  trackEvent(category: string, action: string, name?: string, value?: number): number {
    return matomoManager.trackEvent(category, action, name, value)
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

  async track(data: string[]) {
    console.log('Matomo track', data)
    if (!allowedPlugins.includes(this.currentRequest.from)) return
    this.getMatomoManager().trackEvent(data[0], data[1], data[2], data[3] ? parseInt(data[3]) : undefined)
  }
}