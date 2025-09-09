/**
 * Types and interfaces for Remix IDE MCP Server
 */

import { MCPServer, MCPServerCapabilities, MCPInitializeResult } from '../../types/mcp';
import { ICustomRemixApi } from '@remix-api';
import { ToolRegistry } from './mcpTools';
import { ResourceProviderRegistry } from './mcpResources';
import EventEmitter from 'events';

/**
 * Remix MCP Server configuration
 */
export interface RemixMCPServerConfig {
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Server description */
  description: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Maximum concurrent tool executions */
  maxConcurrentTools?: number;
  /** Tool execution timeout in milliseconds */
  toolTimeout?: number;
  /** Resource cache TTL in milliseconds */
  resourceCacheTTL?: number;
  /** Enable resource caching */
  enableResourceCache?: boolean;
  /** Security settings */
  security?: {
    /** Enable permission checking */
    enablePermissions?: boolean;
    /** Required permissions for server access */
    requiredPermissions?: string[];
    /** Allowed file patterns for file operations */
    allowedFilePatterns?: RegExp[];
    /** Blocked file patterns for file operations */
    blockedFilePatterns?: RegExp[];
    /** Enable audit logging */
    enableAuditLog?: boolean;
  };
  /** Feature flags */
  features?: {
    /** Enable compilation tools */
    compilation?: boolean;
    /** Enable deployment tools */
    deployment?: boolean;
    /** Enable debugging tools */
    debugging?: boolean;
    /** Enable analysis tools */
    analysis?: boolean;
    /** Enable testing tools */
    testing?: boolean;
    /** Enable git tools */
    git?: boolean;
  };
}

/**
 * MCP Server state
 */
export enum ServerState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error'
}

/**
 * MCP Server statistics
 */
export interface ServerStats {
  /** Server uptime in milliseconds */
  uptime: number;
  /** Total tool calls executed */
  totalToolCalls: number;
  /** Total resources served */
  totalResourcesServed: number;
  /** Active tool executions */
  activeToolExecutions: number;
  /** Resource cache hit rate */
  cacheHitRate: number;
  /** Error count */
  errorCount: number;
  /** Last activity timestamp */
  lastActivity: Date;
}

/**
 * Tool execution status
 */
export interface ToolExecutionStatus {
  /** Execution ID */
  id: string;
  /** Tool name */
  toolName: string;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime?: Date;
  /** Execution status */
  status: 'running' | 'completed' | 'failed' | 'timeout';
  /** Error message if failed */
  error?: string;
  /** Execution context */
  context: {
    workspace: string;
    user: string;
    permissions: string[];
  };
}

/**
 * Resource cache entry
 */
export interface ResourceCacheEntry {
  /** Resource URI */
  uri: string;
  /** Cached content */
  content: any;
  /** Cache timestamp */
  timestamp: Date;
  /** Cache TTL */
  ttl: number;
  /** Access count */
  accessCount: number;
  /** Last access time */
  lastAccess: Date;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  /** Entry ID */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** Event type */
  type: 'tool_call' | 'resource_access' | 'permission_check' | 'error';
  /** User identifier */
  user: string;
  /** Event details */
  details: {
    toolName?: string;
    resourceUri?: string;
    permission?: string;
    error?: string;
    args?: any;
    result?: any;
  };
  /** Event severity */
  severity: 'info' | 'warning' | 'error';
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  /** Check result */
  allowed: boolean;
  /** Reason if not allowed */
  reason?: string;
  /** Required permissions */
  requiredPermissions: string[];
  /** User permissions */
  userPermissions: string[];
}

/**
 * Remix MCP Server interface
 */
export interface IRemixMCPServer extends EventEmitter {
  /** Server configuration */
  readonly config: RemixMCPServerConfig;
  /** Server state */
  readonly state: ServerState;
  /** Server statistics */
  readonly stats: ServerStats;
  /** Tool registry */
  readonly tools: ToolRegistry;
  /** Resource registry */
  readonly resources: ResourceProviderRegistry;
  /** Remix API instance */
  readonly remixApi: ICustomRemixApi;

  /** Initialize the server */
  initialize(): Promise<MCPInitializeResult>;
  
  /** Start the server */
  start(): Promise<void>;
  
  /** Stop the server */
  stop(): Promise<void>;
  
  /** Get server capabilities */
  getCapabilities(): MCPServerCapabilities;
  
  /** Handle MCP protocol messages */
  handleMessage(message: any): Promise<any>;
  
  /** Check user permissions for operation */
  checkPermissions(operation: string, user: string, resource?: string): Promise<PermissionCheckResult>;
  
  /** Get active tool executions */
  getActiveExecutions(): ToolExecutionStatus[];
  
  /** Get resource cache statistics */
  getCacheStats(): {
    size: number;
    hitRate: number;
    entries: ResourceCacheEntry[];
  };
  
  /** Get audit log entries */
  getAuditLog(limit?: number): AuditLogEntry[];
  
  /** Clear resource cache */
  clearCache(): void;
  
  /** Refresh all resources */
  refreshResources(): Promise<void>;
}

/**
 * Server event types
 */
export interface ServerEvents {
  'state-changed': (newState: ServerState, oldState: ServerState) => void;
  'tool-executed': (execution: ToolExecutionStatus) => void;
  'resource-accessed': (uri: string, user: string) => void;
  'permission-denied': (operation: string, user: string, reason: string) => void;
  'error': (error: Error, context?: any) => void;
  'audit-log': (entry: AuditLogEntry) => void;
  'cache-cleared': () => void;
  'resources-refreshed': (count: number) => void;
}

/**
 * MCP message types
 */
export interface MCPMessage {
  id?: string;
  method: string;
  params?: any;
}

export interface MCPResponse {
  id?: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Error codes for MCP responses
 */
export enum MCPErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  PERMISSION_DENIED = -32000,
  TOOL_NOT_FOUND = -32001,
  TOOL_EXECUTION_ERROR = -32002,
  RESOURCE_NOT_FOUND = -32003,
  VALIDATION_ERROR = -32004,
  TIMEOUT_ERROR = -32005
}

/**
 * Server factory interface
 */
export interface RemixMCPServerFactory {
  create(config: RemixMCPServerConfig, remixApi: ICustomRemixApi): IRemixMCPServer;
}