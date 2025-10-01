/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react' // eslint-disable-line
import { ViewPlugin } from '@remixproject/engine-web'
import * as packageJson from '../../../../../package.json'
import { RemixUiSettings } from '@remix-ui/settings' //eslint-disable-line
import { Registry } from '@remix-project/remix-lib'
import { PluginViewWrapper } from '@remix-ui/helper'
import { InitializationPattern, TrackingMode } from '../matomo/MatomoManager'

declare global {
  interface Window {
    _paq: any
  }
}

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
  dispatch: React.Dispatch<any> = () => { }
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

  getCopilotSetting() {
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
    console.log('[Matomo][settings] updateMatomoPerfAnalyticsChoice called with', isChecked)
    this.config.set('settings/matomo-perf-analytics', isChecked)
    // Timestamp consent indicator (we treat enabling perf as granting cookie consent; disabling as revoking)
    localStorage.setItem('matomo-analytics-consent', Date.now().toString())
    this.useMatomoPerfAnalytics = isChecked

    const mode: TrackingMode = isChecked ? 'cookie' : 'anonymous'
    if (window._matomoManagerInstance.getState().initialized == false) {
      const pattern: InitializationPattern = isChecked ? "immediate" : "anonymous"
      window._matomoManagerInstance.initialize(pattern).then(() => {
        console.log('[Matomo][settings] Matomo initialized with mode', pattern)
      })
    } else {
      window._matomoManagerInstance.switchMode(mode)
    }

    // Persist deprecated mode key for backward compatibility (other code might read it)
    this.config.set('settings/matomo-analytics-mode', mode)
    this.config.set('settings/matomo-analytics', mode === 'cookie') // legacy boolean
    this.useMatomoAnalytics = true
    this.emit('matomoPerfAnalyticsChoiceUpdated', isChecked);
    this.dispatch({ ...this })
  }


}
