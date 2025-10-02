/**
 * Matomo Configuration Constants
 * 
 * Single source of truth for Matomo site IDs and configuration
 */

import { MatomoConfig } from './MatomoManager';

// Single source of truth for Matomo site ids (matches loader.js.txt)
export const MATOMO_DOMAINS = {
  'alpha.remix.live': 1,
  'beta.remix.live': 2,
  'remix.ethereum.org': 3,
  'localhost': 5,
  '127.0.0.1': 5
};

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
      console.log(`STATE CHANGE: ${event}`, data);
    }
  };
}