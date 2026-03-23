// eslint-disable-next-line no-use-before-define
import React from 'react'
import './index.css'
import { MatomoManager } from './app/matomo/MatomoManager'
import { autoInitializeMatomo } from './app/matomo/MatomoAutoInit'
import { createMatomoConfig } from './app/matomo/MatomoConfig'
import { createTrackingFunction } from './app/utils/TrackingFunction'
import { setupThemeAndLocale } from './app/utils/AppSetup'
import { renderApp } from './app/utils/AppRenderer'
import { initEndpoints } from '@remix-endpoints-helper'

; (async function () {
  // Load endpoint URLs from service discovery
  //await initEndpoints();

  // Create Matomo configuration
  const matomoConfig = createMatomoConfig();
  const matomoManager = new MatomoManager(matomoConfig);
  window._matomoManagerInstance = matomoManager;

  // Setup config and auto-initialize Matomo if we have existing settings
  await autoInitializeMatomo({
    matomoManager,
    debug: true
  });

  // Setup theme and locale
  setupThemeAndLocale();

  // Create tracking function
  const trackingFunction = createTrackingFunction(matomoManager);

  // Render the app
  renderApp({ trackingFunction });
})()
