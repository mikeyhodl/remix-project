/**
 * App Renderer
 *
 * Handles rendering the appropriate React component tree based on routing
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { TrackingProvider } from '../contexts/TrackingContext';
import { Preload } from '../components/preload';
import { GitHubPopupCallback } from '../pages/GitHubPopupCallback';
import { SubscriptionPopupCallback } from '../pages/SubscriptionPopupCallback';
import { SubscriptionPage } from '../pages/SubscriptionPage';
import { TrackingFunction } from './TrackingFunction';

export interface RenderAppOptions {
  trackingFunction: TrackingFunction;
}

/**
 * Render the appropriate React app component based on current URL
 */
export function renderApp(options: RenderAppOptions): Root | null {
  const { trackingFunction } = options;

  const container = document.getElementById('root');
  if (!container) {
    console.error('Root container not found');
    return null;
  }

  const root = createRoot(container);

  if (window.location.hash.includes('source=github')) {
    root.render(
      <TrackingProvider trackingFunction={trackingFunction}>
        <GitHubPopupCallback />
      </TrackingProvider>
    );
  } else if (window.location.hash.includes('source=subscription-checkout')) {
    // Show Paddle checkout page
    root.render(
      <TrackingProvider trackingFunction={trackingFunction}>
        <SubscriptionPage />
      </TrackingProvider>
    );
  } else if (window.location.hash.includes('source=subscription')) {
    // Callback after successful payment to get JWT token
    root.render(
      <TrackingProvider trackingFunction={trackingFunction}>
        <SubscriptionPopupCallback />
      </TrackingProvider>
    );
  } else {
    root.render(
      <TrackingProvider trackingFunction={trackingFunction}>
        <Preload root={root} trackingFunction={trackingFunction} />
      </TrackingProvider>
    );
  }

  return root;
}