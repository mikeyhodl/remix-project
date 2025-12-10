import React, { useState, useEffect } from 'react'
import { ViewPlugin } from '@remixproject/engine-web'

interface IAlchemyConfig {
  enabled: boolean
  apiKey?: string
  defaultNetwork: 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base'
}

interface IAlchemySettingsProps {
  plugin: ViewPlugin
}

export const AlchemySettings: React.FC<IAlchemySettingsProps> = ({ plugin }) => {
  const [config, setConfig] = useState<IAlchemyConfig>({
    enabled: false,
    apiKey: '',
    defaultNetwork: 'ethereum'
  })
  const [isSaving, setIsSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const savedConfig = await plugin.call('settings', 'get', 'settings/mcp/alchemy')
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig)
        setConfig({
          enabled: parsed.enabled !== false,
          apiKey: parsed.apiKey || '',
          defaultNetwork: parsed.defaultNetwork || 'ethereum'
        })
      }
    } catch (error) {
      console.warn('[Alchemy Settings] Failed to load config:', error)
    }
  }

  const saveConfig = async () => {
    try {
      setIsSaving(true)
      setSavedMessage('')

      const configToSave = {
        enabled: config.enabled,
        apiKey: config.apiKey || undefined,
        defaultNetwork: config.defaultNetwork
      }

      await plugin.call('settings', 'set', 'settings/mcp/alchemy', configToSave)
      setSavedMessage('Alchemy settings saved successfully! Please reload Remix IDE for changes to take effect.')

      setTimeout(() => {
        setSavedMessage('')
      }, 5000)
    } catch (error) {
      console.error('[Alchemy Settings] Failed to save config:', error)
      setSavedMessage('Failed to save settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleApiKeyChange = (value: string) => {
    setConfig({ ...config, apiKey: value })
  }

  const handleNetworkChange = (network: string) => {
    setConfig({
      ...config,
      defaultNetwork: network as 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base'
    })
  }

  const toggleEnabled = () => {
    setConfig({ ...config, enabled: !config.enabled })
  }

  return (
    <div className="alchemy-settings">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h6 className="mb-0">Alchemy Integration</h6>
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              checked={config.enabled}
              onChange={toggleEnabled}
              id="alchemyEnabled"
            />
            <label className="form-check-label" htmlFor="alchemyEnabled">
              {config.enabled ? 'Enabled' : 'Disabled'}
            </label>
          </div>
        </div>

        <div className="card-body">
          <div className="alert alert-info small mb-3">
            <strong>About Alchemy:</strong> Alchemy provides blockchain querying capabilities including token prices,
            balances, NFTs, and transaction history across multiple chains.
          </div>

          {config.enabled && (
            <>
              <div className="form-group mb-3">
                <label className="form-label">
                  <strong>API Key</strong>
                  <a
                    href="https://www.alchemy.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ms-2 small"
                  >
                    Get API Key
                  </a>
                </label>
                <div className="input-group">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className="form-control form-control-sm"
                    value={config.apiKey || ''}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="Enter your Alchemy API key"
                  />
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? '🙈' : '👁️'}
                  </button>
                </div>
                <small className="text-muted">
                  Your API key is stored locally and never shared.
                </small>
              </div>

              <div className="form-group mb-3">
                <label className="form-label">
                  <strong>Default Network</strong>
                </label>
                <select
                  className="form-select form-select-sm"
                  value={config.defaultNetwork}
                  onChange={(e) => handleNetworkChange(e.target.value)}
                >
                  <option value="ethereum">Ethereum Mainnet</option>
                  <option value="polygon">Polygon</option>
                  <option value="arbitrum">Arbitrum</option>
                  <option value="optimism">Optimism</option>
                  <option value="base">Base</option>
                </select>
                <small className="text-muted">
                  Default blockchain network for Alchemy queries.
                </small>
              </div>

              <div className="alert alert-warning small mb-3">
                <strong>⚠️ Note:</strong> Changes will take effect after reloading Remix IDE.
              </div>
            </>
          )}

          {!config.enabled && (
            <div className="alert alert-secondary small">
              Enable Alchemy integration to access blockchain querying tools for token prices,
              balances, NFTs, and transaction history.
            </div>
          )}

          <div className="d-flex gap-2 align-items-center">
            <button
              className="btn btn-sm btn-primary"
              onClick={saveConfig}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>

            {savedMessage && (
              <span className={`small ${savedMessage.includes('success') ? 'text-success' : 'text-danger'}`}>
                {savedMessage}
              </span>
            )}
          </div>

          {config.enabled && (
            <div className="mt-3">
              <hr />
              <h6 className="mb-2">Available Alchemy Tools</h6>
              <small className="text-muted">
                When enabled, the following tools are available in the MCP server:
              </small>
              <ul className="small mt-2">
                <li><strong>Price Tools:</strong> Token price queries (current & historical)</li>
                <li><strong>Balance Tools:</strong> Token balances across multiple chains</li>
                <li><strong>NFT Tools:</strong> NFT ownership and metadata queries</li>
                <li><strong>Transaction Tools:</strong> Transaction history and asset transfers</li>
              </ul>
              <small className="text-muted">
                Supported networks: Ethereum, Polygon, Arbitrum, Optimism, Base
              </small>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
