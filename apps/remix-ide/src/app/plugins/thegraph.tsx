// The Graph Subgraph Plugin for Remix IDE
// A simple plugin to execute GraphQL queries from .subgraph files

import { Plugin } from '@remixproject/engine'
import { parseGraphQLFile, validateGraphQLSyntax } from '@remix-ui/thegraph'
import * as packageJson from '../../../../../package.json'

interface SubgraphSettings {
  defaultEndpoint?: string
  endpoints?: SubgraphEndpoint[]
}

interface SubgraphEndpoint {
  name: string
  url: string
  network?: string
}

interface QueryResult {
  data?: any
  errors?: any[]
  executionTime: number
}

type SubgraphEndpointKind = 'local' | 'thegraph-gateway' | 'generic-graphql'
type SubgraphValidationError = 'missing-endpoint' | 'missing-query' | 'invalid-query' | 'invalid-variables-json'
type SubgraphValidationWarning = 'missing-network' | 'missing-description' | 'missing-sample-result' | 'endpoint-needs-api-key' | 'local-endpoint'

interface SubgraphFileValidation {
  canGenerateDapp: boolean
  errors: SubgraphValidationError[]
  warnings: SubgraphValidationWarning[]
  missingFields: string[]
}

interface SubgraphFileContext {
  source: 'subgraph-file'
  filePath: string
  resultFilePath?: string
  endpoint?: string
  endpointKind?: SubgraphEndpointKind
  endpointNeedsApiKey: boolean
  apiKeySource: 'remix-settings' | 'runtime-input' | 'none'
  apiKeyPresent: boolean
  subgraphId?: string
  network?: string
  description?: string
  query: string
  variables?: Record<string, any>
  operationName?: string
  operationType?: 'query' | 'mutation' | 'subscription'
  sampleResult?: any
  validation: SubgraphFileValidation
}

interface EndpointAnalysis {
  endpoint?: string
  endpointKind?: SubgraphEndpointKind
  endpointNeedsApiKey: boolean
  apiKeySource: 'remix-settings' | 'runtime-input' | 'none'
  subgraphId?: string
}

const profile = {
  name: 'thegraph',
  displayName: 'The Graph',
  description: 'Execute GraphQL queries against The Graph subgraphs',
  version: packageJson.version,
  maintainedBy: 'Remix',
  permission: true,
  events: ['queryExecuted'],
  methods: ['runSubgraphFile', 'getSubgraphFileContext', 'executeQuery', 'getSettings', 'saveSettings', 'getDefaultEndpoint', 'setDefaultEndpoint']
}

/**
 * The Graph Plugin
 * Executes GraphQL queries from .subgraph files
 */
export class TheGraphPlugin extends Plugin {
  private settings: SubgraphSettings = {}

  constructor() {
    super(profile)
  }

  async onActivation() {
    // Load settings from config
    try {
      const savedSettings = await this.call('config', 'getAppParameter', 'thegraph-settings')
      if (savedSettings) {
        this.settings = JSON.parse(savedSettings)
      }
    } catch (e) {
      console.warn('[TheGraph] Failed to load settings:', e)
    }
  }

  /**
   * Run a subgraph file
   * Parses the file, executes the query, and saves results
   * @param pathOrCmd - Either a file path string or a context menu command object
   */
  async runSubgraphFile(pathOrCmd: string | { path: string[] }): Promise<QueryResult> {
    const path = typeof pathOrCmd === 'string' ? pathOrCmd : pathOrCmd.path[0]

    try {
      await this.call('terminal', 'log', {
        type: 'info',
        value: `[TheGraph] Running subgraph query: ${path}`
      })
      const content = await this.call('fileManager', 'readFile', path)
      const parsed = parseGraphQLFile(content)
      const validation = validateGraphQLSyntax(parsed.query)

      if (!validation.valid) {
        const errorMsg = `[TheGraph] Invalid query syntax: ${validation.error}`
        await this.call('terminal', 'log', { type: 'error', value: errorMsg })
        throw new Error(validation.error)
      }
      const endpoint = parsed.metadata.endpoint || this.settings.defaultEndpoint

      if (!endpoint) {
        const errorMsg = '[TheGraph] No endpoint specified. Add "# @endpoint: <url>" to your file or set a default endpoint.'
        await this.call('terminal', 'log', { type: 'error', value: errorMsg })
        throw new Error('No endpoint specified')
      }
      const result = await this.executeQuery(endpoint, parsed.query, parsed.metadata.variables)
      const resultPath = path.replace('.subgraph', '.result.json')
      const resultContent = JSON.stringify(result.data || { errors: result.errors }, null, 2)

      await this.call('fileManager', 'writeFile', resultPath, resultContent)
      await this.call('terminal', 'log', {
        type: 'info',
        value: `[TheGraph] Query executed in ${result.executionTime}ms. Results saved to ${resultPath}`
      })
      try {
        await this.call('editor', 'openSplitView', path, resultPath, resultContent)
      } catch (splitViewError) {
        console.warn('[TheGraph] Split view failed, opening result file instead:', splitViewError)
        await this.call('fileManager', 'open', resultPath)
      }
      this.emit('queryExecuted', { path, result })

      return result
    } catch (error: any) {
      const errorMsg = `[TheGraph] Error executing query: ${error.message}`
      await this.call('terminal', 'log', { type: 'error', value: errorMsg })
      throw error
    }
  }

