/**
 * Plugin Events - Plugin management and interaction tracking events
 * 
 * This file contains all plugin-related Matomo events.
 */

import { MatomoEventBase } from '../core/base-types';

export interface PluginEvent extends MatomoEventBase {
  category: 'plugin';
  action: 
    | 'activate'
    | 'activated'
    | 'deactivate'
    | 'install'
    | 'error'
    | 'contractFlattener';
}

export interface ManagerEvent extends MatomoEventBase {
  category: 'manager';
  action: 
    | 'activate'
    | 'deactivate'
    | 'toggle';
}

export interface PluginManagerEvent extends MatomoEventBase {
  category: 'pluginManager';
  action: 
    | 'activate'
    | 'deactivate';
}

export interface PluginPanelEvent extends MatomoEventBase {
  category: 'pluginPanel';
  action: 
    | 'toggle'
    | 'open'
    | 'close'
    | 'pinToRight'
    | 'pinToLeft';
}

export interface AppEvent extends MatomoEventBase {
  category: 'App';
  action: 
    | 'queryParams-activated'
    | 'loaded'
    | 'error'
    | 'PreloadError'
    | 'queryParamsCalls';
}

export interface MigrateEvent extends MatomoEventBase {
  category: 'migrate';
  action: 
    | 'start'
    | 'complete'
    | 'error'
    | 'result';
}

export interface MatomoEvent_Core extends MatomoEventBase {
  category: 'Matomo';
  action: 
    | 'showConsentDialog'
    | 'consentAccepted'
    | 'consentRejected'
    | 'trackingEnabled'
    | 'trackingDisabled';
}

export interface MatomoManagerEvent extends MatomoEventBase {
  category: 'MatomoManager';
  action: 
    | 'initialize'
    | 'switchMode'
    | 'trackEvent'
    | 'error'
    | 'showConsentDialog';
}

/**
 * Plugin Events - Type-safe builders
 */
export const PluginEvents = {
  activate: (name?: string, value?: string | number): PluginEvent => ({
    category: 'plugin',
    action: 'activate',
    name,
    value,
    isClick: true // User activates plugin
  }),
  
  deactivate: (name?: string, value?: string | number): PluginEvent => ({
    category: 'plugin',
    action: 'deactivate',
    name,
    value,
    isClick: true // User deactivates plugin
  }),
  
  install: (name?: string, value?: string | number): PluginEvent => ({
    category: 'plugin',
    action: 'install',
    name,
    value,
    isClick: true // User installs plugin
  }),
  
  error: (name?: string, value?: string | number): PluginEvent => ({
    category: 'plugin',
    action: 'error',
    name,
    value,
    isClick: false // Plugin errors are system events
  }),
  
  activated: (name?: string, value?: string | number): PluginEvent => ({
    category: 'plugin',
    action: 'activated',
    name,
    value,
    isClick: true // Plugin activated (same as activate, for compatibility)
  }),
  
  contractFlattener: (name?: string, value?: string | number): PluginEvent => ({
    category: 'plugin',
    action: 'contractFlattener',
    name,
    value,
    isClick: true // User interacts with contract flattener functionality
  })
} as const;

/**
 * Manager Events - Type-safe builders
 */
export const ManagerEvents = {
  activate: (name?: string, value?: string | number): ManagerEvent => ({
    category: 'manager',
    action: 'activate',
    name,
    value,
    isClick: true // User activates plugin through manager
  }),
  
  deactivate: (name?: string, value?: string | number): ManagerEvent => ({
    category: 'manager',
    action: 'deactivate',
    name,
    value,
    isClick: true // User deactivates plugin through manager
  }),
  
  toggle: (name?: string, value?: string | number): ManagerEvent => ({
    category: 'manager',
    action: 'toggle',
    name,
    value,
    isClick: true // User toggles plugin state
  })
} as const;

/**
 * Plugin Manager Events - Type-safe builders
 */
export const PluginManagerEvents = {
  activate: (name?: string, value?: string | number): PluginManagerEvent => ({
    category: 'pluginManager',
    action: 'activate',
    name,
    value,
    isClick: true // User activates plugin
  }),
  
  deactivate: (name?: string, value?: string | number): PluginManagerEvent => ({
    category: 'pluginManager',
    action: 'deactivate',
    name,
    value,
    isClick: true // User deactivates plugin
  })
} as const;

