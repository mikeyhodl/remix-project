import { CONVERSATION_THREAD_PREFIX, DeepAgentInferencer, IUserApiKeyConfig, API_KEYS_ALLOWED_PLANS } from '@remix/remix-ai-core'
import type { IRemixAIPlugin, ToolApprovalResponse } from './types'
import type { DeepAgentEventBridge } from './DeepAgentEventBridge'
import type { MCPServerManager } from './MCPServerManager'

export interface DeepAgentManagerDeps {
  plugin: IRemixAIPlugin
  eventBridge: DeepAgentEventBridge
  mcpManager: MCPServerManager
  setupDeepAgentEventListeners: () => void
}

export class DeepAgentManager {
  private deps: DeepAgentManagerDeps

  constructor(deps: DeepAgentManagerDeps) {
    this.deps = deps
  }

  private async canUseOwnApiKeys(): Promise<boolean> {
    try {
      const plugin = this.deps.plugin
      const permissions = await plugin.call('auth', 'getAllPermissions')
      const featureGroups = permissions?.feature_groups || []
      const hasPermission = featureGroups.some((fg: any) =>
        API_KEYS_ALLOWED_PLANS.includes(fg.name)
      )
      console.log('[DeepAgentManager] API keys permission check:', { hasPermission, featureGroups: featureGroups.map((fg: any) => fg.name) })
      return hasPermission
    } catch (error) {
      console.warn('[DeepAgentManager] Failed to check API keys permission:', error)
      return false
    }
  }

  private getSettingFromStorage(key: string): string | boolean {
    try {
      const storageKey = 'config-v0.8:.remix.config'
      const configData = localStorage.getItem(storageKey)
      if (configData) {
        const items = JSON.parse(configData)
        const value = items[`settings/${key}`]
        return value !== undefined ? value : ''
      }
      return ''
    } catch (error) {
      console.warn('[DeepAgentManager] Failed to read from storage:', error)
      return ''
    }
  }

  private async getUserApiKeysConfig(): Promise<IUserApiKeyConfig | undefined> {
    try {
      // First check if user has permission to use own API keys
      const hasPermission = await this.canUseOwnApiKeys()
      if (!hasPermission) {
        console.log('[DeepAgentManager] User does not have permission to use own API keys')
        return undefined
      }

      // Read directly from storage to ensure we get the latest values
      const useOwnKeysValue = this.getSettingFromStorage('deepagent-api-keys-config')
      const useOwnKeys = useOwnKeysValue === 'true' || useOwnKeysValue === true
      const anthropicApiKey = String(this.getSettingFromStorage('deepagent-anthropic-api-key') || '')
      const mistralApiKey = String(this.getSettingFromStorage('deepagent-mistral-api-key') || '')
      const openaiApiKey = String(this.getSettingFromStorage('deepagent-openai-api-key') || '')
      const moonshotApiKey = String(this.getSettingFromStorage('deepagent-moonshot-api-key') || '')

      // Debug logging to see what values are being read
      console.log('[DeepAgentManager] Reading API keys from storage:', {
        useOwnKeys,
        hasAnthropicKey: !!anthropicApiKey,
        hasMistralKey: !!mistralApiKey,
        hasOpenaiKey: !!openaiApiKey,
        hasMoonshotKey: !!moonshotApiKey,
        openaiKeyLength: openaiApiKey?.length || 0
      })

      // Auto-enable if any API key is set
      const hasAnyKey = anthropicApiKey || mistralApiKey || openaiApiKey || moonshotApiKey
      if (!useOwnKeys && !hasAnyKey) {
        return undefined
      }

      return {
        useOwnKeys: useOwnKeys || !!hasAnyKey,
        anthropicApiKey,
        mistralApiKey,
        openaiApiKey,
        moonshotApiKey
      }
    } catch (error) {
      console.warn('[DeepAgentManager] Failed to read user API keys config:', error)
      return undefined
    }
  }

