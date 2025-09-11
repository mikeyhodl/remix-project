import { ICompletions, IGeneration, IParams, AIRequestType } from "../../types/types";
import { GenerationParams, CompletionParams, InsertionParams } from "../../types/models";
import { RemoteInferencer } from "../remote/remoteInference";
import EventEmitter from "events";
import {
  IMCPServer,
  IMCPResource,
  IMCPResourceContent,
  IMCPTool,
  IMCPToolCall,
  IMCPToolResult,
  IMCPConnectionStatus,
  IMCPInitializeResult,
  IMCPProviderParams,
  IMCPAwareParams,
  IEnhancedMCPProviderParams,
  IUserIntent,
  IResourceScore,
  IResourceSelectionResult
} from "../../types/mcp";
import { IntentAnalyzer } from "../../services/intentAnalyzer";
import { ResourceScoring } from "../../services/resourceScoring";
import { RemixMCPServer } from '@remix/remix-ai-core';

export class MCPClient {
  private server: IMCPServer;
  private connected: boolean = false;
  private capabilities?: any;
  private eventEmitter: EventEmitter;
  private resources: IMCPResource[] = [];
  private tools: IMCPTool[] = [];
  private remixMCPServer?: RemixMCPServer; // Will be injected for internal transport
  
  // SSE connection properties
  private eventSource?: EventSource;
  private pendingRequests: Map<number, {resolve: Function, reject: Function, timeout: NodeJS.Timeout}> = new Map();
  private requestId: number = 1;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout?: NodeJS.Timeout;

  constructor(server: IMCPServer, remixMCPServer?: any) {
    this.server = server;
    this.eventEmitter = new EventEmitter();
    this.remixMCPServer = remixMCPServer;
  }

