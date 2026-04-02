import { ViewPlugin } from '@remixproject/engine-web'
import React from 'react'
import { PluginViewWrapper } from '@remix-ui/helper'
import * as packageJson from '../../../../../package.json'

export type HelpTopic = 'beta-reel' | 'beta-info' | 'mcp' | 'cloud' | 'quickdapp'

const HELP_ICON = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a2a3bd" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`)

const profile = {
  name: 'helpPlugin',
  displayName: 'Help & Guides',
  description: 'Contextual help, guides, and feature walkthroughs for beta users',
  methods: ['showModal', 'getTopics'],
  events: ['modalOpened', 'modalClosed'],
  icon: HELP_ICON,
  location: 'sidePanel',
  version: packageJson.version,
  maintainedBy: 'Remix'
}

export class HelpPlugin extends ViewPlugin {
  dispatch: React.Dispatch<any> = () => {}
  private _isBeta = false
  private _activeModal: HelpTopic | null = null

  constructor() {
    super(profile)
  }

  /* ─── Lifecycle ─── */

  async onActivation(): Promise<void> {
    // Check if the user is a beta user
    try {
      this._isBeta = await this.call('auth', 'checkPermission', 'beta')
    } catch {
      this._isBeta = false
    }

    // Listen for auth changes
    this.on('auth', 'authStateChanged', async () => {
      try {
        this._isBeta = await this.call('auth', 'checkPermission', 'beta')
      } catch {
        this._isBeta = false
      }
      this.renderComponent()
    })

    this.renderComponent()
  }

  onDeactivation(): void {
    this.off('auth', 'authStateChanged')
  }

  /* ─── Public API ─── */

  /** Programmatically open a help modal */
  async showModal(topic: HelpTopic): Promise<void> {
    this._activeModal = topic
    this.renderComponent()
    this.emit('modalOpened', topic)

    // Also focus the side panel on this plugin
    try {
      await this.call('menuicons', 'select', 'helpPlugin')
    } catch { /* side panel might not be ready */ }
  }

  closeModal(): void {
    const prev = this._activeModal
    this._activeModal = null
    this.renderComponent()
    if (prev) this.emit('modalClosed', prev)
  }

  getTopics(): { id: HelpTopic; title: string; description: string }[] {
    return TOPICS
  }

  get isBeta(): boolean {
    return this._isBeta
  }

  get activeModal(): HelpTopic | null {
    return this._activeModal
  }

  /* ─── Action handler — routes CTA clicks to other plugins ─── */

  async handleTopicAction(topic: HelpTopic): Promise<void> {
    switch (topic) {
      case 'mcp':
        await this.call('menuicons', 'select', 'settings')
        break
      case 'cloud':
        await this.call('menuicons', 'select', 'settings')
        break
      case 'quickdapp':
        await this.call('menuicons', 'select', 'quickDapp')
        break
      case 'beta-reel':
      case 'beta-info':
        // Opens the reel/info as a modal overlay
        this.showModal(topic)
        break
    }
  }

  /* ─── Render plumbing ─── */

  setDispatch(dispatch: React.Dispatch<any>): void {
    this.dispatch = dispatch
    this.renderComponent()
  }

  renderComponent(): void {
    this.dispatch({ plugin: this })
  }

  updateComponent(state: any): JSX.Element {
    return <HelpPanelUI plugin={state.plugin || this} />
  }

  render(): JSX.Element {
    return (
      <div id="helpPlugin" className="h-100">
        <PluginViewWrapper plugin={this} />
      </div>
    )
  }
}

/* ─── Topic registry ─── */

interface TopicDef {
  id: HelpTopic
  title: string
  description: string
  icon: string
  color: string
  tag?: string
}

