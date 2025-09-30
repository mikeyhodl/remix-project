/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react' // eslint-disable-line
import { ViewPlugin } from '@remixproject/engine-web'
import * as packageJson from '../../../../../package.json'
import {RemixUiSettings} from '@remix-ui/settings' //eslint-disable-line
import { Registry } from '@remix-project/remix-lib'
import { PluginViewWrapper } from '@remix-ui/helper'
declare global {
  interface Window {
    _paq: any
  }
}
const _paq = (window._paq = window._paq || [])

const profile = {
  name: 'settings',
  displayName: 'Settings',
  // updateMatomoAnalyticsMode deprecated: tracking mode now derived purely from perf toggle (Option B)
  methods: ['get', 'updateCopilotChoice', 'getCopilotSetting', 'updateMatomoPerfAnalyticsChoice', 'updateMatomoAnalyticsMode'],
  events: [],
  icon: 'assets/img/settings.webp',
  description: 'Remix-IDE settings',
  kind: 'settings',
  location: 'mainPanel',
  documentation: 'https://remix-ide.readthedocs.io/en/latest/settings.html',
  version: packageJson.version,
  permission: true,
  maintainedBy: 'Remix',
  show: false
}

export default class SettingsTab extends ViewPlugin {
  config: any = {}
  editor: any
  private _deps: {
    themeModule: any
  }
  element: HTMLDivElement
  public useMatomoAnalytics: any
  public useMatomoPerfAnalytics: boolean
  dispatch: React.Dispatch<any> = () => {}
  constructor(config, editor) {
    super(profile)
    this.config = config
    this.config.events.on('configChanged', (changedConfig) => {
      this.emit('configChanged', changedConfig)
    })
    this.editor = editor
    this._deps = {
      themeModule: Registry.getInstance().get('themeModule').api,
    }
    this.element = document.createElement('div')
    this.element.setAttribute('id', 'settingsTab')
    this.useMatomoAnalytics = null
    this.useMatomoPerfAnalytics = null
  }

  setDispatch(dispatch: React.Dispatch<any>) {
    this.dispatch = dispatch
    this.renderComponent()
  }

  onActivation(): void {
  }

  render() {
    return (
      <div id="settingsTab" className="bg-light overflow-hidden">
        <PluginViewWrapper plugin={this} />
      </div>
    )
  }

  updateComponent(state: any) {
    return (
      <RemixUiSettings
        plugin={this}
        config={state.config}
        editor={state.editor}
        _deps={state._deps}
        useMatomoPerfAnalytics={state.useMatomoPerfAnalytics}
        useCopilot={state.useCopilot}
        themeModule={state._deps.themeModule}
      />
    )
  }

  renderComponent() {
    this.dispatch(this)
  }

  get(key) {
    return this.config.get(key)
  }

  updateCopilotChoice(isChecked) {
    this.config.set('settings/copilot/suggest/activate', isChecked)
    this.emit('copilotChoiceUpdated', isChecked)
    this.dispatch({
      ...this
    })
  }

  getCopilotSetting(){
    return this.get('settings/copilot/suggest/activate')
  }

  updateMatomoAnalyticsChoice(_isChecked) {
    // Deprecated legacy toggle (disabled in UI). Mode now derives from performance analytics only.
    // Intentionally no-op to avoid user confusion; kept for backward compat if invoked programmatically.
  }

  // Deprecated public method: retained for backward compatibility (external plugins or old code calling it).
  // It now simply forwards to performance-based derivation by toggling perf flag if needed.
  updateMatomoAnalyticsMode(_mode: 'cookie' | 'anon') {
    if (window.localStorage.getItem('matomo-debug') === 'true') {
      console.debug('[Matomo][settings] DEPRECATED updateMatomoAnalyticsMode call ignored; mode derived from perf toggle')
    }
  }