  async enable(): Promise<void> {
    const plugin = this.deps.plugin

    try {
      if (!plugin.remixMCPServer) {
        throw new Error('RemixMCPServer not initialized')
      }

      console.log('[RemixAI Plugin] Enabling DeepAgent (API key handled by proxy)...')

      // Ensure MCP servers are fully ready before creating DeepAgent
      if (plugin.mcpInferencer) {
        await this.deps.mcpManager.waitForServersReady()
      }

      // Create or reinitialize DeepAgentInferencer
      console.log('[RemixAI Plugin] Using model for DeepAgent:', plugin.selectedModel.provider, plugin.selectedModelId)
      const userApiKeys = await this.getUserApiKeysConfig()
      if (userApiKeys?.useOwnKeys) {
        console.log('[RemixAI Plugin] Using user-provided API keys for DeepAgent')
      }
      plugin.deepAgentInferencer = new DeepAgentInferencer(
        plugin as any, // Cast to Plugin type
        plugin.remixMCPServer.tools,
        {
          memoryBackend: (localStorage.getItem('deepagent_memory_backend') as 'state' | 'store') || 'store',
          enableSubagents: true,
          enablePlanning: true,
          userApiKeys,
          autoMode: {
            enabled: localStorage.getItem('deepagent_auto_mode') === 'true',
            fallbackModel: {
              provider: 'mistralai',
              modelId: 'mistral-medium-latest'
            }
          }
        },
        plugin.remoteInferencer,
        plugin.mcpInferencer,
        { provider: plugin.selectedModel.provider as 'anthropic' | 'mistralai' | 'openai' | 'moonshot', modelId: plugin.selectedModelId }
      )

      await plugin.deepAgentInferencer.initialize()

      // Set up event listeners (centralized method prevents duplicates)
      this.deps.eventBridge.resetSetup()
      this.deps.setupDeepAgentEventListeners()

      plugin.deepAgentEnabled = true

      // Store settings
      localStorage.setItem('deepagent_enabled', 'true')

      console.log('[RemixAI Plugin] DeepAgent enabled successfully')

      // Apply pending thread_id if setDeepAgentThread was called before init completed
      if (plugin.pendingDeepAgentThreadId) {
        plugin.deepAgentInferencer.setSessionThreadId(plugin.pendingDeepAgentThreadId)
        plugin.pendingDeepAgentThreadId = null
      }
    } catch (error) {
      console.error('[RemixAI Plugin] Failed to enable DeepAgent:', error)
      plugin.deepAgentEnabled = false
      plugin.deepAgentInferencer = null
      throw error
    }
  }

  async disable(): Promise<void> {
    const plugin = this.deps.plugin
    console.log('[RemixAI Plugin] Disabling DeepAgent...')

    if (plugin.deepAgentInferencer) {
      this.deps.eventBridge.teardownListeners(plugin.deepAgentInferencer)
      await plugin.deepAgentInferencer.close()
    }

    plugin.deepAgentEnabled = false
    plugin.deepAgentInferencer = null

    // Store settings
    localStorage.setItem('deepagent_enabled', 'false')

    console.log('[RemixAI Plugin] DeepAgent disabled')
  }

  isEnabled(): boolean {
    return this.deps.plugin.deepAgentEnabled
  }

  async setAutoMode(enabled: boolean): Promise<void> {
    const plugin = this.deps.plugin
    console.log(`[RemixAI Plugin] ${enabled ? 'Enabling' : 'Disabling'} auto mode for DeepAgent`)

    if (plugin.deepAgentInferencer) {
      plugin.deepAgentInferencer.setAutoMode(enabled)
      console.log(`[RemixAI Plugin] Auto mode ${enabled ? 'enabled' : 'disabled'} for existing DeepAgent instance`)
    } else {
      console.warn('[RemixAI Plugin] DeepAgent not initialized, auto mode setting will apply when initialized')
    }

    // Store the auto mode preference
    localStorage.setItem('deepagent_auto_mode', enabled ? 'true' : 'false')
  }

