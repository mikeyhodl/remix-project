// eslint-disable-next-line no-use-before-define
import React from 'react'
import { AbstractPanel } from './panel'
import { PluginRecord, RemixPluginPanel } from '@remix-ui/panel'
import packageJson from '../../../../../package.json'
import { RemixUIPanelHeader } from '@remix-ui/panel'
import { PluginViewWrapper } from '@remix-ui/helper'

const rightSidePanel = {
  name: 'rightSidePanel',
  displayName: 'Right Side Panel',
  description: 'Remix IDE right side panel',
  version: packageJson.version,
  methods: ['addView', 'removeView', 'currentFocus', 'pinView', 'unPinView', 'highlight',
    'getHiddenPlugin', 'togglePanel', 'isPanelHidden'
  ],
  events: []
}

export class RightSidePanel extends AbstractPanel {
  dispatch: React.Dispatch<any> = () => {}
  loggedState: Record<string, any>
  rightSidePanelState: Record<string, any> // pluginProfile, isHidden
  highlightStamp: number
  hiddenPlugin: any
  isHidden: boolean

  constructor() {
    super(rightSidePanel)
  }

  onActivation() {
    this.renderComponent()
    this.on('sidePanel', 'pluginDisabled', (name) => {
      if (this.plugins[name] && this.plugins[name].active) {
        this.emit('unPinnedPlugin', name)
        this.events.emit('unPinnedPlugin', name)
        super.remove(name)
      }
    })

    // Initialize isHidden state from panelStates in localStorage
    const panelStatesStr = window.localStorage.getItem('panelStates')
    let panelStates = panelStatesStr ? JSON.parse(panelStatesStr) : {}

    if (panelStates.rightSidePanel) {
      this.isHidden = panelStates.rightSidePanel.isHidden || false

      // Apply d-none class to hide the panel on reload if it was hidden
      if (this.isHidden) {
        const pinnedPanel = document.querySelector('#right-side-panel')
        pinnedPanel?.classList.add('d-none')
        // Initialize hiddenPlugin from panelStates if we have a pluginProfile
        if (panelStates.rightSidePanel.pluginProfile) {
          this.hiddenPlugin = panelStates.rightSidePanel.pluginProfile
        } else {
          this.hiddenPlugin = null
        }
      } else {
        this.hiddenPlugin = null
      }
    } else {
      // Initialize with default state if not found
      this.isHidden = false
      this.hiddenPlugin = null
      // Note: pluginProfile will be set when a plugin is pinned
      panelStates.rightSidePanel = {
        isHidden: this.isHidden,
        pluginProfile: null
      }
      window.localStorage.setItem('panelStates', JSON.stringify(panelStates))
    }
  }

  async pinView (profile, view) {
    if (this.hiddenPlugin) {
      const pinnedPanel = document.querySelector('#right-side-panel')
      pinnedPanel?.classList.remove('d-none')
      this.hiddenPlugin = null
      this.isHidden = false
      // Update panelStates
      const panelStates = JSON.parse(window.localStorage.getItem('panelStates') || '{}')
      panelStates.rightSidePanel = { isHidden: false, pluginProfile: profile }
      window.localStorage.setItem('panelStates', JSON.stringify(panelStates))
      this.events.emit('rightSidePanelShown')
      this.emit('rightSidePanelShown')
    }
    const activePlugin = this.currentFocus()

    if (activePlugin === profile.name) throw new Error(`Plugin ${profile.name} already pinned`)
    if (activePlugin) {
      await this.call('sidePanel', 'unPinView', this.plugins[activePlugin].profile, this.plugins[activePlugin].view)
      this.remove(activePlugin)
    }
    this.loggedState = await this.call('pluginStateLogger', 'getPluginState', profile.name)
    this.addView(profile, view)
    this.plugins[profile.name].pinned = true
    this.plugins[profile.name].active = true
    // Read isHidden state from panelStates
    const panelStates = window.localStorage.getItem('panelStates')
    let isHidden = false
    if (panelStates) {
      try {
        const states = JSON.parse(panelStates)
        if (states.rightSidePanel?.isHidden) {
          isHidden = true
          const pinnedPanel = document.querySelector('#right-side-panel')
          pinnedPanel?.classList.add('d-none')
          this.hiddenPlugin = profile
          this.isHidden = true
        }
      } catch (e) {}
    }
    if (!isHidden && !this.hiddenPlugin) {
      this.isHidden = false
      this.events.emit('rightSidePanelShown')
      this.emit('rightSidePanelShown')
    }
    // Save pinned plugin profile to panelStates
    const updatedPanelStates = JSON.parse(window.localStorage.getItem('panelStates') || '{}')
    updatedPanelStates.rightSidePanel = {
      isHidden: isHidden,
      pluginProfile: profile
    }
    window.localStorage.setItem('panelStates', JSON.stringify(updatedPanelStates))
    this.renderComponent()
    this.events.emit('pinnedPlugin', profile, isHidden)
    this.emit('pinnedPlugin', profile, isHidden)
  }