  /**
   * Build a sanitized, generation-ready context from a .subgraph file.
   * This never returns The Graph API key values.
   */
  async getSubgraphFileContext(pathOrCmd: string | { path: string[] }): Promise<SubgraphFileContext> {
    const path = typeof pathOrCmd === 'string' ? pathOrCmd : pathOrCmd.path[0]

    const content = await this.call('fileManager', 'readFile', path)
    const parsed = parseGraphQLFile(content)
    const variablesParseError = this.getVariablesParseError(content)
    const endpoint = parsed.metadata.endpoint || this.settings.defaultEndpoint
    const endpointInfo = this.analyzeEndpoint(endpoint)
    const apiKeyPresent = await this.hasTheGraphApiKey()
    const validation = this.validateSubgraphContext({
      endpoint: endpointInfo.endpoint,
      query: parsed.query,
      network: parsed.metadata.network,
      description: parsed.metadata.description,
      endpointKind: endpointInfo.endpointKind,
      endpointNeedsApiKey: endpointInfo.endpointNeedsApiKey,
      variablesParseError
    })
    const resultContext = await this.readSampleResult(path)

    if (!resultContext.sampleResult) {
      this.addWarning(validation, 'missing-sample-result')
    }

    const context: SubgraphFileContext = {
      source: 'subgraph-file',
      filePath: path,
      resultFilePath: resultContext.resultFilePath,
      endpoint: endpointInfo.endpoint,
      endpointKind: endpointInfo.endpointKind,
      endpointNeedsApiKey: endpointInfo.endpointNeedsApiKey,
      apiKeySource: endpointInfo.apiKeySource,
      apiKeyPresent,
      subgraphId: endpointInfo.subgraphId,
      network: parsed.metadata.network,
      description: parsed.metadata.description,
      query: parsed.query,
      variables: parsed.metadata.variables,
      operationName: parsed.operationName,
      operationType: parsed.operationType,
      sampleResult: resultContext.sampleResult,
      validation
    }

    console.log('[TheGraph:QD:Context]', {
      filePath: context.filePath,
      endpointKind: context.endpointKind,
      endpointNeedsApiKey: context.endpointNeedsApiKey,
      apiKeyPresent: context.apiKeyPresent,
      operationName: context.operationName,
      queryLength: context.query.length,
      variablesKeys: Object.keys(context.variables || {}),
      canGenerateDapp: context.validation.canGenerateDapp,
      errors: context.validation.errors,
      warnings: context.validation.warnings
    })

    return context
  }

