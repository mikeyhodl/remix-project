/**
 * Tracking Function Factory
 * 
 * Creates a standardized tracking function that works with MatomoManager
 */

import { MatomoEvent, MatomoEventBase } from '@remix-api';
import { MatomoManager } from '../matomo/MatomoManager';



export type TrackingFunction = (
  event: MatomoEvent
) => void;

/**
 * Create a tracking function that properly handles value conversion and delegates to MatomoManager
 */
export function createTrackingFunction(matomoManager: MatomoManager): TrackingFunction {
  return (event: MatomoEvent) => {
    let numericValue: number | undefined = undefined;
    
    if (event.value !== undefined) {
      if (typeof event.value === 'number') {
        numericValue = event.value;
      } else if (typeof event.value === 'string') {
        const parsed = parseFloat(event.value);
        numericValue = isNaN(parsed) ? undefined : parsed;
      }
    }
    
    matomoManager.trackEvent?.({ ...event, value: numericValue });
  };
}