  async unPinView (profile) {
    const activePlugin = this.currentFocus()

    if (activePlugin !== profile.name) throw new Error(`Plugin ${profile.name} is not pinned`)
    await this.call('sidePanel', 'unPinView', profile, this.plugins[profile.name].view)
    super.remove(profile.name)
    // Clear hiddenPlugin and panel state from localStorage
    this.hiddenPlugin = null
    const panelStates = JSON.parse(window.localStorage.getItem('panelStates') || '{}')
    delete panelStates.rightSidePanel
    window.localStorage.setItem('panelStates', JSON.stringify(panelStates))
    this.renderComponent()
    this.events.emit('unPinnedPlugin', profile)
    this.emit('unPinnedPlugin', profile)
  }

  getHiddenPlugin() {
    return this.hiddenPlugin
  }

  togglePanel () {
    const pinnedPanel = document.querySelector('#right-side-panel')
    if (this.isHidden) {
      this.isHidden = false
      pinnedPanel?.classList.remove('d-none')
      this.emit('rightSidePanelShown')
      this.events.emit('rightSidePanelShown')
    } else {
      this.isHidden = true
      pinnedPanel?.classList.add('d-none')
      this.emit('rightSidePanelHidden')
      this.events.emit('rightSidePanelHidden')
    }
    // Persist the hidden state to panelStates, preserving pluginProfile
    const panelStates = JSON.parse(window.localStorage.getItem('panelStates') || '{}')
    const currentPlugin = this.currentFocus()
    const pluginProfile = currentPlugin && this.plugins[currentPlugin] ? this.plugins[currentPlugin].profile : null
    panelStates.rightSidePanel = {
      isHidden: this.isHidden,
      pluginProfile: pluginProfile
    }
    window.localStorage.setItem('panelStates', JSON.stringify(panelStates))
    // Re-render to update the toggle icon
    this.renderComponent()
  }

  isPanelHidden() {
    return this.isHidden
  }

  highlight () {
    this.highlightStamp = Date.now()
    this.renderComponent()
  }

  setDispatch (dispatch: React.Dispatch<any>) {
    this.dispatch = dispatch
  }

  render() {
    return (
      <section className='panel right-side-panel'> <PluginViewWrapper plugin={this} /></section>
    )
  }

  updateComponent(state: any) {
    return <RemixPluginPanel header={<RemixUIPanelHeader plugins={state.plugins} pinView={this.pinView.bind(this)} unPinView={this.unPinView.bind(this)} togglePanel={this.togglePanel.bind(this)}></RemixUIPanelHeader>} { ...state } />
  }

  renderComponent() {
    this.dispatch({
      plugins: this.plugins,
      pluginState: this.loggedState,
      highlightStamp: this.highlightStamp
    })
  }
}
