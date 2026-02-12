import React from 'react'
import { ViewPlugin } from '@remixproject/engine-web'
import { driver, DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import * as packageJson from '../../../package.json'
import { CustomRemixApi, WalkthroughDefinition, WalkthroughStep } from '@remix-api'
import { PluginViewWrapper } from '@remix-ui/helper'
import { RemixUIWalkthrough } from '@remix-ui/walkthrough'
import { builtinWalkthroughs } from './walkthrough-definitions'

const profile = {
  name: 'walkthrough',
  displayName: 'Walkthrough',
  description: 'API-driven guided tours for Remix IDE',
  version: packageJson.version,
  icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxwYXRoIGQ9Ik05LjA5IDlhMyAzIDAgMCAxIDUuODMgMWMwIDItMyAzLTMgMyIvPjxsaW5lIHgxPSIxMiIgeTE9IjE3IiB4Mj0iMTIuMDEiIHkyPSIxNyIvPjwvc3ZnPg==',
  location: 'sidePanel',
  methods: ['registerWalkthrough', 'unregisterWalkthrough', 'start', 'startSteps', 'getWalkthroughs', 'stop', 'fetchFromApi'],
  events: ['walkthroughStarted', 'walkthroughCompleted', 'stepChanged', 'walkthroughsChanged'],
}

export class WalkthroughService extends ViewPlugin {
  private walkthroughs: Map<string, WalkthroughDefinition> = new Map()
  private activeDriver: ReturnType<typeof driver> | null = null
  private activeWalkthroughId: string | null = null
  dispatch: React.Dispatch<any> = () => {}
  element: HTMLDivElement

  constructor() {
    super(profile)
    this.element = document.createElement('div')
    this.element.setAttribute('id', 'walkthrough-panel')
  }

  onActivation(): void {
    console.log('[walkthrough] plugin activated')
    // Register built-in walkthroughs
    for (const wt of builtinWalkthroughs) {
      console.log(`[walkthrough] registered built-in: "${wt.id}" (${wt.steps.length} steps)`)
      this.walkthroughs.set(wt.id, wt)
    }
    console.log(`[walkthrough] ${this.walkthroughs.size} walkthroughs available:`, Array.from(this.walkthroughs.keys()))
    this.renderComponent()
  }

  /**
   * Register a walkthrough definition. Other plugins call this method
   * to add their guided tours to the walkthrough system.
   */
  async registerWalkthrough(walkthrough: WalkthroughDefinition): Promise<void> {
    this.walkthroughs.set(walkthrough.id, {
      ...walkthrough,
      sourcePlugin: (this.currentRequest as any)?.from || walkthrough.sourcePlugin || 'unknown',
    })
    this.emit('walkthroughsChanged' as any)
    this.renderComponent()
  }

  /**
   * Unregister a walkthrough by its ID.
   */
  async unregisterWalkthrough(walkthroughId: string): Promise<void> {
    this.walkthroughs.delete(walkthroughId)
    this.emit('walkthroughsChanged' as any)
    this.renderComponent()
  }

  /**
   * Start a registered walkthrough by its ID.
   */
  async start(walkthroughId: string): Promise<void> {
    console.log(`[walkthrough] start("${walkthroughId}")`)
    const definition = this.walkthroughs.get(walkthroughId)
    if (!definition) {
      console.error(`[walkthrough] not found: "${walkthroughId}". Available:`, Array.from(this.walkthroughs.keys()))
      throw new Error(`Walkthrough "${walkthroughId}" not found. Available: ${Array.from(this.walkthroughs.keys()).join(', ')}`)
    }
    console.log(`[walkthrough] starting "${definition.name}" with ${definition.steps.length} steps`)
    await this._runWalkthrough(walkthroughId, definition.steps)
  }

  /**
   * Start an ad-hoc walkthrough with inline steps (no registration needed).
   */
  async startSteps(steps: WalkthroughStep[]): Promise<void> {
    await this._runWalkthrough('_adhoc_' + Date.now(), steps)
  }

  /**
   * Get all registered walkthrough definitions.
   */
  async getWalkthroughs(): Promise<WalkthroughDefinition[]> {
    return Array.from(this.walkthroughs.values())
  }

  /**
   * Stop the currently active walkthrough.
   */
  async stop(): Promise<void> {
    if (this.activeDriver) {
      this.activeDriver.destroy()
      this.activeDriver = null
      this.activeWalkthroughId = null
    }
  }

  /**
   * Fetch walkthrough definitions from a remote API endpoint
   * and register them. Existing walkthroughs with the same ID are overwritten.
   */
  async fetchFromApi(url: string): Promise<void> {
    console.log(`[walkthrough] fetching walkthroughs from ${url}`)
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const data: WalkthroughDefinition[] = await response.json()
      console.log(`[walkthrough] received ${data.length} walkthroughs from API`)
      for (const wt of data) {
        if (!wt.id || !wt.steps || !Array.isArray(wt.steps)) {
          console.warn(`[walkthrough] skipping invalid walkthrough:`, wt)
          continue
        }
        this.walkthroughs.set(wt.id, {
          ...wt,
          sourcePlugin: wt.sourcePlugin || 'api',
        })
        console.log(`[walkthrough] registered from API: "${wt.id}" (${wt.steps.length} steps)`)
      }
      this.emit('walkthroughsChanged' as any)
      this.renderComponent()
    } catch (e) {
      console.error(`[walkthrough] fetchFromApi failed:`, e)
      throw e
    }
  }

  /**
   * Core method: converts WalkthroughStep[] to driver.js steps and runs the tour.
   */
  private async _runWalkthrough(walkthroughId: string, steps: WalkthroughStep[]): Promise<void> {
    // Stop any active walkthrough first
    await this.stop()

    this.activeWalkthroughId = walkthroughId

    // Execute preActions and build driver.js steps
    const driverSteps: DriveStep[] = []
    for (const step of steps) {
      driverSteps.push({
        element: step.targetSelector,
        popover: {
          title: step.title,
          description: step.content,
          side: step.placement || 'bottom',
          popoverClass: 'remix-walkthrough-popover',
        },
      })
    }

    const driverInstance = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: 'rgba(0, 0, 0, 0.6)',
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: 'remix-walkthrough-popover',
      steps: driverSteps,

      onHighlightStarted: async (_element, step, opts) => {
        const stepIndex = driverInstance.getActiveIndex() ?? 0
        const originalStep = steps[stepIndex]
        console.log(`[walkthrough] step ${stepIndex + 1}/${steps.length}: "${originalStep?.title}"`, {
          targetSelector: originalStep?.targetSelector,
          elementFound: !!document.querySelector(originalStep?.targetSelector),
          hasClickSelector: !!originalStep?.clickSelector,
          hasPreAction: !!originalStep?.preAction,
        })

        // Click an element before showing this step
        if (originalStep?.clickSelector) {
          const el = document.querySelector(originalStep.clickSelector) as HTMLElement
          console.log(`[walkthrough]   clicking "${originalStep.clickSelector}"`, el ? 'found' : 'NOT FOUND')
          try {
            if (el) {
              el.click()
              const delay = originalStep.clickDelay ?? 500
              console.log(`[walkthrough]   waiting ${delay}ms after click`)
              await new Promise((resolve) => setTimeout(resolve, delay))
            }
          } catch (e) {
            console.error(`[walkthrough]   click failed:`, e)
          }
        }

        // Execute preAction plugin call if defined
        if (originalStep?.preAction) {
          const { plugin, method, args = [] } = originalStep.preAction
          console.log(`[walkthrough]   preAction: ${plugin}.${method}(${JSON.stringify(args)})`)
          try {
            await this.call(plugin as any, method as any, ...args)
            console.log(`[walkthrough]   preAction completed, waiting 300ms`)
            await new Promise((resolve) => setTimeout(resolve, 300))
          } catch (e) {
            console.error(`[walkthrough]   preAction failed:`, e)
          }
        }
      },

      onHighlighted: (_element, step, opts) => {
        const stepIndex = driverInstance.getActiveIndex() ?? 0
        console.log(`[walkthrough] step ${stepIndex + 1} highlighted, element:`, _element)
        this.emit('stepChanged' as any, walkthroughId, stepIndex)
      },

      onDestroyStarted: () => {
        const isLast = driverInstance.isLastStep()
        console.log(`[walkthrough] destroying, isLastStep: ${isLast}`)
        if (isLast) {
          console.log(`[walkthrough] tour "${walkthroughId}" completed!`)
          this.emit('walkthroughCompleted' as any, walkthroughId)
        }
        driverInstance.destroy()
        this.activeDriver = null
        this.activeWalkthroughId = null
      },
    })

    this.activeDriver = driverInstance
    this.emit('walkthroughStarted' as any, walkthroughId)
    driverInstance.drive()
  }

  // --- PluginViewWrapper pattern ---

  setDispatch(dispatch: React.Dispatch<any>) {
    this.dispatch = dispatch
    this.renderComponent()
  }

  renderComponent() {
    this.dispatch({
      walkthroughs: Array.from(this.walkthroughs.values()),
      plugin: this,
    })
  }

  updateComponent(state: any) {
    return (
      <RemixUIWalkthrough
        plugin={state.plugin}
        walkthroughs={state.walkthroughs}
      />
    )
  }

  render() {
    return (
      <div data-id="walkthrough-container">
        <PluginViewWrapper plugin={this} />
      </div>
    )
  }
}
