/* eslint-disable @nrwl/nx/enforce-module-boundaries */
import React from 'react'
import { AppAction, AppState } from '@remix-ui/app'
import { PluginViewWrapper } from '@remix-ui/helper'
import { Plugin } from '@remixproject/engine'
import { EventEmitter } from 'events'
import { ThemeModule } from '../tabs/theme-module'
import * as packageJson from '../../../../../package.json'
import { TemplateExplorerProvider } from 'libs/remix-ui/template-explorer-modal/context/template-explorer-context'
import { ViewPlugin } from '@remixproject/engine-web'

const pluginProfile = {
  name: 'templateexplorermodal',
  displayName: 'Template Explorer Modal',
  description: 'Template Explorer Modal',
  methods: ['openModal'],
  events: [],
  maintainedBy: 'Remix',
  kind: 'templateexplorermodal',
  location: 'none',
  version: packageJson.version,
  permission: true,
  documentation: 'https://remix-ide.readthedocs.io/en/latest/template-explorer-modal.html'
}

export class TemplateExplorerModalPlugin extends Plugin {
  element: HTMLDivElement
  dispatch: React.Dispatch<any> = () => { }
  event: any
  appStateDispatch: any
  theme: any = null
  constructor(theme: ThemeModule) {
    super(pluginProfile)
    this.element = document.createElement('div')
    this.element.setAttribute('id', 'template-explorer-modal')
    this.dispatch = () => { }
    this.event = new EventEmitter()
    this.theme = theme
  }

  async onActivation(): Promise<void> {
    this.on('theme', 'themeChanged', (theme: any) => {
      this.theme = theme
    })
  }

  openModal() {
    console.log('This is openModal')
  }

  onDeactivation(): void {

  }

  setDispatch(dispatch: React.Dispatch<any>) {
    this.dispatch = dispatch
    this.renderComponent()
  }

  setAppStateDispatch(appStateDispatch: React.Dispatch<AppAction>) {
    this.appStateDispatch = appStateDispatch
  }

  render() {
    return (
      <div id="inner-remix-template-explorer-modal">
        <PluginViewWrapper plugin={this} useAppContext={true} />
      </div>
    )
  }

  renderComponent(): void {
    this.dispatch({
      ...this
    })
  }

  updateComponent(state: any) {
    console.log('what is state', state)
    return (
      <TemplateExplorerProvider plugin={state} />
    )
  }
}
