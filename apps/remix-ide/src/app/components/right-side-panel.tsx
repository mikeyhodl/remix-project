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

    // Initialize isHidden state from localStorage
    const rightSidePanelState = window.localStorage.getItem('rightSidePanelState')
    if (rightSidePanelState) {
      try {
        const state = JSON.parse(rightSidePanelState)
        this.isHidden = state.isHidden || false
      } catch (e) {
        this.isHidden = false
      }
    } else {
      this.isHidden = false
      window.localStorage.setItem('rightSidePanelState', JSON.stringify({}))
    }
  }

  async pinView (profile, view) {
    if (this.hiddenPlugin) {
      const pinnedPanel = document.querySelector('#right-side-panel')
      pinnedPanel?.classList.remove('d-none')
      this.hiddenPlugin = null
      this.isHidden = false
      window.localStorage.setItem('rightSidePanelState', JSON.stringify({ pluginProfile: profile, isHidden: false }))
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
    let rightSidePanelState = window.localStorage.getItem('rightSidePanelState')
    let isHidden = false
    if (rightSidePanelState) {
      rightSidePanelState = JSON.parse(rightSidePanelState)
      if (rightSidePanelState['isHidden']) {
        isHidden = true
        const pinnedPanel = document.querySelector('#right-side-panel')
        pinnedPanel?.classList.add('d-none')
        this.hiddenPlugin = profile
        this.isHidden = true
      }
    }
    if (!isHidden && !this.hiddenPlugin) {
      this.isHidden = false
      this.events.emit('rightSidePanelShown')
      this.emit('rightSidePanelShown')
    }
    this.renderComponent()
    this.events.emit('pinnedPlugin', profile, isHidden)
    this.emit('pinnedPlugin', profile, isHidden)
  }

  async unPinView (profile) {
    const activePlugin = this.currentFocus()

    if (activePlugin !== profile.name) throw new Error(`Plugin ${profile.name} is not pinned`)
    await this.call('sidePanel', 'unPinView', profile, this.plugins[profile.name].view)
    super.remove(profile.name)
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
    // Persist the hidden state to localStorage
    const activePlugin = this.currentFocus()
    if (activePlugin && this.plugins[activePlugin]) {
      const profile = this.plugins[activePlugin].profile
      window.localStorage.setItem('rightSidePanelState', JSON.stringify({ pluginProfile: profile, isHidden: this.isHidden }))
    }
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