/**
 * App Events - Type-safe builders
 */
export const AppEvents = {
  queryParamsActivated: (name?: string, value?: string | number): AppEvent => ({
    category: 'App',
    action: 'queryParams-activated',
    name,
    value,
    isClick: false // Query param activation is a system event
  }),
  
  loaded: (name?: string, value?: string | number): AppEvent => ({
    category: 'App',
    action: 'loaded',
    name,
    value,
    isClick: false // App loading is a system event
  }),
  
  error: (name?: string, value?: string | number): AppEvent => ({
    category: 'App',
    action: 'error',
    name,
    value,
    isClick: false // App errors are system events
  }),
  
  PreloadError: (name?: string, value?: string | number): AppEvent => ({
    category: 'App',
    action: 'PreloadError',
    name,
    value,
    isClick: false // Preload errors are system events
  }),
  
  queryParamsCalls: (name?: string, value?: string | number): AppEvent => ({
    category: 'App',
    action: 'queryParamsCalls',
    name,
    value,
    isClick: false // Query parameter calls are system events
  })
} as const;

/**
 * Plugin Panel Events - Type-safe builders
 */
export const PluginPanelEvents = {
  toggle: (name?: string, value?: string | number): PluginPanelEvent => ({
    category: 'pluginPanel',
    action: 'toggle',
    name,
    value,
    isClick: true // User toggles plugin panel
  }),
  
  open: (name?: string, value?: string | number): PluginPanelEvent => ({
    category: 'pluginPanel',
    action: 'open',
    name,
    value,
    isClick: true // User opens plugin panel
  }),
  
  close: (name?: string, value?: string | number): PluginPanelEvent => ({
    category: 'pluginPanel',
    action: 'close',
    name,
    value,
    isClick: true // User closes plugin panel
  }),
  
  pinToRight: (name?: string, value?: string | number): PluginPanelEvent => ({
    category: 'pluginPanel',
    action: 'pinToRight',
    name,
    value,
    isClick: true // User pins panel to right
  }),
  
  pinToLeft: (name?: string, value?: string | number): PluginPanelEvent => ({
    category: 'pluginPanel',
    action: 'pinToLeft',
    name,
    value,
    isClick: true // User pins panel to left
  })
} as const;

/**
 * Matomo Manager Events - Type-safe builders
 */
export const MatomoManagerEvents = {
  initialize: (name?: string, value?: string | number): MatomoManagerEvent => ({
    category: 'MatomoManager',
    action: 'initialize',
    name,
    value,
    isClick: false // Initialization is a system event
  }),
  
  switchMode: (name?: string, value?: string | number): MatomoManagerEvent => ({
    category: 'MatomoManager',
    action: 'switchMode',
    name,
    value,
    isClick: true // User switches tracking mode
  }),
  
  trackEvent: (name?: string, value?: string | number): MatomoManagerEvent => ({
    category: 'MatomoManager',
    action: 'trackEvent',
    name,
    value,
    isClick: false // Event tracking is a system event
  }),
  
  showConsentDialog: (name?: string, value?: string | number): MatomoManagerEvent => ({
    category: 'MatomoManager',
    action: 'showConsentDialog',
    name,
    value,
    isClick: false // Showing consent dialog is a system event
  })
} as const;

/**
 * Migrate Events - Type-safe builders
 */
export const MigrateEvents = {
  start: (name?: string, value?: string | number): MigrateEvent => ({
    category: 'migrate',
    action: 'start',
    name,
    value,
    isClick: true // User starts migration process
  }),
  
  complete: (name?: string, value?: string | number): MigrateEvent => ({
    category: 'migrate',
    action: 'complete',
    name,
    value,
    isClick: false // Migration completion is system event
  }),
  
  error: (name?: string, value?: string | number): MigrateEvent => ({
    category: 'migrate',
    action: 'error',
    name,
    value,
    isClick: false // Migration errors are system events
  }),
  
  result: (name?: string, value?: string | number): MigrateEvent => ({
    category: 'migrate',
    action: 'result',
    name,
    value,
    isClick: false // Migration result is system event
  })
} as const;