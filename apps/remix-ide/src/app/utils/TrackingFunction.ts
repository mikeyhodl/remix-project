/**
 * Tracking Function Factory
 * 
 * Creates a standardized tracking function that works with MatomoManager
 */

import { MatomoManager } from '../matomo/MatomoManager';

export type TrackingFunction = (
  category: string, 
  action: string, 
  name?: string, 
  value?: string | number
) => void;

/**
 * Create a tracking function that properly handles value conversion and delegates to MatomoManager
 */
export function createTrackingFunction(matomoManager: MatomoManager): TrackingFunction {
  return (category: string, action: string, name?: string, value?: string | number) => {
    let numericValue: number | undefined = undefined;
    
    if (value !== undefined) {
      if (typeof value === 'number') {
        numericValue = value;
      } else if (typeof value === 'string') {
        const parsed = parseFloat(value);
        numericValue = isNaN(parsed) ? undefined : parsed;
      }
    }
    
    matomoManager.trackEvent?.(category, action, name, numericValue);
  };
}