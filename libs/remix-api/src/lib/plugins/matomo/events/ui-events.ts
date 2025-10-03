/**
 * UI Events - User interface and navigation tracking events
 * 
 * This file contains UI-related events like home tab, topbar, and navigation.
 */

import { MatomoEventBase } from '../core/base-types';

export interface HomeTabEvent extends MatomoEventBase {
  category: 'hometab';
  action: 
    | 'header'
    | 'filesSection'
    | 'scamAlert'
    | 'switchTo'
    | 'titleCard'
    | 'recentWorkspacesCard'
    | 'featuredPluginsToggle'
    | 'featuredPluginsActionClick'
    | 'updatesActionClick'
    | 'homeGetStarted'
    | 'startLearnEthTutorial'
    | 'featuredSection';
}

export interface TopbarEvent extends MatomoEventBase {
  category: 'topbar';
  action: 
    | 'GIT'
    | 'header';
}

export interface LayoutEvent extends MatomoEventBase {
  category: 'layout';
  action: 
    | 'pinToRight'
    | 'pinToLeft';
}

export interface SettingsEvent extends MatomoEventBase {
  category: 'settings';
  action: 
    | 'change';
}

export interface ThemeEvent extends MatomoEventBase {
  category: 'theme';
  action: 
    | 'switchThemeTo';
}

export interface LocaleEvent extends MatomoEventBase {
  category: 'locale';
  action: 
    | 'switchTo';
}

export interface LandingPageEvent extends MatomoEventBase {
  category: 'landingPage';
  action: 
    | 'welcome'
    | 'getStarted'
    | 'tutorial'
    | 'documentation'
    | 'templates'
    | 'MatomoAIModal';
}

/**
 * Home Tab Events - Type-safe builders
 */
export const HomeTabEvents = {
  header: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'header',
    name,
    value,
    isClick: true // User clicks on header elements
  }),
  
  filesSection: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'filesSection',
    name,
    value,
    isClick: true // User clicks on items in files section
  }),
  
  homeGetStarted: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'homeGetStarted',
    name,
    value,
    isClick: true // User clicks get started templates
  }),
  
  featuredSection: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'featuredSection',
    name,
    value,
    isClick: true // User clicks on featured section items
  }),
  
  scamAlert: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'scamAlert',
    name,
    value,
    isClick: true // User interacts with scam alert functionality
  }),
  
  titleCard: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'titleCard',
    name,
    value,
    isClick: true // User clicks on title cards
  }),
  
  startLearnEthTutorial: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'startLearnEthTutorial',
    name,
    value,
    isClick: true // User starts a LearnEth tutorial
  }),
  
  updatesActionClick: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'updatesActionClick',
    name,
    value,
    isClick: true // User clicks on updates actions
  }),
  
  featuredPluginsToggle: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'featuredPluginsToggle',
    name,
    value,
    isClick: true // User toggles featured plugins
  }),
  
  featuredPluginsActionClick: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'featuredPluginsActionClick',
    name,
    value,
    isClick: true // User clicks action in featured plugins
  }),
  
  recentWorkspacesCard: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'recentWorkspacesCard',
    name,
    value,
    isClick: true // User interacts with recent workspaces card
  }),
  
  switchTo: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'switchTo',
    name,
    value,
    isClick: true // User switches to different view/mode
  })
} as const;

/**
 * Topbar Events - Type-safe builders
 */
export const TopbarEvents = {
  GIT: (name?: string, value?: string | number): TopbarEvent => ({
    category: 'topbar',
    action: 'GIT',
    name,
    value,
    isClick: true // User clicks Git button in topbar
  }),
  
  header: (name?: string, value?: string | number): TopbarEvent => ({
    category: 'topbar',
    action: 'header',
    name,
    value,
    isClick: true // User clicks header elements
  })
} as const;

/**
 * Layout Events - Type-safe builders  
 */
export const LayoutEvents = {
  pinToRight: (name?: string, value?: string | number): LayoutEvent => ({
    category: 'layout',
    action: 'pinToRight',
    name,
    value,
    isClick: true // User clicks to pin panel to right
  }),
  
  pinToLeft: (name?: string, value?: string | number): LayoutEvent => ({
    category: 'layout',
    action: 'pinToLeft',
    name,
    value,
    isClick: true // User clicks to pin panel to left
  })
} as const;

/**
 * Settings Events - Type-safe builders
 */
export const SettingsEvents = {
  change: (name?: string, value?: string | number): SettingsEvent => ({
    category: 'settings',
    action: 'change',
    name,
    value,
    isClick: true // User changes settings
  })
} as const;

/**
 * Theme Events - Type-safe builders
 */
export const ThemeModuleEvents = {
  switchThemeTo: (themeName?: string, value?: string | number): ThemeEvent => ({
    category: 'theme',
    action: 'switchThemeTo',
    name: themeName,
    value,
    isClick: true // User switches theme
  })
} as const;

/**
 * Locale Events - Type-safe builders
 */
export const LocaleModuleEvents = {
  switchTo: (localeCode?: string, value?: string | number): LocaleEvent => ({
    category: 'locale',
    action: 'switchTo',
    name: localeCode,
    value,
    isClick: true // User switches locale
  })
} as const;

/**
 * Landing Page Events - Type-safe builders
 */
export const LandingPageEvents = {
  welcome: (name?: string, value?: string | number): LandingPageEvent => ({
    category: 'landingPage',
    action: 'welcome',
    name,
    value,
    isClick: true // User interacts with welcome section
  }),
  
  getStarted: (name?: string, value?: string | number): LandingPageEvent => ({
    category: 'landingPage',
    action: 'getStarted',
    name,
    value,
    isClick: true // User clicks get started buttons
  }),
  
  tutorial: (name?: string, value?: string | number): LandingPageEvent => ({
    category: 'landingPage',
    action: 'tutorial',
    name,
    value,
    isClick: true // User starts tutorials
  }),
  
  documentation: (name?: string, value?: string | number): LandingPageEvent => ({
    category: 'landingPage',
    action: 'documentation',
    name,
    value,
    isClick: true // User clicks documentation links
  }),
  
  templates: (name?: string, value?: string | number): LandingPageEvent => ({
    category: 'landingPage',
    action: 'templates',
    name,
    value,
    isClick: true // User selects templates
  }),
  
  MatomoAIModal: (name?: string, value?: string | number): LandingPageEvent => ({
    category: 'landingPage',
    action: 'MatomoAIModal',
    name,
    value,
    isClick: true // User interacts with Matomo AI modal settings
  })
} as const;

// Universal Events - General purpose events
export interface UniversalEvent extends MatomoEventBase {
  category: 'universal';
  action: 
    | 'generic'
    | 'custom'
    | 'interaction';
}

export const UniversalEvents = {
  generic: (name?: string, value?: string | number): UniversalEvent => ({
    category: 'universal',
    action: 'generic',
    name,
    value,
    isClick: false // Generic system event
  }),
  
  custom: (name?: string, value?: string | number): UniversalEvent => ({
    category: 'universal',
    action: 'custom',
    name,
    value,
    isClick: true // Custom user interaction
  }),
  
  interaction: (name?: string, value?: string | number): UniversalEvent => ({
    category: 'universal',
    action: 'interaction',
    name,
    value,
    isClick: true // General user interaction
  })
} as const;

// Naming compatibility aliases
export const TopBarEvents = TopbarEvents; // Alias for backward compatibility