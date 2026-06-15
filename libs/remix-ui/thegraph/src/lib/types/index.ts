// Types for The Graph Subgraph Explorer

/**
 * Supported blockchain networks for The Graph
 */
export type SupportedNetwork =
  | 'mainnet'
  | 'arbitrum-one'
  | 'avalanche'
  | 'base'
  | 'bsc'
  | 'optimism'
  | 'polygon'
  | 'unichain'
  | 'sepolia'
  | 'goerli'

/**
 * Endpoint type for subgraph connections
 */
export type EndpointType = 'local' | 'studio' | 'custom'

/**
 * Connection status for endpoints
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error'

/**
 * Subgraph endpoint configuration
 */
export interface SubgraphEndpoint {
  id: string
  name: string
  type: EndpointType
  url: string
  network: SupportedNetwork
  subgraphId?: string // For Graph Studio subgraphs
  isActive: boolean
  status: ConnectionStatus
  lastConnected?: number
  error?: string
}

/**
 * GraphQL query result
 */
export interface QueryResult {
  data?: any
  errors?: GraphQLError[]
  executionTime: number
  timestamp: number
}

/**
 * GraphQL error structure
 */
export interface GraphQLError {
  message: string
  locations?: Array<{
    line: number
    column: number
  }>
  path?: string[]
  extensions?: Record<string, any>
}

/**
 * Schema introspection types
 */
export interface SchemaType {
  name: string
  kind: 'OBJECT' | 'SCALAR' | 'ENUM' | 'INPUT_OBJECT' | 'INTERFACE' | 'UNION'
  fields?: SchemaField[]
  enumValues?: string[]
  description?: string
}

export interface SchemaField {
  name: string
  type: string
  isRequired: boolean
  isList: boolean
  description?: string
  args?: SchemaArg[]
}

export interface SchemaArg {
  name: string
  type: string
  isRequired: boolean
  defaultValue?: any
  description?: string
}

export interface SubgraphSchema {
  types: SchemaType[]
  queryType: string
  mutationType?: string
  subscriptionType?: string
}

/**
 * Query template structure
 */
export interface QueryTemplate {
  id: string
  name: string
  description: string
  query: string
  variables?: Record<string, any>
  subgraphId?: string
  category?: string
  isBuiltIn: boolean
  createdAt: number
  updatedAt: number
}

/**
 * Saved query with metadata
 */
export interface SavedQuery {
  id: string
  name: string
  filePath: string
  endpoint: string
  network: SupportedNetwork
  query: string
  variables?: Record<string, any>
  description?: string
  createdAt: number
  updatedAt: number
}

/**
 * Query history entry
 */
export interface QueryHistoryEntry {
  id: string
  endpoint: string
  query: string
  variables?: Record<string, any>
  result?: QueryResult
  timestamp: number
}

/**
 * The Graph settings stored in remix-desktop
 */
export interface TheGraphSettings {
  studioApiKey: string
  defaultNetwork: SupportedNetwork
  localNodeUrl: string
  endpoints: SubgraphEndpoint[]
  queryHistory: {
    maxItems: number
    enabled: boolean
  }
  templates: QueryTemplate[]
}

/**
 * Default settings
 */
export const DEFAULT_THEGRAPH_SETTINGS: TheGraphSettings = {
  studioApiKey: '',
  defaultNetwork: 'mainnet',
  localNodeUrl: 'http://localhost:8000',
  endpoints: [],
  queryHistory: {
    maxItems: 50,
    enabled: true
  },
  templates: []
}

/**
 * Result view mode options
 */
export type ResultViewMode = 'json' | 'table' | 'tree'

/**
 * Panel state for the subgraph explorer
 */
export interface SubgraphPanelState {
  activeEndpoint: SubgraphEndpoint | null
  endpoints: SubgraphEndpoint[]
  schema: SubgraphSchema | null
  isLoadingSchema: boolean
  queryHistory: QueryHistoryEntry[]
  savedQueries: SavedQuery[]
  templates: QueryTemplate[]
  settings: TheGraphSettings
}

/**
 * Query tab state
 */
export interface QueryTabState {
  id: string
  name: string
  filePath?: string
  endpoint: SubgraphEndpoint | null
  query: string
  variables: string
  result: QueryResult | null
  isExecuting: boolean
  isDirty: boolean
  viewMode: ResultViewMode
}

/**
 * Plugin props passed to UI components
 */
export interface TheGraphPluginProps {
  plugin: any // ViewPlugin type
}

/**
 * Action types for state management
 */
export type SubgraphAction =
  | { type: 'SET_ACTIVE_ENDPOINT'; payload: SubgraphEndpoint | null }
  | { type: 'SET_ENDPOINTS'; payload: SubgraphEndpoint[] }
  | { type: 'ADD_ENDPOINT'; payload: SubgraphEndpoint }
  | { type: 'UPDATE_ENDPOINT'; payload: SubgraphEndpoint }
  | { type: 'REMOVE_ENDPOINT'; payload: string }
  | { type: 'SET_SCHEMA'; payload: SubgraphSchema | null }
  | { type: 'SET_LOADING_SCHEMA'; payload: boolean }
  | { type: 'ADD_HISTORY_ENTRY'; payload: QueryHistoryEntry }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'SET_SAVED_QUERIES'; payload: SavedQuery[] }
  | { type: 'ADD_SAVED_QUERY'; payload: SavedQuery }
  | { type: 'REMOVE_SAVED_QUERY'; payload: string }
  | { type: 'SET_TEMPLATES'; payload: QueryTemplate[] }
  | { type: 'ADD_TEMPLATE'; payload: QueryTemplate }
  | { type: 'REMOVE_TEMPLATE'; payload: string }
  | { type: 'SET_SETTINGS'; payload: Partial<TheGraphSettings> }