  /**
   * Get the API key from settings and format the endpoint URL if needed
   */
  private async getFormattedEndpoint(endpoint: string): Promise<string> {
    // Pattern to match any placeholder wrapped in square brackets [...] or curly brackets {...}
    const placeholderPattern = /\[[^\]]*\]|\{[^}]*\}/g

    if (placeholderPattern.test(endpoint)) {
      try {
        const apiKey = await this.call('config', 'getAppParameter', 'settings/thegraph-access-token')
        if (apiKey) {
          return endpoint.replace(/\[[^\]]*\]|\{[^}]*\}/g, apiKey)
        } else {
          const errorMsg = '[TheGraph] No API key configured. Please add your API key in Settings > Connected Services > The Graph API Key.'
          await this.call('terminal', 'log', { type: 'error', value: errorMsg })
          throw new Error(errorMsg)
        }
      } catch (e: any) {
        if (e.message.includes('[TheGraph]')) {
          throw e
        }
        console.warn('[TheGraph] Failed to get API key from settings:', e)
        throw new Error('[TheGraph] Failed to get API key from settings.')
      }
    }

    // Check if this is a gateway.thegraph.com URL that needs an API key
    const gatewayPattern = /^https:\/\/gateway\.thegraph\.com\/api\/subgraphs\/id\/(.+)$/
    const match = endpoint.match(gatewayPattern)

    if (match) {
      try {
        const apiKey = await this.call('config', 'getAppParameter', 'settings/thegraph-access-token')
        if (apiKey) {
          const subgraphId = match[1]
          return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`
        } else {
          await this.call('terminal', 'log', {
            type: 'warn',
            value: '[TheGraph] No API key configured. Please add your API key in Settings > Connected Services > The Graph API Key.'
          })
        }
      } catch (e) {
        console.warn('[TheGraph] Failed to get API key from settings:', e)
      }
    }

    return endpoint
  }

  /**
   * Execute a GraphQL query against an endpoint
   */
  async executeQuery(endpoint: string, query: string, variables?: Record<string, any>): Promise<QueryResult> {
    const startTime = Date.now()

    try {
      const formattedEndpoint = await this.getFormattedEndpoint(endpoint)
      const response = await fetch(formattedEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: variables || {}
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const executionTime = Date.now() - startTime

      if (data.errors && data.errors.length > 0) {
        for (const err of data.errors) {
          await this.call('terminal', 'log', {
            type: 'warn',
            value: `[TheGraph] GraphQL Error: ${err.message}`
          })
        }
      }

      return {
        data: data.data,
        errors: data.errors,
        executionTime
      }
    } catch (error: any) {
      const executionTime = Date.now() - startTime
      return {
        errors: [{ message: error.message }],
        executionTime
      }
    }
  }

  /**
   * Get current settings
   */
  async getSettings(): Promise<SubgraphSettings> {
    return this.settings
  }

  /**
   * Save settings
   */
  async saveSettings(settings: SubgraphSettings): Promise<void> {
    this.settings = { ...this.settings, ...settings }
    try {
      await this.call('config', 'setAppParameter', 'thegraph-settings', JSON.stringify(this.settings))
    } catch (e) {
      console.warn('[TheGraph] Failed to save settings:', e)
    }
  }

  /**
   * Get default endpoint
   */
  async getDefaultEndpoint(): Promise<string | undefined> {
    return this.settings.defaultEndpoint
  }

  /**
   * Set default endpoint
   */
  async setDefaultEndpoint(endpoint: string): Promise<void> {
    this.settings.defaultEndpoint = endpoint
    await this.saveSettings(this.settings)
  }

  private analyzeEndpoint(endpoint?: string): EndpointAnalysis {
    if (!endpoint || !endpoint.trim()) {
      return {
        endpoint: undefined,
        endpointNeedsApiKey: false,
        apiKeySource: 'none'
      }
    }

    const trimmedEndpoint = endpoint.trim()
    const gatewayWithKeyPattern = /^https:\/\/gateway\.thegraph\.com\/api\/([^/]+)\/subgraphs\/id\/([^/?#]+).*$/i
    const gatewayWithoutKeyPattern = /^https:\/\/gateway\.thegraph\.com\/api\/subgraphs\/id\/([^/?#]+).*$/i
    const gatewayWithKeyMatch = trimmedEndpoint.match(gatewayWithKeyPattern)
    const gatewayWithoutKeyMatch = trimmedEndpoint.match(gatewayWithoutKeyPattern)

    if (gatewayWithoutKeyMatch) {
      const subgraphId = gatewayWithoutKeyMatch[1]
      return {
        endpoint: `https://gateway.thegraph.com/api/subgraphs/id/${subgraphId}`,
        endpointKind: 'thegraph-gateway',
        endpointNeedsApiKey: true,
        apiKeySource: 'remix-settings',
        subgraphId
      }
    }

    if (gatewayWithKeyMatch) {
      const subgraphId = gatewayWithKeyMatch[2]
      return {
        endpoint: `https://gateway.thegraph.com/api/subgraphs/id/${subgraphId}`,
        endpointKind: 'thegraph-gateway',
        endpointNeedsApiKey: true,
        apiKeySource: 'remix-settings',
        subgraphId
      }
    }

    const endpointKind = this.isLocalEndpoint(trimmedEndpoint) ? 'local' : 'generic-graphql'
    const endpointNeedsApiKey = this.hasEndpointPlaceholder(trimmedEndpoint)

    return {
      endpoint: trimmedEndpoint,
      endpointKind,
      endpointNeedsApiKey,
      apiKeySource: endpointNeedsApiKey ? 'remix-settings' : 'none'
    }
  }

  private validateSubgraphContext(args: {
    endpoint?: string
    query: string
    network?: string
    description?: string
    endpointKind?: SubgraphEndpointKind
    endpointNeedsApiKey: boolean
    variablesParseError?: string
  }): SubgraphFileValidation {
    const errors: SubgraphValidationError[] = []
    const warnings: SubgraphValidationWarning[] = []
    const missingFields: string[] = []

    if (!args.endpoint) {
      errors.push('missing-endpoint')
      missingFields.push('endpoint')
    }

    if (!args.query.trim()) {
      errors.push('missing-query')
      missingFields.push('query')
    } else {
      const queryValidation = validateGraphQLSyntax(args.query)
      if (!queryValidation.valid) {
        errors.push('invalid-query')
      }
    }

    if (args.variablesParseError) {
      errors.push('invalid-variables-json')
      missingFields.push('variables')
    }

    if (!args.network) {
      warnings.push('missing-network')
    }

    if (!args.description) {
      warnings.push('missing-description')
    }

    if (args.endpointNeedsApiKey) {
      warnings.push('endpoint-needs-api-key')
    }

    if (args.endpointKind === 'local') {
      warnings.push('local-endpoint')
    }

    return {
      canGenerateDapp: errors.length === 0,
      errors,
      warnings,
      missingFields
    }
  }

  private addWarning(validation: SubgraphFileValidation, warning: SubgraphValidationWarning): void {
    if (!validation.warnings.includes(warning)) {
      validation.warnings.push(warning)
    }
  }

  private getVariablesParseError(content: string): string | undefined {
    const variablesMatch = content.match(/^#\s*@variables:\s*(.+)$/m)
    if (!variablesMatch) return undefined

    try {
      JSON.parse(variablesMatch[1].trim())
      return undefined
    } catch (e: any) {
      return e?.message || 'Invalid variables JSON'
    }
  }

  private async readSampleResult(path: string): Promise<{ resultFilePath?: string; sampleResult?: any }> {
    const resultPath = path.replace(/\.subgraph$/i, '.result.json')
    if (resultPath === path) return {}

    try {
      const resultContent = await this.call('fileManager', 'readFile', resultPath)
      const sampleResult = this.truncateSampleResult(JSON.parse(resultContent))
      return {
        resultFilePath: resultPath,
        sampleResult
      }
    } catch {
      return {}
    }
  }

  private truncateSampleResult(sampleResult: any, maxChars = 12000): any {
    try {
      const serialized = JSON.stringify(sampleResult)
      if (!serialized || serialized.length <= maxChars) {
        return sampleResult
      }

      return {
        __truncated: true,
        preview: serialized.slice(0, maxChars)
      }
    } catch {
      return undefined
    }
  }

  private hasEndpointPlaceholder(endpoint: string): boolean {
    return /\[[^\]]*\]|\{[^}]*\}/g.test(endpoint)
  }

  private isLocalEndpoint(endpoint: string): boolean {
    if (/^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(endpoint)) {
      return true
    }

    try {
      const parsed = new URL(endpoint)
      return ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1'].includes(parsed.hostname)
    } catch {
      return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(endpoint)
    }
  }

  private async hasTheGraphApiKey(): Promise<boolean> {
    try {
      const apiKey = await this.call('config', 'getAppParameter', 'settings/thegraph-access-token')
      return Boolean(apiKey)
    } catch (e) {
      console.warn('[TheGraph:QD:Context] Failed to check The Graph API key presence:', e)
      return false
    }
  }
}
