import { StatusEvents } from "@remixproject/plugin-utils"

/**
 * A single step in a walkthrough tour.
 * Plugins provide these via the API to define guided tours.
 */
export interface WalkthroughStep {
  /** CSS selector for the element to highlight */
  targetSelector: string
  /** Title shown in the popover */
  title: string
  /** Description / body content (supports HTML) */
  content: string
  /** Popover placement relative to the target element */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** CSS selector of an element to click before this step is shown */
  clickSelector?: string
  /** Delay in ms after clicking before showing the step (default: 500) */
  clickDelay?: number
  /** Optional: execute a plugin call before showing this step */
  preAction?: {
    plugin: string
    method: string
    args?: any[]
  }
}

/**
 * A complete walkthrough definition.
 * Plugins register these and they can be started by ID.
 */
export interface WalkthroughDefinition {
  /** Unique identifier for the walkthrough */
  id: string
  /** Display name shown in the walkthrough list */
  name: string
  /** Short description of what this walkthrough covers */
  description: string
  /** The plugin that registered this walkthrough */
  sourcePlugin?: string
  /** Ordered list of steps */
  steps: WalkthroughStep[]
}

export interface IWalkthroughApi {
  events: {
    /** Emitted when a walkthrough tour starts */
    walkthroughStarted: (walkthroughId: string) => void
    /** Emitted when a walkthrough tour completes */
    walkthroughCompleted: (walkthroughId: string) => void
    /** Emitted when the user moves to a new step */
    stepChanged: (walkthroughId: string, stepIndex: number) => void
    /** Emitted when the list of available walkthroughs changes */
    walkthroughsChanged: () => void
  } & StatusEvents
  methods: {
    /** Register a walkthrough definition. Other plugins call this to add their tours. */
    registerWalkthrough: (walkthrough: WalkthroughDefinition) => Promise<void>
    /** Unregister a walkthrough by ID */
    unregisterWalkthrough: (walkthroughId: string) => Promise<void>
    /** Start a registered walkthrough by its ID */
    start: (walkthroughId: string) => Promise<void>
    /** Start an ad-hoc walkthrough with inline steps (no registration needed) */
    startSteps: (steps: WalkthroughStep[]) => Promise<void>
    /** Get all registered walkthrough definitions */
    getWalkthroughs: () => Promise<WalkthroughDefinition[]>
    /** Stop the currently active walkthrough */
    stop: () => Promise<void>
    /** Fetch and register walkthroughs from a remote API endpoint */
    fetchFromApi: (url: string) => Promise<void>
  }
}
