// eslint-disable-next-line no-use-before-define
import React from 'react'
import './index.css'
import { ThemeModule } from './app/tabs/theme-module'
import { LocaleModule } from './app/tabs/locale-module'
import { Preload } from './app/components/preload'
import { GitHubPopupCallback } from './app/pages/GitHubPopupCallback'
import Config from './config'
import { Registry } from '@remix-project/remix-lib'
import { Storage } from '@remix-project/remix-lib'

import { createRoot } from 'react-dom/client'
import { MatomoConfig, MatomoManager } from './app/matomo/MatomoManager'
import { TrackingProvider } from './app/contexts/TrackingContext'

  ; (async function () {
    const matomoConfig: MatomoConfig = {
      trackerUrl: 'https://matomo.remix.live/matomo/matomo.php',
      siteId: 5,
      debug: true,

      scriptTimeout: 10000,

      onStateChange: (event, data, state) => {
        console.log(`STATE CHANGE: ${event}`, data);
      }
    }
    const matomoManager = new MatomoManager(matomoConfig)
    window._matomoManagerInstance = matomoManager; 
    ///matomoManager.initialize('anonymous')


    try {
      const configStorage = new Storage('config-v0.8:')
      const config = new Config(configStorage)
      Registry.getInstance().put({ api: config, name: 'config' })
    } catch (e) { }
    const theme = new ThemeModule()
    theme.initTheme()
    const locale = new LocaleModule()
    const settingsConfig = { themes: theme.getThemes(), locales: locale.getLocales() }

    Registry.getInstance().put({ api: settingsConfig, name: 'settingsConfig' })

    const container = document.getElementById('root');
    const root = createRoot(container)
    if (container) {
      const trackingFunction = (category: string, action: string, name?: string) => {
        matomoManager.trackEvent?.(category, action, name)
      }
      
      if (window.location.hash.includes('source=github')) {
        root.render(
          <TrackingProvider trackingFunction={trackingFunction}>
            <GitHubPopupCallback />
          </TrackingProvider>
        )
      } else {
        root.render(
          <TrackingProvider trackingFunction={trackingFunction}>
            <Preload root={root} />
          </TrackingProvider>
        )
      }
    }
  })()
