/**
 * MCP (Model Context Protocol) types and interfaces for Remix AI integration
 */

export interface MCPServer {
  name: string;
  description?: string;
  transport: 'stdio' | 'sse' | 'websocket';
  command?: string[];
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  autoStart?: boolean;
  timeout?: number;
  enabled?: boolean;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  annotations?: {
    audience?: string[];
    priority?: number;
  };
}

export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface MCPToolCall {
  name: string;
  arguments?: Record<string, any>;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPServerCapabilities {
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  tools?: {
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: {};
  experimental?: Record<string, any>;
}

export interface MCPClientCapabilities {
  resources?: {
    subscribe?: boolean;
  };
  sampling?: {};
  roots?: {
    listChanged?: boolean;
  };
  experimental?: Record<string, any>;
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
  instructions?: string;
}

export interface MCPConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  serverName: string;
  error?: string;
  lastAttempt?: number;
  capabilities?: MCPServerCapabilities;
}

/**
 * MCP provider configuration for AI parameters
 */
export interface MCPProviderParams {
  mcpServers?: string[];
  maxResources?: number;
  resourcePriorityThreshold?: number;
  enableTools?: boolean;
  toolTimeout?: number;
}

/**
 * Intent analysis results
 */
export interface UserIntent {
  /** Primary intent type */
  type: 'coding' | 'documentation' | 'debugging' | 'explanation' | 'generation' | 'completion';
  /** Confidence score 0-1 */
  confidence: number;
  /** Extracted keywords */
  keywords: string[];
  /** Detected domains */
  domains: string[];
  /** Query complexity level */
  complexity: 'low' | 'medium' | 'high';
  /** Original query */
  originalQuery: string;
}

/**
 * Resource relevance score
 */
export interface ResourceScore {
  /** Resource reference */
  resource: MCPResource;
  /** Server name */
  serverName: string;
  /** Overall relevance score 0-1 */
  score: number;
  /** Breakdown of score components */
  components: {
    keywordMatch: number;
    domainRelevance: number;
    typeRelevance: number;
    priority: number;
    freshness: number;
  };
  /** Explanation of why this resource was selected */
  reasoning: string;
}

/**
 * Enhanced resource selection result
 */
export interface ResourceSelectionResult {
  /** Selected resources with scores */
  selectedResources: ResourceScore[];
  /** Total resources considered */
  totalResourcesConsidered: number;
  /** Selection strategy used */
  strategy: 'priority' | 'semantic' | 'hybrid';
  /** Intent analysis result */
  intent: UserIntent;
}

/**
 * Extended MCP provider configuration with intent matching
 */
export interface EnhancedMCPProviderParams extends MCPProviderParams {
  /** Enable intelligent resource selection */
  enableIntentMatching?: boolean;
  /** Minimum relevance score threshold */
  relevanceThreshold?: number;
  /** Resource selection strategy */
  selectionStrategy?: 'priority' | 'semantic' | 'hybrid';
  /** Domain-specific weights */
  domainWeights?: Record<string, number>;
  /** Enable query expansion */
  enableQueryExpansion?: boolean;
  /** Maximum query expansion terms */
  maxExpansionTerms?: number;
}

/**
 * Extended IParams interface with MCP support
 */
export interface MCPAwareParams {
  /** MCP-specific parameters */
  mcp?: EnhancedMCPProviderParams;
}