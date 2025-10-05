/**
 * Matomo Configuration Constants
 *
 * Single source of truth for Matomo site IDs and configuration
 */

import { MatomoConfig } from './MatomoManager';

// ================ DEVELOPER CONFIGURATION ================
/**
 * Enable Matomo tracking on localhost for development and testing
 *
 * USAGE:
 * - Set to `true` to enable Matomo on localhost/127.0.0.1 during development
 * - Set to `false` (default) to disable Matomo on localhost (prevents CI test pollution)
 *
 * ALTERNATIVES:
 * - You can also enable Matomo temporarily by setting localStorage.setItem('showMatomo', 'true') in browser console
 * - The localStorage method is temporary (cleared on browser restart)
 * - This config flag is permanent until you change it back
 *
 * IMPORTANT:
 * - CircleCI tests automatically disable this through environment isolation
 * - Production domains (remix.ethereum.org, etc.) are unaffected by this setting
 * - Only affects localhost and 127.0.0.1 domains
 */
export const ENABLE_MATOMO_LOCALHOST = false;

// Type for domain-specific custom dimensions
export interface DomainCustomDimensions {
  trackingMode: number; // Dimension ID for 'anon'/'cookie' tracking mode
  clickAction: number; // Dimension ID for 'true'/'false' click tracking
}

// Single source of truth for Matomo site ids (matches loader.js.txt)
export const MATOMO_DOMAINS = {
  'alpha.remix.live': 1,
  'beta.remix.live': 2,
  'remix.ethereum.org': 3,
  'localhost': 5,
  '127.0.0.1': 5
};

// Domain-specific custom dimension IDs
// These IDs must match what's configured in each Matomo site
export const MATOMO_CUSTOM_DIMENSIONS = {
  // Production domains
  'alpha.remix.live': {
    trackingMode: 1, // Dimension for 'anon'/'cookie' tracking mode
    clickAction: 2 // Dimension for 'true'/'false' click tracking
  },
  'beta.remix.live': {
    trackingMode: 1, // Dimension for 'anon'/'cookie' tracking mode
    clickAction: 2 // Dimension for 'true'/'false' click tracking
  },
  'remix.ethereum.org': {
    trackingMode: 1, // Dimension for 'anon'/'cookie' tracking mode
    clickAction: 2 // Dimension for 'true'/'false' click tracking
  },
  // Development domains
  localhost: {
    trackingMode: 1, // Dimension for 'anon'/'cookie' tracking mode
    clickAction: 3 // Dimension for 'true'/'false' click tracking
  },
  '127.0.0.1': {
    trackingMode: 1, // Dimension for 'anon'/'cookie' tracking mode
    clickAction: 3 // Dimension for 'true'/'false' click tracking
  }
};

/**
 * Get custom dimensions configuration for current domain
 */
export function getDomainCustomDimensions(): DomainCustomDimensions {
  const hostname = window.location.hostname;

  // Return dimensions for current domain
  if (MATOMO_CUSTOM_DIMENSIONS[hostname]) {
    return MATOMO_CUSTOM_DIMENSIONS[hostname];
  }

  // Fallback to localhost if domain not found
  console.warn(`No custom dimensions found for domain: ${hostname}, using localhost fallback`);
  return MATOMO_CUSTOM_DIMENSIONS['localhost'];
}

/**
 * Create default Matomo configuration
 */
export function createMatomoConfig(): MatomoConfig {
  return {
    trackerUrl: 'https://matomo.remix.live/matomo/matomo.php',
    // siteId will be auto-derived from matomoDomains based on current hostname
    debug: false,
    matomoDomains: MATOMO_DOMAINS,
    scriptTimeout: 10000,
    onStateChange: (event, data, state) => {
      // hook into state changes if needed
    }
  };
}