const TOPICS: TopicDef[] = [
  {
    id: 'beta-reel',
    title: 'What\'s new in Beta',
    description: 'Tour the latest features unlocked for beta testers — AI models, MCP tools, cloud sync, and QuickDApp.',
    icon: 'fas fa-sparkles',
    color: '#2fbfb1',
    tag: 'Start here'
  },
  {
    id: 'mcp',
    title: 'MCP Integrations',
    description: 'Alchemy, Etherscan, The Graph, and ethSkills — on-chain data and verification directly in your AI chat.',
    icon: 'fas fa-plug',
    color: '#5b9cf5',
  },
  {
    id: 'cloud',
    title: 'Cloud Workspaces',
    description: 'Sync your projects to the cloud. Open any workspace from any device, anytime.',
    icon: 'fas fa-cloud',
    color: '#9b7dff',
  },
  {
    id: 'quickdapp',
    title: 'QuickDApp Builder',
    description: 'Generate a full frontend connected to your smart contract from a single prompt.',
    icon: 'fas fa-rocket',
    color: '#6bdb8a',
  },
  {
    id: 'beta-info',
    title: 'About the Beta Program',
    description: 'Learn what the beta program includes, how to give feedback, and how you\'re shaping the future of Remix.',
    icon: 'fas fa-flask',
    color: '#f0a030',
  },
]

/* ─── Side-panel React UI ─── */

import './help-panel.css'

const HelpPanelUI: React.FC<{ plugin: HelpPlugin }> = ({ plugin }) => {
  const isBeta = plugin.isBeta
  const activeModal = plugin.activeModal

  if (!isBeta) {
    return (
      <div className="help-panel help-panel--locked">
        <div className="help-panel-locked-icon">
          <i className="fas fa-lock"></i>
        </div>
        <h5 className="help-panel-locked-title">Beta Required</h5>
        <p className="help-panel-locked-desc">
          Sign in with a beta account to access guides and feature walkthroughs.
        </p>
      </div>
    )
  }

  return (
    <div className="help-panel">
      {/* Header */}
      <div className="help-panel-header">
        <div className="help-panel-header-badge">
          <span className="help-panel-header-dot" />
          Beta Guides
        </div>
        <p className="help-panel-header-sub">
          Deep dives into every feature unlocked for you.
        </p>
      </div>

      {/* Topic cards */}
      <div className="help-panel-topics">
        {TOPICS.map((topic) => (
          <div
            key={topic.id}
            className="help-panel-card"
            onClick={() => plugin.showModal(topic.id)}
            role="button"
            tabIndex={0}
          >
            <div className="help-panel-card-icon" style={{ '--hpc-color': topic.color } as React.CSSProperties}>
              <i className={topic.icon}></i>
            </div>
            <div className="help-panel-card-body">
              <div className="help-panel-card-row">
                <span className="help-panel-card-title">{topic.title}</span>
                {topic.tag && <span className="help-panel-card-tag">{topic.tag}</span>}
              </div>
              <span className="help-panel-card-desc">{topic.description}</span>
            </div>
            <i className="fas fa-chevron-right help-panel-card-arrow"></i>
          </div>
        ))}
      </div>

      {/* ── Modal overlay ── */}
      {activeModal && (
        <HelpModalOverlay
          topic={activeModal}
          plugin={plugin}
          onClose={() => plugin.closeModal()}
        />
      )}
    </div>
  )
}

/* ─── Modal overlay ─── */

import BetaFeatureReel from './beta-feature-reel'
import BetaWelcomeModal from './beta-welcom-modal'
import McpHelpModal from './mcp-help-modal'
import CloudHelpModal from './cloud-help-modal'
import QuickDAppHelpModal from './quickdapp-help-modal'

const HelpModalOverlay: React.FC<{
  topic: HelpTopic
  plugin: HelpPlugin
  onClose: () => void
}> = ({ topic, plugin, onClose }) => {

  const renderContent = () => {
    switch (topic) {
      case 'beta-reel':
        return (
          <BetaFeatureReel
            dismissible
            autoAdvanceMs={5000}
            onAction={(feature) => {
              onClose()
              const map: Record<string, HelpTopic> = { models: 'beta-reel', mcp: 'mcp', cloud: 'cloud', quickdapp: 'quickdapp' }
              plugin.handleTopicAction(map[feature] || 'beta-reel')
            }}
            onDismiss={onClose}
          />
        )
      case 'beta-info':
        return <BetaWelcomeModal open onClose={onClose} />
      case 'mcp':
        return <McpHelpModal open onClose={onClose} />
      case 'cloud':
        return <CloudHelpModal open onClose={onClose} />
      case 'quickdapp':
        return <QuickDAppHelpModal open onClose={onClose} />
      default:
        return null
    }
  }

  return (
    <div
      className="help-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="help-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {renderContent()}
      </div>
    </div>
  )
}