  getAutoModeStatus(): boolean {
    const plugin = this.deps.plugin

    if (plugin.deepAgentInferencer) {
      return plugin.deepAgentInferencer.isAutoModeEnabled()
    }

    // Return stored preference if DeepAgent not initialized
    return localStorage.getItem('deepagent_auto_mode') === 'true'
  }

  /**
   * Set DeepAgent thread for an existing conversation.
   * Uses conversationId as part of thread_id so MemorySaver restores that conversation's context.
   * If DeepAgent is not yet initialized, stores the thread_id for later application.
   */
  setThread(conversationId: string): void {
    const plugin = this.deps.plugin
    const threadId = `${CONVERSATION_THREAD_PREFIX}${conversationId}`

    if (plugin.deepAgentInferencer) {
      plugin.deepAgentInferencer.setSessionThreadId(threadId)
      plugin.pendingDeepAgentThreadId = null
      console.log('[DeepAgent-Thread] Plugin: thread set for conversation:', conversationId, '->', threadId)
    } else {
      // DeepAgent not yet initialized - store for later
      plugin.pendingDeepAgentThreadId = threadId
      console.log('[DeepAgent-Thread] Plugin: thread PENDING (DeepAgent not ready):', conversationId, '->', threadId)
    }
  }

  respondToToolApproval(response: ToolApprovalResponse): void {
    const plugin = this.deps.plugin

    if (plugin.deepAgentInferencer) {
      plugin.deepAgentInferencer.getEventEmitter().emit('onToolApprovalResponse', response)
    }
  }

  cancelRequest(): void {
    const plugin = this.deps.plugin

    if (plugin.deepAgentEnabled && plugin.deepAgentInferencer) {
      plugin.deepAgentInferencer.cancelRequest()
    }
  }

  /**
   * Reinitialize DeepAgent with current settings.
   * Used when MCP servers are refreshed, reset, or API key settings change.
   */
  async reinitialize(): Promise<void> {
    const plugin = this.deps.plugin
    // Use actual plugin state - default is enabled, localStorage is only set when explicitly changed
    const deepAgentEnabled = plugin.deepAgentEnabled || plugin.deepAgentInferencer !== null

    if (deepAgentEnabled && plugin.remixMCPServer) {
      try {
        console.log('[RemixAI Plugin] Reinitializing DeepAgent after MCP server reset...')

        // Clean up old instance first
        if (plugin.deepAgentInferencer) {
          this.deps.eventBridge.teardownListeners(plugin.deepAgentInferencer)
          await plugin.deepAgentInferencer.close()
        }

        console.log('[RemixAI Plugin] Using model for DeepAgent:', plugin.selectedModel.provider, plugin.selectedModelId)
        const userApiKeys = await this.getUserApiKeysConfig()
        if (userApiKeys?.useOwnKeys) {
          console.log('[RemixAI Plugin] Using user-provided API keys for DeepAgent (reinitialize)')
        }
        plugin.deepAgentInferencer = new DeepAgentInferencer(
          plugin as any, // Cast to Plugin type
          plugin.remixMCPServer.tools,
          {
            memoryBackend: (localStorage.getItem('deepagent_memory_backend') as 'state' | 'store') || 'store',
            enableSubagents: true,
            enablePlanning: true,
            userApiKeys
          },
          plugin.remoteInferencer,
          plugin.mcpInferencer,
          { provider: plugin.selectedModel.provider as 'anthropic' | 'mistralai' | 'openai' | 'moonshot', modelId: plugin.selectedModelId }
        )
        await plugin.deepAgentInferencer.initialize()
        plugin.deepAgentEnabled = true

        // Set up event listeners (reset flag first)
        this.deps.eventBridge.resetSetup()
        this.deps.setupDeepAgentEventListeners()

        console.log('[RemixAI Plugin] DeepAgent reinitialized successfully')
      } catch (error) {
        console.error('[RemixAI Plugin] Failed to reinitialize DeepAgent:', error)
        plugin.deepAgentEnabled = false
        plugin.deepAgentInferencer = null
      }
    }
  }
}