  updateMatomoPerfAnalyticsChoice(isChecked) {
    this.config.set('settings/matomo-perf-analytics', isChecked)
    // Timestamp consent indicator (we treat enabling perf as granting cookie consent; disabling as revoking)
    localStorage.setItem('matomo-analytics-consent', Date.now().toString())
    this.useMatomoPerfAnalytics = isChecked

    const MATOMO_TRACKING_MODE_DIMENSION_ID = 1 // only remaining custom dimension (tracking mode)
    const mode = isChecked ? 'cookie' : 'anon'

    // Always re-assert cookie consent boundary so runtime flip is clean
    _paq.push(['requireCookieConsent'])
    
    if (mode === 'cookie') {
      // Cookie mode: give cookie consent and remember it
      _paq.push(['rememberConsentGiven']);
      _paq.push(['enableBrowserFeatureDetection']); 
      _paq.push(['setCustomDimension', MATOMO_TRACKING_MODE_DIMENSION_ID, 'cookie'])
      _paq.push(['trackEvent', 'tracking_mode_change', 'cookie'])
    } else {
      // Anonymous mode: revoke cookie consent completely
      _paq.push(['setConsentGiven']); 
      _paq.push(['forgetCookieConsentGiven']) // This removes cookie consent and deletes cookies
      _paq.push(['disableCookies']) // Extra safety - prevent any new cookies
      
      // Manual cookie deletion as backup (Matomo cookies typically start with _pk_)
      this.deleteMatomoCookies()
      
      _paq.push(['setCustomDimension', MATOMO_TRACKING_MODE_DIMENSION_ID, 'anon'])
      _paq.push(['trackEvent', 'tracking_mode_change', 'anon'])
      if (window.localStorage.getItem('matomo-debug') === 'true') {
        _paq.push(['trackEvent', 'debug', 'anon_mode_active_toggle'])
      }
    }
    
    // Performance dimension removed: mode alone now encodes cookie vs anon. Keep event for analytics toggle if useful.
    _paq.push(['trackEvent', 'perf_analytics_toggle', isChecked ? 'on' : 'off'])
    if (window.localStorage.getItem('matomo-debug') === 'true') {
      console.debug('[Matomo][settings] perf toggle -> mode derived', { perf: isChecked, mode })
    }

    // If running inside Electron, propagate mode to desktop tracker & emit desktop-specific event.
    if ((window as any).electronAPI) {
      try {
        (window as any).electronAPI.setTrackingMode(mode)
        // Also send an explicit desktop event (uses new API if available)
        if ((window as any).electronAPI.trackDesktopEvent) {
          (window as any).electronAPI.trackDesktopEvent('tracking_mode_change', mode, isChecked ? 'on' : 'off')
        }
      } catch (e) {
        console.warn('[Matomo][desktop-sync] failed to set tracking mode in electron layer', e)
      }
    }
    // Persist deprecated mode key for backward compatibility (other code might read it)
    this.config.set('settings/matomo-analytics-mode', mode)
    this.config.set('settings/matomo-analytics', mode === 'cookie') // legacy boolean
    this.useMatomoAnalytics = true

    this.emit('matomoPerfAnalyticsChoiceUpdated', isChecked)
    this.dispatch({ ...this })
  }

  // Helper method to manually delete Matomo cookies
  private deleteMatomoCookies() {
    try {
      // Get all cookies
      const cookies = document.cookie.split(';')
      
      for (let cookie of cookies) {
        const eqPos = cookie.indexOf('=')
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
        
        // Delete Matomo cookies (typically start with _pk_)
        if (name.startsWith('_pk_')) {
          // Delete for current domain and path
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${window.location.hostname}`
          
          if (window.localStorage.getItem('matomo-debug') === 'true') {
            console.debug('[Matomo][cookie-cleanup] Deleted cookie:', name)
          }
        }
      }
    } catch (e) {
      console.warn('[Matomo][cookie-cleanup] Failed to delete cookies:', e)
    }
  }
}