  async connect(): Promise<IMCPInitializeResult> {
    try {
      console.log(`[MCP] Connecting to server: ${this.server.name} (transport: ${this.server.transport})`);
      this.eventEmitter.emit('connecting', this.server.name);

      if (this.server.transport === 'internal') {
        // Handle internal transport using RemixMCPServer
        if (!this.remixMCPServer) {
          throw new Error(`Internal RemixMCPServer not available for ${this.server.name}`);
        }

        console.log(`[MCP] Connecting to internal RemixMCPServer: ${this.server.name}`);
        const result = await this.remixMCPServer.initialize();
        this.connected = true;
        this.capabilities = result.capabilities;
        
        console.log(`[MCP] Successfully connected to internal server ${this.server.name}`);
        this.eventEmitter.emit('connected', this.server.name, result);
        return result;

      } else if (this.server.transport === 'sse') {
        // Handle SSE transport
        if (!this.server.url) {
          throw new Error(`SSE URL not specified for server ${this.server.name}`);
        }

        console.log(`[MCP] Establishing SSE connection to ${this.server.name} at ${this.server.url}...`);
        const result = await this.connectSSE();
        console.log(`[MCP] SSE connection established with ${this.server.name}`);
        return result;

      } else {
        // TODO: Implement stdio and websocket transports
        console.log(`[MCP] Transport ${this.server.transport} not yet implemented, using placeholder for ${this.server.name}...`);
        await this.delay(1000); // Simulate connection delay

        this.connected = true;
        console.log(`[MCP] Successfully connected to ${this.server.name}`);
        this.capabilities = {
          resources: { subscribe: true, listChanged: true },
          tools: { listChanged: true },
          prompts: { listChanged: true }
        };

        const result: IMCPInitializeResult = {
          protocolVersion: "2024-11-05",
          capabilities: this.capabilities,
          serverInfo: {
            name: this.server.name,
            version: "1.0.0"
          },
          instructions: `Connected to ${this.server.name} MCP server (placeholder)`
        };

        this.eventEmitter.emit('connected', this.server.name, result);
        console.log(`[MCP] Connection established with capabilities:`, this.capabilities);
        return result;
      }

    } catch (error) {
      console.error(`[MCP] Failed to connect to ${this.server.name}:`, error);
      this.eventEmitter.emit('error', this.server.name, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      console.log(`[MCP] Disconnecting from server: ${this.server.name}`);
      
      // Handle different transport types
      if (this.server.transport === 'sse') {
        this.closeSSE();
      } else if (this.server.transport === 'internal' && this.remixMCPServer) {
        await this.remixMCPServer.stop();
      }
      
      this.connected = false;
      this.resources = [];
      this.tools = [];
      this.eventEmitter.emit('disconnected', this.server.name);
      console.log(`[MCP] Disconnected from ${this.server.name}`);
    }
  }

  async listResources(): Promise<IMCPResource[]> {
    if (!this.connected) {
      console.error(`[MCP] Cannot list resources - ${this.server.name} is not connected`);
      throw new Error(`MCP server ${this.server.name} is not connected`);
    }

    console.log(`[MCP] Listing resources from ${this.server.name}...`);
    
    if (this.server.transport === 'internal' && this.remixMCPServer) {
      // Use internal RemixMCPServer
      const response = await this.remixMCPServer.handleMessage({
        id: Date.now().toString(),
        method: 'resources/list',
        params: {}
      });
      
      if (response.error) {
        throw new Error(`Failed to list resources: ${response.error.message}`);
      }
      
      this.resources = response.result.resources || [];
      console.log(`[MCP] Found ${this.resources.length} resources from internal server ${this.server.name}:`, this.resources.map(r => r.name));
      return this.resources;

    } else if (this.server.transport === 'sse') {
      // Use SSE transport
      const result = await this.sendSSEMessage({
        jsonrpc: '2.0',
        method: 'resources/list',
        params: {}
      });
      
      this.resources = result.resources || [];
      console.log(`[MCP] Found ${this.resources.length} resources from SSE server ${this.server.name}:`, this.resources.map(r => r.name));
      return this.resources;

    } else {
      // TODO: Implement actual resource listing for external servers
      // Placeholder implementation
      const mockResources: IMCPResource[] = [
        {
          uri: `file://${this.server.name}/README.md`,
          name: "README",
          description: "Project documentation",
          mimeType: "text/markdown"
        }
      ];

      this.resources = mockResources;
      console.log(`[MCP] Found ${mockResources.length} resources from ${this.server.name}:`, mockResources.map(r => r.name));
      return mockResources;
    }
  }

  async readResource(uri: string): Promise<IMCPResourceContent> {
    if (!this.connected) {
      console.error(`[MCP] Cannot read resource - ${this.server.name} is not connected`);
      throw new Error(`MCP server ${this.server.name} is not connected`);
    }

    console.log(`[MCP] Reading resource: ${uri} from ${this.server.name}`);
    
    if (this.server.transport === 'internal' && this.remixMCPServer) {
      // Use internal RemixMCPServer
      const response = await this.remixMCPServer.handleMessage({
        id: Date.now().toString(),
        method: 'resources/read',
        params: { uri }
      });
      
      if (response.error) {
        throw new Error(`Failed to read resource: ${response.error.message}`);
      }
      
      console.log(`[MCP] Resource read successfully from internal server: ${uri}`);
      return response.result;

    } else if (this.server.transport === 'sse') {
      // Use SSE transport
      const result = await this.sendSSEMessage({
        jsonrpc: '2.0',
        method: 'resources/read',
        params: { uri }
      });
      
      console.log(`[MCP] Resource read successfully from SSE server: ${uri}`);
      return result;

    } else {
      // TODO: Implement actual resource reading for external servers
      const content: IMCPResourceContent = {
        uri,
        mimeType: "text/plain",
        text: `Content from ${uri} via ${this.server.name}`
      };
      console.log(`[MCP] Resource read successfully: ${uri}`);
      return content;
    }
  }

  async listTools(): Promise<IMCPTool[]> {
    if (!this.connected) {
      console.error(`[MCP] Cannot list tools - ${this.server.name} is not connected`);
      throw new Error(`MCP server ${this.server.name} is not connected`);
    }

    console.log(`[MCP] Listing tools from ${this.server.name}...`);
    
    if (this.server.transport === 'internal' && this.remixMCPServer) {
      // Use internal RemixMCPServer
      const response = await this.remixMCPServer.handleMessage({
        id: Date.now().toString(),
        method: 'tools/list',
        params: {}
      });
      
      if (response.error) {
        throw new Error(`Failed to list tools: ${response.error.message}`);
      }
      
      this.tools = response.result.tools || [];
      console.log(`[MCP] Found ${this.tools.length} tools from internal server ${this.server.name}:`, this.tools.map(t => t.name));
      return this.tools;

    } else if (this.server.transport === 'sse') {
      // Use SSE transport
      const result = await this.sendSSEMessage({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {}
      });
      
      this.tools = result.tools || [];
      console.log(`[MCP] Found ${this.tools.length} tools from SSE server ${this.server.name}:`, this.tools.map(t => t.name));
      return this.tools;

    } else {
      // TODO: Implement actual tool listing for external servers
      const mockTools: IMCPTool[] = [
        {
          name: "file_read",
          description: "Read file contents",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string" }
            },
            required: ["path"]
          }
        }
      ];

      this.tools = mockTools;
      console.log(`[MCP] Found ${mockTools.length} tools from ${this.server.name}:`, mockTools.map(t => t.name));
      return mockTools;
    }
  }

  async callTool(toolCall: IMCPToolCall): Promise<IMCPToolResult> {
    if (!this.connected) {
      console.error(`[MCP] Cannot call tool - ${this.server.name} is not connected`);
      throw new Error(`MCP server ${this.server.name} is not connected`);
    }

    console.log(`[MCP] Calling tool: ${toolCall.name} with args:`, toolCall.arguments);
    
    if (this.server.transport === 'internal' && this.remixMCPServer) {
      // Use internal RemixMCPServer
      const response = await this.remixMCPServer.handleMessage({
        id: Date.now().toString(),
        method: 'tools/call',
        params: toolCall
      });
      
      if (response.error) {
        throw new Error(`Failed to call tool: ${response.error.message}`);
      }
      
      console.log(`[MCP] Tool ${toolCall.name} executed successfully on internal server`);
      return response.result;

    } else if (this.server.transport === 'sse') {
      // Use SSE transport
      const result = await this.sendSSEMessage({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: toolCall
      });
      
      console.log(`[MCP] Tool ${toolCall.name} executed successfully on SSE server`);
      return result;

    } else {
      // TODO: Implement actual tool execution for external servers
      const result: IMCPToolResult = {
        content: [{
          type: 'text',
          text: `Tool ${toolCall.name} executed with args: ${JSON.stringify(toolCall.arguments)}`
        }]
      };
      console.log(`[MCP] Tool ${toolCall.name} executed successfully`);
      return result;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getServerName(): string {
    return this.server.name;
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Check if the server has a specific capability
   */
  hasCapability(capability: string): boolean {
    if (!this.capabilities) return false;
    
    const parts = capability.split('.');
    let current = this.capabilities;
    
    for (const part of parts) {
      if (current[part] === undefined) return false;
      current = current[part];
    }
    
    return !!current;
  }

  /**
   * Get server capabilities
   */
  getCapabilities(): any {
    return this.capabilities;
  }

  /**
   * Connect to MCP server via SSE
   */
  private async connectSSE(): Promise<IMCPInitializeResult> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[MCP] Creating SSE connection to ${this.server.url} for ${this.server.name}...`);
        
        if (!this.server.url) {
          throw new Error(`No URL configured for SSE server ${this.server.name}`);
        }

        // Check if EventSource is supported
        if (typeof EventSource === 'undefined') {
          throw new Error('EventSource (SSE) is not supported in this environment');
        }
        
        // For MCP over SSE, the URL should be the SSE endpoint
        // The server will send MCP messages as SSE events
        this.eventSource = new EventSource(this.server.url, {
          withCredentials: false // Can be configured per server if needed
        });
        
        // Set up event handlers
        this.eventSource.onopen = () => {
          console.log(`[MCP] SSE connection opened to ${this.server.name}`);
          this.reconnectAttempts = 0;
          
          // Send initialization via HTTP POST to the control endpoint
          this.initializeSSEConnection()
            .then((result) => {
              this.connected = true;
              this.capabilities = result.capabilities;
              console.log(`[MCP] SSE initialization successful for ${this.server.name}:`, result);
              this.eventEmitter.emit('connected', this.server.name, result);
              resolve(result);
            })
            .catch((error) => {
              console.error(`[MCP] SSE initialization failed for ${this.server.name}:`, error);
              this.eventSource?.close();
              reject(error);
            });
        };
        
        this.eventSource.onmessage = (event) => {
          this.handleSSEMessage(event);
        };
        
        this.eventSource.onerror = (error) => {
          console.error(`[MCP] SSE connection error for ${this.server.name}:`, error);
          if (this.connected && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else {
            this.eventEmitter.emit('error', this.server.name, new Error('SSE connection error'));
            if (!this.connected) {
              reject(new Error('Failed to establish SSE connection'));
            }
          }
        };

        // Set connection timeout
        setTimeout(() => {
          if (!this.connected) {
            this.eventSource?.close();
            reject(new Error(`SSE connection timeout for ${this.server.name}`));
          }
        }, this.server.timeout || 30000);

      } catch (error) {
        console.error(`[MCP] Failed to create SSE connection for ${this.server.name}:`, error);
        reject(error);
      }
    });
  }

  /**
   * Initialize SSE connection by sending the initialize request
   */
  private async initializeSSEConnection(): Promise<IMCPInitializeResult> {
    const initMessage = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          resources: { subscribe: true },
          sampling: {}
        },
        clientInfo: {
          name: 'Remix IDE',
          version: '1.0.0'
        }
      }
    };

    const result = await this.sendSSEMessage(initMessage);
    return result as IMCPInitializeResult;
  }

  /**
   * Handle incoming SSE messages
   */
  private handleSSEMessage(event: MessageEvent) {
    try {
      console.log(`[MCP] Received SSE event from ${this.server.name}:`, event);
      
      let message;
      try {
        // Try to parse as JSON
        message = JSON.parse(event.data);
      } catch (parseError) {
        console.warn(`[MCP] Failed to parse SSE message as JSON from ${this.server.name}:`, event.data);
        return;
      }
      
      console.log(`[MCP] Parsed SSE message from ${this.server.name}:`, message);
      
      // Handle JSON-RPC response
      if (message.id && this.pendingRequests.has(message.id)) {
        const request = this.pendingRequests.get(message.id)!;
        this.pendingRequests.delete(message.id);
        clearTimeout(request.timeout);
        
        if (message.error) {
          const error = new Error(message.error.message || 'MCP request failed');
          console.error(`[MCP] SSE request ${message.id} failed for ${this.server.name}:`, message.error);
          request.reject(error);
        } else {
          console.log(`[MCP] SSE request ${message.id} completed for ${this.server.name}:`, message.result);
          request.resolve(message.result);
        }
      } 
      // Handle JSON-RPC notification (server-initiated messages)
      else if (message.method && !message.id) {
        console.log(`[MCP] Received notification from ${this.server.name}:`, message.method);
        this.eventEmitter.emit('notification', this.server.name, message);
      }
      // Handle JSON-RPC request (server asking client)
      else if (message.method && message.id) {
        console.log(`[MCP] Received request from ${this.server.name}:`, message.method);
        this.eventEmitter.emit('request', this.server.name, message);
      }
      else {
        console.warn(`[MCP] Received unknown message type from ${this.server.name}:`, message);
      }
    } catch (error) {
      console.error(`[MCP] Error handling SSE message from ${this.server.name}:`, error);
    }
  }

  /**
   * Send a message via SSE (using POST to control endpoint)
   */
  private async sendSSEMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = message.id || this.getNextRequestId();
      const messageWithId = { ...message, id: requestId };
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout for ${this.server.name}`));
      }, this.server.timeout || 30000);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // For MCP over SSE, determine the control endpoint
      // Common patterns:
      // - SSE endpoint: /events or /sse
      // - Control endpoint: /mcp, /control, or the base URL
      let controlUrl = this.server.url!;
      if (controlUrl.includes('/events')) {
        controlUrl = controlUrl.replace('/events', '/mcp');
      } else if (controlUrl.includes('/sse')) {
        controlUrl = controlUrl.replace('/sse', '/mcp');
      } else {
        // If no specific SSE path, append /mcp
        controlUrl = controlUrl.replace(/\/$/, '') + '/mcp';
      }
      
      console.log(`[MCP] Sending ${message.method} request to ${controlUrl} for ${this.server.name}`);
      fetch(controlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(messageWithId)
      })
      .then(async (response) => {
        console.log('SSE sending message connect', response)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // For SSE, we might get an immediate response or wait for SSE message
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          // Immediate JSON response
          const result = await response.json();
          clearTimeout(timeout);
          this.pendingRequests.delete(requestId);
          resolve(result.result || result);
        }
        // Otherwise, we wait for the SSE response
      })
      .catch((error) => {
        console.error(`[MCP] Failed to send ${message.method} request to ${this.server.name}:`, error);
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(error);
      });
    });
  }

  /**
   * Get next request ID
   */
  private getNextRequestId(): number {
    return this.requestId++;
  }

  /**
   * Schedule reconnection attempt for SSE
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    console.log(`[MCP] Scheduling SSE reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms for ${this.server.name}`);
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        console.log(`[MCP] Attempting SSE reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} for ${this.server.name}`);
        
        // Close current connection first
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = undefined;
        }
        
        // Attempt reconnection
        await this.connectSSE();
        console.log(`[MCP] SSE reconnect successful for ${this.server.name}`);
        
      } catch (error) {
        console.error(`[MCP] SSE reconnect failed for ${this.server.name}:`, error);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          console.error(`[MCP] Max SSE reconnect attempts reached for ${this.server.name}`);
          this.connected = false;
          this.eventEmitter.emit('error', this.server.name, new Error('Max reconnect attempts exceeded'));
        }
      }
    }, delay);
  }

  /**
   * Close SSE connection
   */
  private closeSSE(): void {
    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    
    if (this.eventSource) {
      console.log(`[MCP] Closing SSE connection to ${this.server.name}`);
      this.eventSource.close();
      this.eventSource = undefined;
    }
    
    // Reject all pending requests
    for (const [, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
    this.reconnectAttempts = 0;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * MCPInferencer extends RemoteInferencer to support Model Context Protocol
 * It manages MCP server connections and integrates MCP resources/tools with AI requests
 */
export class MCPInferencer extends RemoteInferencer implements ICompletions, IGeneration {
  private mcpClients: Map<string, MCPClient> = new Map();
  private connectionStatuses: Map<string, IMCPConnectionStatus> = new Map();
  private resourceCache: Map<string, IMCPResourceContent> = new Map();
  private cacheTimeout: number = 300000; // 5 minutes
  private intentAnalyzer: IntentAnalyzer = new IntentAnalyzer();
  private resourceScoring: ResourceScoring = new ResourceScoring();
  private remixMCPServer?: any; // Internal RemixMCPServer instance

  constructor(servers: IMCPServer[] = [], apiUrl?: string, completionUrl?: string, remixMCPServer?: any) {
    super(apiUrl, completionUrl);
    this.remixMCPServer = remixMCPServer;
    console.log(`[MCP Inferencer] Initializing with ${servers.length} servers:`, servers.map(s => s.name));
    this.initializeMCPServers(servers);
  }

  private initializeMCPServers(servers: IMCPServer[]): void {
    console.log(`[MCP Inferencer] Initializing MCP servers...`);
    for (const server of servers) {
      if (server.enabled !== false) {
        console.log(`[MCP Inferencer] Setting up client for server: ${server.name}`);
        const client = new MCPClient(
          server, 
          server.transport === 'internal' ? this.remixMCPServer : undefined
        );
        this.mcpClients.set(server.name, client);
        this.connectionStatuses.set(server.name, {
          status: 'disconnected',
          serverName: server.name
        });

        // Set up event listeners
        client.on('connected', (serverName: string, result: IMCPInitializeResult) => {
          console.log(`[MCP Inferencer] Server connected: ${serverName}`);
          this.connectionStatuses.set(serverName, {
            status: 'connected',
            serverName,
            capabilities: result.capabilities
          });
          this.event.emit('mcpServerConnected', serverName, result);
        });

        client.on('error', (serverName: string, error: Error) => {
          console.error(`[MCP Inferencer] Server error: ${serverName}:`, error);
          this.connectionStatuses.set(serverName, {
            status: 'error',
            serverName,
            error: error.message,
            lastAttempt: Date.now()
          });
          this.event.emit('mcpServerError', serverName, error);
        });

        client.on('disconnected', (serverName: string) => {
          console.log(`[MCP Inferencer] Server disconnected: ${serverName}`);
          this.connectionStatuses.set(serverName, {
            status: 'disconnected',
            serverName
          });
          this.event.emit('mcpServerDisconnected', serverName);
        });
      }
    }
  }

  async connectAllServers(): Promise<void> {
    console.log(`[MCP Inferencer] Connecting to all ${this.mcpClients.size} servers...`);
    const promises = Array.from(this.mcpClients.values()).map(async (client) => {
      try {
        await client.connect();
      } catch (error) {
        console.warn(`[MCP Inferencer] Failed to connect to MCP server ${client.getServerName()}:`, error);
      }
    });

    await Promise.allSettled(promises);
    console.log(`[MCP Inferencer] Connection attempts completed`);
  }

  async disconnectAllServers(): Promise<void> {
    console.log(`[MCP Inferencer] Disconnecting from all servers...`);
    const promises = Array.from(this.mcpClients.values()).map(client => client.disconnect());
    await Promise.allSettled(promises);
    console.log(`[MCP Inferencer] All servers disconnected`);
    this.resourceCache.clear();
  }

  async addMCPServer(server: IMCPServer): Promise<void> {
    console.log(`[MCP Inferencer] Adding MCP server: ${server.name}`);
    if (this.mcpClients.has(server.name)) {
      console.error(`[MCP Inferencer] Server ${server.name} already exists`);
      throw new Error(`MCP server ${server.name} already exists`);
    }

    const client = new MCPClient(
      server, 
      server.transport === 'internal' ? this.remixMCPServer : undefined
    );
    this.mcpClients.set(server.name, client);
    this.connectionStatuses.set(server.name, {
      status: 'disconnected',
      serverName: server.name
    });

    if (server.autoStart !== false) {
      console.log(`[MCP Inferencer] Auto-connecting to server: ${server.name}`);
      try {
        await client.connect();
      } catch (error) {
        console.warn(`[MCP Inferencer] Failed to auto-connect to MCP server ${server.name}:`, error);
      }
    }
    console.log(`[MCP Inferencer] Server ${server.name} added successfully`);
  }

  async removeMCPServer(serverName: string): Promise<void> {
    console.log(`[MCP Inferencer] Removing MCP server: ${serverName}`);
    const client = this.mcpClients.get(serverName);
    if (client) {
      await client.disconnect();
      this.mcpClients.delete(serverName);
      this.connectionStatuses.delete(serverName);
      console.log(`[MCP Inferencer] Server ${serverName} removed successfully`);
    } else {
      console.warn(`[MCP Inferencer] Server ${serverName} not found`);
    }
  }

  private async enrichContextWithIMCPResources(params: IParams, prompt?: string): Promise<string> {
    console.log(`[MCP Inferencer] Enriching context with MCP resources...`);
    const mcpParams = (params as any).mcp as IEnhancedMCPProviderParams;
    if (!mcpParams?.mcpServers?.length) {
      console.log(`[MCP Inferencer] No MCP servers specified for enrichment`);
      return "";
    }

    console.log(`[MCP Inferencer] Using ${mcpParams.mcpServers.length} servers:`, mcpParams.mcpServers);

    // Use intelligent resource selection if enabled
    if (mcpParams.enableIntentMatching && prompt) {
      console.log(`[MCP Inferencer] Using intelligent resource selection`);
      return this.intelligentResourceSelection(prompt, mcpParams);
    }

    // Fallback to original logic
    console.log(`[MCP Inferencer] Using legacy resource selection`);
    return this.legacyResourceSelection(mcpParams);
  }

  private async intelligentResourceSelection(prompt: string, mcpParams: IEnhancedMCPProviderParams): Promise<string> {
    try {
      console.log(`[MCP Inferencer] Starting intelligent resource selection for prompt: "${prompt.substring(0, 100)}..."`);
      // Analyze user intent
      const intent = await this.intentAnalyzer.analyzeIntent(prompt);
      console.log(`[MCP Inferencer] Analyzed intent:`, intent);
      
      // Gather all available resources
      const allResources: Array<{ resource: IMCPResource; serverName: string }> = [];
      
      for (const serverName of mcpParams.mcpServers || []) {
        const client = this.mcpClients.get(serverName);
        if (!client || !client.isConnected()) {
          console.warn(`[MCP Inferencer] Server ${serverName} is not connected, skipping`);
          continue;
        }

        try {
          console.log(`[MCP Inferencer] Listing resources from server: ${serverName}`);
          const resources = await client.listResources();
          resources.forEach(resource => {
            allResources.push({ resource, serverName });
          });
          console.log(`[MCP Inferencer] Found ${resources.length} resources from ${serverName}`);
        } catch (error) {
          console.warn(`[MCP Inferencer] Failed to list resources from ${serverName}:`, error);
        }
      }

      if (allResources.length === 0) {
        return "";
      }

      // Score resources against intent
      const scoredResources = await this.resourceScoring.scoreResources(
        allResources,
        intent,
        mcpParams
      );

      // Select best resources
      const selectedResources = this.resourceScoring.selectResources(
        scoredResources,
        mcpParams.maxResources || 10,
        mcpParams.selectionStrategy || 'hybrid'
      );

      // Log selection for debugging
      this.event.emit('mcpResourceSelection', {
        intent,
        totalResourcesConsidered: allResources.length,
        selectedResources: selectedResources.map(r => ({
          name: r.resource.name,
          score: r.score,
          reasoning: r.reasoning
        }))
      });

      // Build context from selected resources
      let mcpContext = "";
      for (const scoredResource of selectedResources) {
        const { resource, serverName } = scoredResource;
        
        try {
          // Try to get from cache first
          let content = this.resourceCache.get(resource.uri);
          if (!content) {
            const client = this.mcpClients.get(serverName);
            if (client) {
              content = await client.readResource(resource.uri);
              // Cache with TTL
              this.resourceCache.set(resource.uri, content);
              setTimeout(() => {
                this.resourceCache.delete(resource.uri);
              }, this.cacheTimeout);
            }
          }

          if (content?.text) {
            mcpContext += `\n--- Resource: ${resource.name} (Score: ${Math.round(scoredResource.score * 100)}%) ---\n`;
            mcpContext += `Relevance: ${scoredResource.reasoning}\n`;
            mcpContext += content.text;
            mcpContext += "\n--- End Resource ---\n";
          }
        } catch (error) {
          console.warn(`Failed to read resource ${resource.uri}:`, error);
        }
      }

      return mcpContext;
    } catch (error) {
      console.error('Error in intelligent resource selection:', error);
      // Fallback to legacy selection
      return this.legacyResourceSelection(mcpParams);
    }
  }

  private async legacyResourceSelection(mcpParams: IEnhancedMCPProviderParams): Promise<string> {
    let mcpContext = "";
    const maxResources = mcpParams.maxResources || 10;
    let resourceCount = 0;

    for (const serverName of mcpParams.mcpServers || []) {
      if (resourceCount >= maxResources) break;

      const client = this.mcpClients.get(serverName);
      if (!client || !client.isConnected()) continue;

      try {
        const resources = await client.listResources();

        for (const resource of resources) {
          if (resourceCount >= maxResources) break;

          // Check resource priority if specified
          if (mcpParams.resourcePriorityThreshold &&
              resource.annotations?.priority &&
              resource.annotations.priority < mcpParams.resourcePriorityThreshold) {
            continue;
          }

          // Try to get from cache first
          let content = this.resourceCache.get(resource.uri);
          if (!content) {
            content = await client.readResource(resource.uri);
            // Cache with TTL
            this.resourceCache.set(resource.uri, content);
            setTimeout(() => {
              this.resourceCache.delete(resource.uri);
            }, this.cacheTimeout);
          }

          if (content.text) {
            mcpContext += `\n--- Resource: ${resource.name} (${resource.uri}) ---\n`;
            mcpContext += content.text;
            mcpContext += "\n--- End Resource ---\n";
            resourceCount++;
          }
        }
      } catch (error) {
        console.warn(`Failed to get resources from MCP server ${serverName}:`, error);
      }
    }

    return mcpContext;
  }

  // Override completion methods to include MCP context
  async code_completion(prompt: string, promptAfter: string, ctxFiles: any, fileName: string, options: IParams = CompletionParams): Promise<any> {
    const mcpContext = await this.enrichContextWithIMCPResources(options, prompt);
    const enrichedPrompt = mcpContext ? `${mcpContext}\n\n${prompt}` : prompt;

    return super.code_completion(enrichedPrompt, promptAfter, ctxFiles, fileName, options);
  }

  async code_insertion(msg_pfx: string, msg_sfx: string, ctxFiles: any, fileName: string, options: IParams = InsertionParams): Promise<any> {
    const mcpContext = await this.enrichContextWithIMCPResources(options, msg_pfx);
    const enrichedPrefix = mcpContext ? `${mcpContext}\n\n${msg_pfx}` : msg_pfx;

    return super.code_insertion(enrichedPrefix, msg_sfx, ctxFiles, fileName, options);
  }

  async code_generation(prompt: string, options: IParams = GenerationParams): Promise<any> {
    const mcpContext = await this.enrichContextWithIMCPResources(options, prompt);
    const enrichedPrompt = mcpContext ? `${mcpContext}\n\n${prompt}` : prompt;

    return super.code_generation(enrichedPrompt, options);
  }

  async answer(prompt: string, options: IParams = GenerationParams): Promise<any> {
    const mcpContext = await this.enrichContextWithIMCPResources(options, prompt);
    const enrichedPrompt = mcpContext ? `${mcpContext}\n\n${prompt}` : prompt;

    return super.answer(enrichedPrompt, options);
  }

  async code_explaining(prompt: string, context: string = "", options: IParams = GenerationParams): Promise<any> {
    const mcpContext = await this.enrichContextWithIMCPResources(options, prompt);
    const enrichedContext = mcpContext ? `${mcpContext}\n\n${context}` : context;

    return super.code_explaining(prompt, enrichedContext, options);
  }

  // MCP-specific methods
  getConnectionStatuses(): IMCPConnectionStatus[] {
    return Array.from(this.connectionStatuses.values());
  }

  getConnectedServers(): string[] {
    return Array.from(this.connectionStatuses.entries())
      .filter(([_, status]) => status.status === 'connected')
      .map(([name, _]) => name);
  }

  async getAllResources(): Promise<Record<string, IMCPResource[]>> {
    const result: Record<string, IMCPResource[]> = {};

    for (const [serverName, client] of this.mcpClients) {
      if (client.isConnected()) {
        try {
          result[serverName] = await client.listResources();
        } catch (error) {
          console.warn(`Failed to list resources from ${serverName}:`, error);
          result[serverName] = [];
        }
      }
    }

    return result;
  }

  async getAllTools(): Promise<Record<string, IMCPTool[]>> {
    const result: Record<string, IMCPTool[]> = {};

    for (const [serverName, client] of this.mcpClients) {
      if (client.isConnected()) {
        try {
          result[serverName] = await client.listTools();
        } catch (error) {
          console.warn(`Failed to list tools from ${serverName}:`, error);
          result[serverName] = [];
        }
      }
    }

    return result;
  }

  async executeTool(serverName: string, toolCall: IMCPToolCall): Promise<IMCPToolResult> {
    const client = this.mcpClients.get(serverName);
    if (!client) {
      throw new Error(`MCP server ${serverName} not found`);
    }

    if (!client.isConnected()) {
      throw new Error(`MCP server ${serverName} is not connected`);
    }

    return client.callTool(toolCall);
  }
}

/**
 * MCPEnhancedInferencer wraps any inferencer to add MCP support
 * It manages MCP server connections and integrates MCP resources/tools with AI requests
 */
// export class MCPEnhancedInferencer implements ICompletions, IGeneration {
//   private baseInferencer: ICompletions & IGeneration;
//   private mcpClients: Map<string, MCPClient> = new Map();
//   private connectionStatuses: Map<string, IMCPConnectionStatus> = new Map();
//   private resourceCache: Map<string, IMCPResourceContent> = new Map();
//   private cacheTimeout: number = 300000; // 5 minutes
//   private intentAnalyzer: IntentAnalyzer = new IntentAnalyzer();
//   private resourceScoring: ResourceScoring = new ResourceScoring();
//   public event: EventEmitter;

//   constructor(baseInferencer: ICompletions & IGeneration, servers: MCPServer[] = []) {
//     this.baseInferencer = baseInferencer;
//     this.event = new EventEmitter();
//     this.initializeMCPServers(servers);
//   }

//   // Delegate all properties to base inferencer
//   get api_url(): string {
//     return (this.baseInferencer as any).api_url;
//   }

//   get completion_url(): string {
//     return (this.baseInferencer as any).completion_url;
//   }

//   get max_history(): number {
//     return (this.baseInferencer as any).max_history || 7;
//   }

//   private initializeMCPServers(servers: MCPServer[]): void {
//     for (const server of servers) {
//       if (server.enabled !== false) {
//         const client = new MCPClient(server);
//         this.mcpClients.set(server.name, client);
//         this.connectionStatuses.set(server.name, {
//           status: 'disconnected',
//           serverName: server.name
//         });

//         // Set up event listeners
//         client.on('connected', (serverName: string, result: MCPInitializeResult) => {
//           this.connectionStatuses.set(serverName, {
//             status: 'connected',
//             serverName,
//             capabilities: result.capabilities
//           });
//           this.event.emit('mcpServerConnected', serverName, result);
//         });

//         client.on('error', (serverName: string, error: Error) => {
//           this.connectionStatuses.set(serverName, {
//             status: 'error',
//             serverName,
//             error: error.message,
//             lastAttempt: Date.now()
//           });
//           this.event.emit('mcpServerError', serverName, error);
//         });

//         client.on('disconnected', (serverName: string) => {
//           this.connectionStatuses.set(serverName, {
//             status: 'disconnected',
//             serverName
//           });
//           this.event.emit('mcpServerDisconnected', serverName);
//         });
//       }
//     }
//   }

//   async connectAllServers(): Promise<void> {
//     const promises = Array.from(this.mcpClients.values()).map(async (client) => {
//       try {
//         await client.connect();
//       } catch (error) {
//         console.warn(`Failed to connect to MCP server ${client.getServerName()}:`, error);
//       }
//     });

//     await Promise.allSettled(promises);
//   }

//   async disconnectAllServers(): Promise<void> {
//     const promises = Array.from(this.mcpClients.values()).map(client => client.disconnect());
//     await Promise.allSettled(promises);
//     this.resourceCache.clear();
//   }

//   async addMCPServer(server: IMCPServer): Promise<void> {
//     if (this.mcpClients.has(server.name)) {
//       throw new Error(`MCP server ${server.name} already exists`);
//     }

//     const client = new MCPClient(server);
//     this.mcpClients.set(server.name, client);
//     this.connectionStatuses.set(server.name, {
//       status: 'disconnected',
//       serverName: server.name
//     });

//     if (server.autoStart !== false) {
//       try {
//         await client.connect();
//       } catch (error) {
//         console.warn(`Failed to auto-connect to MCP server ${server.name}:`, error);
//       }
//     }
//   }

//   async removeMCPServer(serverName: string): Promise<void> {
//     const client = this.mcpClients.get(serverName);
//     if (client) {
//       await client.disconnect();
//       this.mcpClients.delete(serverName);
//       this.connectionStatuses.delete(serverName);
//     }
//   }

//   private async enrichContextWithIMCPResources(params: IParams, prompt?: string): Promise<string> {
//     const mcpParams = (params as any).mcp as IEnhancedMCPProviderParams;
//     if (!mcpParams?.mcpServers?.length) {
//       return "";
//     }

//     // Use intelligent resource selection if enabled
//     if (mcpParams.enableIntentMatching && prompt) {
//       return this.intelligentResourceSelection(prompt, mcpParams);
//     }

//     // Fallback to original logic
//     return this.legacyResourceSelection(mcpParams);
//   }

//   private async intelligentResourceSelection(prompt: string, mcpParams: IEnhancedMCPProviderParams): Promise<string> {
//     try {
//       // Analyze user intent
//       const intent = await this.intentAnalyzer.analyzeIntent(prompt);
      
//       // Gather all available resources
//       const allResources: Array<{ resource: IMCPResource; serverName: string }> = [];
      
//       for (const serverName of mcpParams.mcpServers || []) {
//         const client = this.mcpClients.get(serverName);
//         if (!client || !client.isConnected()) continue;

//         try {
//           const resources = await client.listResources();
//           resources.forEach(resource => {
//             allResources.push({ resource, serverName });
//           });
//         } catch (error) {
//           console.warn(`Failed to list resources from ${serverName}:`, error);
//         }
//       }

//       if (allResources.length === 0) {
//         return "";
//       }

//       // Score resources against intent
//       const scoredResources = await this.resourceScoring.scoreResources(
//         allResources,
//         intent,
//         mcpParams
//       );

//       // Select best resources
//       const selectedResources = this.resourceScoring.selectResources(
//         scoredResources,
//         mcpParams.maxResources || 10,
//         mcpParams.selectionStrategy || 'hybrid'
//       );

//       // Log selection for debugging
//       this.event.emit('mcpResourceSelection', {
//         intent,
//         totalResourcesConsidered: allResources.length,
//         selectedResources: selectedResources.map(r => ({
//           name: r.resource.name,
//           score: r.score,
//           reasoning: r.reasoning
//         }))
//       });

//       // Build context from selected resources
//       let mcpContext = "";
//       for (const scoredResource of selectedResources) {
//         const { resource, serverName } = scoredResource;
        
//         try {
//           // Try to get from cache first
//           let content = this.resourceCache.get(resource.uri);
//           if (!content) {
//             const client = this.mcpClients.get(serverName);
//             if (client) {
//               content = await client.readResource(resource.uri);
//               // Cache with TTL
//               this.resourceCache.set(resource.uri, content);
//               setTimeout(() => {
//                 this.resourceCache.delete(resource.uri);
//               }, this.cacheTimeout);
//             }
//           }

//           if (content?.text) {
//             mcpContext += `\n--- Resource: ${resource.name} (Score: ${Math.round(scoredResource.score * 100)}%) ---\n`;
//             mcpContext += `Relevance: ${scoredResource.reasoning}\n`;
//             mcpContext += content.text;
//             mcpContext += "\n--- End Resource ---\n";
//           }
//         } catch (error) {
//           console.warn(`Failed to read resource ${resource.uri}:`, error);
//         }
//       }

//       return mcpContext;
//     } catch (error) {
//       console.error('Error in intelligent resource selection:', error);
//       // Fallback to legacy selection
//       return this.legacyResourceSelection(mcpParams);
//     }
//   }

//   private async legacyResourceSelection(mcpParams: IEnhancedMCPProviderParams): Promise<string> {
//     let mcpContext = "";
//     const maxResources = mcpParams.maxResources || 10;
//     let resourceCount = 0;

//     for (const serverName of mcpParams.mcpServers || []) {
//       if (resourceCount >= maxResources) break;

//       const client = this.mcpClients.get(serverName);
//       if (!client || !client.isConnected()) continue;

//       try {
//         const resources = await client.listResources();

//         for (const resource of resources) {
//           if (resourceCount >= maxResources) break;

//           // Check resource priority if specified
//           if (mcpParams.resourcePriorityThreshold &&
//               resource.annotations?.priority &&
//               resource.annotations.priority < mcpParams.resourcePriorityThreshold) {
//             continue;
//           }

//           // Try to get from cache first
//           let content = this.resourceCache.get(resource.uri);
//           if (!content) {
//             content = await client.readResource(resource.uri);
//             // Cache with TTL
//             this.resourceCache.set(resource.uri, content);
//             setTimeout(() => {
//               this.resourceCache.delete(resource.uri);
//             }, this.cacheTimeout);
//           }

//           if (content.text) {
//             mcpContext += `\n--- Resource: ${resource.name} (${resource.uri}) ---\n`;
//             mcpContext += content.text;
//             mcpContext += "\n--- End Resource ---\n";
//             resourceCount++;
//           }
//         }
//       } catch (error) {
//         console.warn(`Failed to get resources from MCP server ${serverName}:`, error);
//       }
//     }

//     return mcpContext;
//   }

//   // Override completion methods to include MCP context
//   async code_completion(prompt: string, promptAfter: string, ctxFiles: any, fileName: string, options: IParams = CompletionParams): Promise<any> {
//     const mcpContext = await this.enrichContextWithIMCPResources(options, prompt);
//     const enrichedPrompt = mcpContext ? `${mcpContext}\n\n${prompt}` : prompt;

//     return this.baseInferencer.code_completion(enrichedPrompt, promptAfter, ctxFiles, fileName, options);
//   }

//   async code_insertion(msg_pfx: string, msg_sfx: string, ctxFiles: any, fileName: string, options: IParams = InsertionParams): Promise<any> {
//     const mcpContext = await this.enrichContextWithIMCPResources(options, msg_pfx);
//     const enrichedPrefix = mcpContext ? `${mcpContext}\n\n${msg_pfx}` : msg_pfx;

//     return this.baseInferencer.code_insertion(enrichedPrefix, msg_sfx, ctxFiles, fileName, options);
//   }

//   async code_generation(prompt: string, options: IParams = GenerationParams): Promise<any> {
//     const mcpContext = await this.enrichContextWithIMCPResources(options, prompt);
//     const enrichedPrompt = mcpContext ? `${mcpContext}\n\n${prompt}` : prompt;

//     return this.baseInferencer.code_generation(enrichedPrompt, options);
//   }

//   async answer(prompt: string, options: IParams = GenerationParams): Promise<any> {
//     const mcpContext = await this.enrichContextWithIMCPResources(options, prompt);
//     const enrichedPrompt = mcpContext ? `${mcpContext}\n\n${prompt}` : prompt;

//     return this.baseInferencer.answer(enrichedPrompt, options);
//   }

//   async code_explaining(prompt: string, context: string = "", options: IParams = GenerationParams): Promise<any> {
//     const mcpContext = await this.enrichContextWithIMCPResources(options, prompt);
//     const enrichedContext = mcpContext ? `${mcpContext}\n\n${context}` : context;

//     return this.baseInferencer.code_explaining(prompt, enrichedContext, options);
//   }

//   async error_explaining(prompt, params:IParams): Promise<any>{}
//   async generate(prompt, params:IParams): Promise<any>{}
//   async generateWorkspace(prompt, params:IParams): Promise<any>{}
//   async vulnerability_check(prompt, params:IParams): Promise<any>{}


//   // MCP-specific methods
//   getConnectionStatuses(): IMCPConnectionStatus[] {
//     return Array.from(this.connectionStatuses.values());
//   }

//   getConnectedServers(): string[] {
//     return Array.from(this.connectionStatuses.entries())
//       .filter(([_, status]) => status.status === 'connected')
//       .map(([name, _]) => name);
//   }

//   async getAllResources(): Promise<Record<string, IMCPResource[]>> {
//     const result: Record<string, IMCPResource[]> = {};

//     for (const [serverName, client] of this.mcpClients) {
//       if (client.isConnected()) {
//         try {
//           result[serverName] = await client.listResources();
//         } catch (error) {
//           console.warn(`Failed to list resources from ${serverName}:`, error);
//           result[serverName] = [];
//         }
//       }
//     }

//     return result;
//   }

//   async getAllTools(): Promise<Record<string, IMCPTool[]>> {
//     const result: Record<string, IMCPTool[]> = {};

//     for (const [serverName, client] of this.mcpClients) {
//       if (client.isConnected()) {
//         try {
//           result[serverName] = await client.listTools();
//         } catch (error) {
//           console.warn(`Failed to list tools from ${serverName}:`, error);
//           result[serverName] = [];
//         }
//       }
//     }

//     return result;
//   }

//   async executeTool(serverName: string, toolCall: IIMCPToolCall): Promise<IMCPToolResult> {
//     const client = this.mcpClients.get(serverName);
//     if (!client) {
//       throw new Error(`MCP server ${serverName} not found`);
//     }

//     if (!client.isConnected()) {
//       throw new Error(`MCP server ${serverName} is not connected`);
//     }

//     return client.callTool(toolCall);
//   }
// }