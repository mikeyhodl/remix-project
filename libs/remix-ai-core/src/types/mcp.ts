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
 * Extended IParams interface with MCP support
 */
export interface MCPAwareParams {
  /** MCP-specific parameters */
  mcp?: MCPProviderParams;
}