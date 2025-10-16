import { ICompletions, IGeneration, IParams, AIRequestType, IAIStreamResponse } from "../../types/types";
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
  IEnhancedMCPProviderParams,
} from "../../types/mcp";
import { IntentAnalyzer } from "../../services/intentAnalyzer";
import { ResourceScoring } from "../../services/resourceScoring";
import { RemixMCPServer } from '@remix/remix-ai-core';

const CORSPROXY = "https://corsproxy.io/?url=";
export class MCPClient {
  private server: IMCPServer;
  private connected: boolean = false;
  private capabilities?: any;
  private eventEmitter: EventEmitter;
  private resources: IMCPResource[] = [];
  private tools: IMCPTool[] = [];
  private remixMCPServer?: RemixMCPServer; // Will be injected for internal transport
  private requestId: number = 1;
  private sseEventSource?: EventSource; // For SSE transport
  private wsConnection?: WebSocket; // For WebSocket transport
  private httpAbortController?: AbortController; // For HTTP request cancellation

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
        return await this.connectInternal();
      } else if (this.server.transport === 'http') {
        return await this.connectHTTP();
      } else if (this.server.transport === 'sse') {
        return await this.connectSSE();
      } else if (this.server.transport === 'websocket') {
        return await this.connectWebSocket();
      } else if (this.server.transport === 'stdio') {
        throw new Error(`stdio transport is not supported in browser environment. Please use http, sse, or websocket instead.`);
      } else {
        throw new Error(`Unknown transport type: ${this.server.transport}`);
      }

    } catch (error) {
      console.error(`[MCP] Failed to connect to ${this.server.name}:`, error);
      this.eventEmitter.emit('error', this.server.name, error);
      throw error;
    }
  }

  private async connectInternal(): Promise<IMCPInitializeResult> {
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
  }

  private async connectHTTP(): Promise<IMCPInitializeResult> {
    if (!this.server.url) {
      throw new Error(`HTTP URL not specified for ${this.server.name}`);
    }

    console.log(`[MCP] Connecting to HTTP MCP server at ${this.server.url}`);
    this.httpAbortController = new AbortController();

    // Send initialize request
    const response = await this.sendHTTPRequest({
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
    });

    if (response.error) {
      throw new Error(`HTTP initialization failed: ${response.error.message}`);
    }

    const result: IMCPInitializeResult = response.result;
    this.connected = true;
    this.capabilities = result.capabilities;
    
    console.log(`[MCP] Successfully connected to HTTP server ${this.server.name}`);
    this.eventEmitter.emit('connected', this.server.name, result);
    return result;
  }

  private async connectSSE(): Promise<IMCPInitializeResult> {
    if (!this.server.url) {
      throw new Error(`SSE URL not specified for ${this.server.name}`);
    }

    console.log(`[MCP] Connecting to SSE MCP server at ${this.server.url}`);

    return new Promise((resolve, reject) => {
      try {
        this.sseEventSource = new EventSource(this.server.url!);
        let initialized = false;

        this.sseEventSource.onmessage = (event) => {
          try {
            const response = JSON.parse(event.data);

            if (!initialized && response.method === 'initialize') {
              const result: IMCPInitializeResult = response.result;
              this.connected = true;
              this.capabilities = result.capabilities;
              initialized = true;

              console.log(`[MCP] Successfully connected to SSE server ${this.server.name}`);
              this.eventEmitter.emit('connected', this.server.name, result);
              resolve(result);
            } else {
              // Handle other SSE messages (resource updates, notifications, etc.)
              this.handleSSEMessage(response);
            }
          } catch (error) {
            console.error(`[MCP] Error parsing SSE message:`, error);
          }
        };

        this.sseEventSource.onerror = (error) => {
          console.error(`[MCP] SSE connection error:`, error);
          if (!initialized) {
            reject(new Error(`SSE connection failed for ${this.server.name}`));
          }
          this.eventEmitter.emit('error', this.server.name, error);
        };

        // Send initialize request via POST (SSE is one-way, so we use HTTP POST for requests)
        this.sendSSEInitialize().catch(reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  private async connectWebSocket(): Promise<IMCPInitializeResult> {
    if (!this.server.url) {
      throw new Error(`WebSocket URL not specified for ${this.server.name}`);
    }

    console.log(`[MCP] Connecting to WebSocket MCP server at ${this.server.url}`);

    return new Promise((resolve, reject) => {
      try {
        this.wsConnection = new WebSocket(this.server.url!);
        let initialized = false;

        this.wsConnection.onopen = () => {
          console.log(`[MCP] WebSocket connection opened to ${this.server.name}`);

          // Send initialize message
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

          this.wsConnection!.send(JSON.stringify(initMessage));
        };

        this.wsConnection.onmessage = (event) => {
          try {
            const response = JSON.parse(event.data);

            if (!initialized && response.result) {
              const result: IMCPInitializeResult = response.result;
              this.connected = true;
              this.capabilities = result.capabilities;
              initialized = true;

              console.log(`[MCP] Successfully connected to WebSocket server ${this.server.name}`);
              this.eventEmitter.emit('connected', this.server.name, result);
              resolve(result);
            } else {
              // Handle other WebSocket messages
              this.handleWebSocketMessage(response);
            }
          } catch (error) {
            console.error(`[MCP] Error parsing WebSocket message:`, error);
          }
        };

        this.wsConnection.onerror = (error) => {
          console.error(`[MCP] WebSocket error:`, error);
          if (!initialized) {
            reject(new Error(`WebSocket connection failed for ${this.server.name}`));
          }
          this.eventEmitter.emit('error', this.server.name, error);
        };

        this.wsConnection.onclose = () => {
          console.log(`[MCP] WebSocket connection closed for ${this.server.name}`);
          this.connected = false;
          this.eventEmitter.emit('disconnected', this.server.name);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private async sendHTTPRequest(request: any): Promise<any> {
    const response = await fetch(CORSPROXY + this.server.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream', // Required by some MCP servers
      },
      body: JSON.stringify(request),
      signal: this.httpAbortController!.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MCP] HTTP error response:`, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    // Check if response is SSE format (some MCP servers return SSE even for POST)
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      // Parse SSE response format: "event: message\ndata: {...}\n\n"
      const text = await response.text();
      const dataMatch = text.match(/data: (.+)/);
      if (dataMatch && dataMatch[1]) {
        return JSON.parse(dataMatch[1]);
      }
      throw new Error('Invalid SSE response format');
    }

    return response.json();
  }

  private async sendSSEInitialize(): Promise<void> {
    // For SSE, send initialize request via HTTP POST
    const initUrl = this.server.url!.replace('/sse', '/initialize');

    // Use commonCorsProxy to bypass CORS restrictions
    // The proxy expects the target URL in the 'proxy' header
    console.log(`[MCP] Using CORS proxy for SSE init target: ${initUrl}`);

    await fetch(CORSPROXY + this.server.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream', // Required by some MCP servers
      },
      body: JSON.stringify({
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
      })
    });
  }

  private handleSSEMessage(message: any): void {
    console.log(`[MCP] SSE message received:`, message);
    // Handle SSE notifications (resource updates, etc.)
    if (message.method === 'notifications/resources/list_changed') {
      this.eventEmitter.emit('resourcesChanged', this.server.name);
    } else if (message.method === 'notifications/tools/list_changed') {
      this.eventEmitter.emit('toolsChanged', this.server.name);
    }
  }

  private handleWebSocketMessage(message: any): void {
    console.log(`[MCP] WebSocket message received:`, message);
    // Handle WebSocket responses and notifications
    if (message.method === 'notifications/resources/list_changed') {
      this.eventEmitter.emit('resourcesChanged', this.server.name);
    } else if (message.method === 'notifications/tools/list_changed') {
      this.eventEmitter.emit('toolsChanged', this.server.name);
    }
  }


  async disconnect(): Promise<void> {
    if (this.connected) {
      console.log(`[MCP] Disconnecting from server: ${this.server.name}`);

      // Handle different transport types
      if (this.server.transport === 'internal' && this.remixMCPServer) {
        await this.remixMCPServer.stop();
      } else if (this.server.transport === 'http' && this.httpAbortController) {
        this.httpAbortController.abort();
        this.httpAbortController = undefined;
      } else if (this.server.transport === 'sse' && this.sseEventSource) {
        this.sseEventSource.close();
        this.sseEventSource = undefined;
      } else if (this.server.transport === 'websocket' && this.wsConnection) {
        this.wsConnection.close();
        this.wsConnection = undefined;
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

    // Check if server supports resources capability
    if (!this.capabilities?.resources) {
      console.log(`[MCP] Server ${this.server.name} does not support resources capability`);
      return [];
    }

    console.log(`[MCP] Listing resources from ${this.server.name}...`);

    if (this.server.transport === 'internal' && this.remixMCPServer) {
      const response = await this.remixMCPServer.handleMessage({
        id: Date.now().toString(),
        method: 'resources/list',
        params: {}
      });

      if (response.error) {
        throw new Error(`Failed to list resources: ${response.error.message}`);
      }

      this.resources = response.result.resources || [];
      console.log(`[MCP] Found ${this.resources.length} resources from internal server`);
      return this.resources;

    } else if (this.server.transport === 'http') {
      const response = await this.sendHTTPRequest({
        jsonrpc: '2.0',
        id: this.getNextRequestId(),
        method: 'resources/list',
        params: {}
      });

      if (response.error) {
        throw new Error(`Failed to list resources: ${response.error.message}`);
      }

      this.resources = response.result.resources || [];
      console.log(`[MCP] Found ${this.resources.length} resources from HTTP server`);
      return this.resources;

    } else if (this.server.transport === 'websocket' && this.wsConnection) {
      return new Promise((resolve, reject) => {
        const requestId = this.getNextRequestId();

        const handleMessage = (event: MessageEvent) => {
          const response = JSON.parse(event.data);
          if (response.id === requestId) {
            this.wsConnection!.removeEventListener('message', handleMessage);

            if (response.error) {
              reject(new Error(`Failed to list resources: ${response.error.message}`));
            } else {
              this.resources = response.result.resources || [];
              console.log(`[MCP] Found ${this.resources.length} resources from WebSocket server`);
              resolve(this.resources);
            }
          }
        };

        this.wsConnection.addEventListener('message', handleMessage);
        this.wsConnection.send(JSON.stringify({
          jsonrpc: '2.0',
          id: requestId,
          method: 'resources/list',
          params: {}
        }));
      });

    } else {
      throw new Error(`SSE transport requires HTTP fallback for listing resources`);
    }
  }

  async readResource(uri: string): Promise<IMCPResourceContent> {
    if (!this.connected) {
      console.error(`[MCP] Cannot read resource - ${this.server.name} is not connected`);
      throw new Error(`MCP server ${this.server.name} is not connected`);
    }

    console.log(`[MCP] Reading resource: ${uri} from ${this.server.name}`);

    if (this.server.transport === 'internal' && this.remixMCPServer) {
      const response = await this.remixMCPServer.handleMessage({
        id: Date.now().toString(),
        method: 'resources/read',
        params: { uri }
      });

      if (response.error) {
        throw new Error(`Failed to read resource: ${response.error.message}`);
      }

      console.log(`[MCP] Resource read successfully from internal server`);
      return response.result;

    } else if (this.server.transport === 'http') {
      const response = await this.sendHTTPRequest({
        jsonrpc: '2.0',
        id: this.getNextRequestId(),
        method: 'resources/read',
        params: { uri }
      });

      if (response.error) {
        throw new Error(`Failed to read resource: ${response.error.message}`);
      }

      console.log(`[MCP] Resource read successfully from HTTP server`);
      return response.result;

    } else if (this.server.transport === 'websocket' && this.wsConnection) {
      return new Promise((resolve, reject) => {
        const requestId = this.getNextRequestId();

        const handleMessage = (event: MessageEvent) => {
          const response = JSON.parse(event.data);
          if (response.id === requestId) {
            this.wsConnection!.removeEventListener('message', handleMessage);

            if (response.error) {
              reject(new Error(`Failed to read resource: ${response.error.message}`));
            } else {
              console.log(`[MCP] Resource read successfully from WebSocket server`);
              resolve(response.result);
            }
          }
        };

        this.wsConnection.addEventListener('message', handleMessage);
        this.wsConnection.send(JSON.stringify({
          jsonrpc: '2.0',
          id: requestId,
          method: 'resources/read',
          params: { uri }
        }));
      });

    } else {
      throw new Error(`SSE transport requires HTTP fallback for reading resources`);
    }
  }

  async listTools(): Promise<IMCPTool[]> {
    if (!this.connected) {
      console.error(`[MCP] Cannot list tools - ${this.server.name} is not connected`);
      throw new Error(`MCP server ${this.server.name} is not connected`);
    }

    // Check if server supports tools capability
    if (!this.capabilities?.tools) {
      console.log(`[MCP] Server ${this.server.name} does not support tools capability`);
      return [];
    }

    console.log(`[MCP] Listing tools from ${this.server.name}...`);

    if (this.server.transport === 'internal' && this.remixMCPServer) {
      const response = await this.remixMCPServer.handleMessage({
        id: Date.now().toString(),
        method: 'tools/list',
        params: {}
      });

      if (response.error) {
        throw new Error(`Failed to list tools: ${response.error.message}`);
      }

      this.tools = response.result.tools || [];
      console.log(`[MCP] Found ${this.tools.length} tools from ${this.server.name}`);
      return this.tools;

    } else if (this.server.transport === 'http') {
      const response = await this.sendHTTPRequest({
        jsonrpc: '2.0',
        id: this.getNextRequestId(),
        method: 'tools/list',
        params: {}
      });

      if (response.error) {
        throw new Error(`Failed to list tools: ${response.error.message}`);
      }

      this.tools = response.result.tools || [];
      console.log(`[MCP] Found ${this.tools.length} tools from  ${this.server.name}`);
      return this.tools;

    } else if (this.server.transport === 'websocket' && this.wsConnection) {
      return new Promise((resolve, reject) => {
        const requestId = this.getNextRequestId();

        const handleMessage = (event: MessageEvent) => {
          const response = JSON.parse(event.data);
          if (response.id === requestId) {
            this.wsConnection!.removeEventListener('message', handleMessage);

            if (response.error) {
              reject(new Error(`Failed to list tools: ${response.error.message}`));
            } else {
              this.tools = response.result.tools || [];
              console.log(`[MCP] Found ${this.tools.length} tools from WebSocket server`);
              resolve(this.tools);
            }
          }
        };

        this.wsConnection.addEventListener('message', handleMessage);
        this.wsConnection.send(JSON.stringify({
          jsonrpc: '2.0',
          id: requestId,
          method: 'tools/list',
          params: {}
        }));
      });

    } else {
      throw new Error(`SSE transport requires HTTP fallback for listing tools`);
    }
  }

  async callTool(toolCall: IMCPToolCall): Promise<IMCPToolResult> {
    if (!this.connected) {
      console.error(`[MCP] Cannot call tool - ${this.server.name} is not connected`);
      throw new Error(`MCP server ${this.server.name} is not connected`);
    }

    console.log(`[MCP] Calling tool: ${toolCall.name} with args:`, toolCall.arguments);

    if (this.server.transport === 'internal' && this.remixMCPServer) {
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

    } else if (this.server.transport === 'http') {
      const response = await this.sendHTTPRequest({
        jsonrpc: '2.0',
        id: this.getNextRequestId(),
        method: 'tools/call',
        params: toolCall
      });

      if (response.error) {
        throw new Error(`Failed to call tool: ${response.error.message}`);
      }

      console.log(`[MCP] Tool ${toolCall.name} executed successfully on HTTP server`);
      return response.result;

    } else if (this.server.transport === 'websocket' && this.wsConnection) {
      return new Promise((resolve, reject) => {
        const requestId = this.getNextRequestId();

        const handleMessage = (event: MessageEvent) => {
          const response = JSON.parse(event.data);
          if (response.id === requestId) {
            this.wsConnection!.removeEventListener('message', handleMessage);

            if (response.error) {
              reject(new Error(`Failed to call tool: ${response.error.message}`));
            } else {
              console.log(`[MCP] Tool ${toolCall.name} executed successfully on WebSocket server`);
              resolve(response.result);
            }
          }
        };

        this.wsConnection.addEventListener('message', handleMessage);
        this.wsConnection.send(JSON.stringify({
          jsonrpc: '2.0',
          id: requestId,
          method: 'tools/call',
          params: toolCall
        }));
      });

    } else {
      throw new Error(`SSE transport requires HTTP fallback for calling tools`);
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

  getCapabilities(): any {
    return this.capabilities;
  }

  private getNextRequestId(): number {
    return this.requestId++;
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
  private cacheTimeout: number = 5000;
  private intentAnalyzer: IntentAnalyzer = new IntentAnalyzer();
  private resourceScoring: ResourceScoring = new ResourceScoring();
  private remixMCPServer?: any; // Internal RemixMCPServer instance
  private MAX_TOOL_EXECUTIONS = 10;

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

  async resetResourceCache(){
    this.resourceCache.clear()
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

  private async enrichContextWithMCPResources(params: IParams, prompt?: string): Promise<string> {
    console.log(`[MCP Inferencer] Enriching context with MCP resources...`);
    const connectedServers = this.getConnectedServers();
    if (!connectedServers.length) {
      console.log(`[MCP Inferencer] No connected MCP servers available for enrichment`);
      return "";
    }

    console.log(`[MCP Inferencer] Using ${connectedServers.length} connected servers:`, connectedServers);

    // Extract MCP params for configuration (optional)
    const mcpParams = (params as any).mcp as IEnhancedMCPProviderParams;
    const enhancedParams: IEnhancedMCPProviderParams = {
      mcpServers: connectedServers,
      enableIntentMatching: mcpParams?.enableIntentMatching || true,
      maxResources: mcpParams?.maxResources || 10,
      resourcePriorityThreshold: mcpParams?.resourcePriorityThreshold,
      selectionStrategy: mcpParams?.selectionStrategy || 'hybrid'
    };

    // Use intelligent resource selection if enabled
    if (enhancedParams.enableIntentMatching && prompt) {
      console.log(`[MCP Inferencer] Using intelligent resource selection`);
      return this.intelligentResourceSelection(prompt, enhancedParams);
    }

    // Fallback to original logic
    console.log(`[MCP Inferencer] Using legacy resource selection`);
    return this.legacyResourceSelection(enhancedParams);
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
        console.log('no resource to be used')
        return "";
      }

      console.log('all resources length', allResources.length)
      // Score resources against intent
      const scoredResources = await this.resourceScoring.scoreResources(
        allResources,
        intent,
        mcpParams
      );

      console.log('Intent', intent)
      console.log('scored resources', scoredResources)

      // Select best resources
      const selectedResources = this.resourceScoring.selectResources(
        scoredResources,
        mcpParams.maxResources || 5,
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

      const workspaceResource: IMCPResource = {
        uri: 'project://structure',
        name: 'Project Structure',
        description: 'Hierarchical view of project files and folders',
        mimeType: 'application/json',
      };

      // Always add project structure for internal remix MCP server
      const hasInternalServer = this.mcpClients.has('Remix IDE Server')
      console.log('hasInternalServer project structure:', hasInternalServer)
      console.log('hasInternalServer project structure:', this.mcpClients)

      if (hasInternalServer) {
        console.log('adding project structure')
        const existingProjectStructure = selectedResources.find(r => r.resource.uri === 'project://structure');
        console.log('existingProjectStructure project structure', existingProjectStructure)
        if (existingProjectStructure === undefined) {
          console.log('pushing project stucture')
          selectedResources.push({
            resource: workspaceResource,
            serverName: 'Remix IDE Server',
            score: 1.0, // High score to ensure it's included
            components: { keywordMatch: 1.0, domainRelevance: 1.0, typeRelevance:1, priority:1, freshness:1 },
            reasoning: 'Project structure always included for internal remix MCP server'
          });
        }
      }

      console.log(selectedResources)

      // Build context from selected resources
      let mcpContext = "";
      for (const scoredResource of selectedResources) {
        const { resource, serverName } = scoredResource;
        
        try {
          // Try to get from cache first
          let content = null //this.resourceCache.get(resource.uri);
          const client = this.mcpClients.get(serverName);
          if (client) {
            content = await client.readResource(resource.uri);
            console.log('read resource', resource.uri, content)
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

      console.log('MCP INFERENCER: new context', mcpContext )
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

          const content = await client.readResource(resource.uri);
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
  
  async answer(prompt: string, options: IParams = GenerationParams): Promise<IAIStreamResponse> {
    const mcpContext = await this.enrichContextWithMCPResources(options, prompt);
    const enrichedPrompt = mcpContext ? `${mcpContext}\n\n${prompt}` : prompt;

    // Add available tools to the request in LLM format
    const llmFormattedTools = await this.getToolsForLLMRequest();
    const enhancedOptions = {
      ...options,
      tools: llmFormattedTools.length > 0 ? llmFormattedTools : undefined,
      tool_choice: llmFormattedTools.length > 0 ? "auto" : undefined
    };

    console.log(`[MCP Inferencer] Sending request with ${llmFormattedTools.length} available tools in LLM format`);

    try {
      const response = await super.answer(enrichedPrompt, enhancedOptions);
      console.log('got initial response', response)

      // Track number of tool execution iterations
      let toolExecutionCount = 0;

      const toolExecutionCallback = async (tool_calls) => {
        console.log('calling tool execution callback')

        // avoid circular tooling
        if (toolExecutionCount >= this.MAX_TOOL_EXECUTIONS) {
          console.log(`[MCP Inferencer] Maximum tool execution limit (${this.MAX_TOOL_EXECUTIONS}) reached. Stopping further executions.`);
          return { streamResponse: await super.answer(enrichedPrompt, options)};
          return;
        }

        toolExecutionCount++;
        console.log(`[MCP Inferencer] Tool execution iteration ${toolExecutionCount}/${this.MAX_TOOL_EXECUTIONS}`);

        // Handle tool calls in the response
        if (tool_calls && tool_calls.length > 0) {
          console.log(`[MCP Inferencer] LLM requested ${tool_calls.length} tool calls`);
          const toolResults = [];

          for (const llmToolCall of tool_calls) {
            try {
              // Convert LLM tool call to internal MCP format
              const mcpToolCall = this.convertLLMToolCallToMCP(llmToolCall);
              const result = await this.executeToolForLLM(mcpToolCall);

              toolResults.push({
                role: 'tool',
                name: llmToolCall.function.name,
                tool_call_id: llmToolCall.id,
                content: result.content[0]?.text || JSON.stringify(result)
              });
            } catch (error) {
              console.error(`[MCP Inferencer] Tool execution failed:`, error);
              toolResults.push({
                tool_call_id: llmToolCall.id,
                content: `Error: ${error.message}`
              });
            }
          }

          // Send tool results back to LLM for final response
          if (toolResults.length > 0) {
            toolResults.unshift({role:'assistant', tool_calls: tool_calls})
            toolResults.unshift({role:'user', content:enrichedPrompt})
            const followUpOptions = {
              ...enhancedOptions,
              toolsMessages: toolResults
            };

            console.log('finalizing tool request')
            return { streamResponse: await super.answer("Follow up on tool call ", followUpOptions), callback: toolExecutionCallback} as IAIStreamResponse;
          }
        }
      }

      return { streamResponse: response, callback:toolExecutionCallback} as IAIStreamResponse;
    } catch (error) {
      console.error(`[MCP Inferencer] Error in enhanced answer:`, error);
      return { streamResponse: await super.answer(enrichedPrompt, options)};
    }
  }

  async code_explaining(prompt: string, context: string = "", options: IParams = GenerationParams): Promise<any> {
    const mcpContext = await this.enrichContextWithMCPResources(options, prompt);
    const enrichedContext = mcpContext ? `${mcpContext}\n\n${context}` : context;

    // Add available tools to the request in LLM format
    const llmFormattedTools = await this.getToolsForLLMRequest();
    options.stream_result = false
    const enhancedOptions = {
      ...options,
      tools: llmFormattedTools.length > 0 ? llmFormattedTools : undefined,
      tool_choice: llmFormattedTools.length > 0 ? "auto" : undefined
    };

    console.log(`[MCP Inferencer] Code explaining with ${llmFormattedTools.length} available tools in LLM format`);

    try {
      const response = await super.code_explaining(prompt, enrichedContext, enhancedOptions);

      // Handle tool calls in the response
      if (response?.tool_calls && response.tool_calls.length > 0) {
        console.log(`[MCP Inferencer] LLM requested ${response.tool_calls.length} tool calls during code explanation`);
        const toolResults = [];

        for (const llmToolCall of response.tool_calls) {
          try {
            // Convert LLM tool call to internal MCP format
            const mcpToolCall = this.convertLLMToolCallToMCP(llmToolCall);
            const result = await this.executeToolForLLM(mcpToolCall);

            toolResults.push({
              tool_call_id: llmToolCall.id,
              content: result.content[0]?.text || JSON.stringify(result)
            });
          } catch (error) {
            console.error(`[MCP Inferencer] Tool execution failed:`, error);
            toolResults.push({
              tool_call_id: llmToolCall.id,
              content: `Error: ${error.message}`
            });
          }
        }

        // Send tool results back to LLM for final response
        if (toolResults.length > 0) {
          const followUpOptions = {
            ...enhancedOptions,
            messages: [
              ...(prompt || []),
              response,
              {
                role: "tool",
                tool_calls: toolResults
              }
            ]
          };

          return super.code_explaining("", "", followUpOptions);
        }
      }

      return response;
    } catch (error) {
      console.error(`[MCP Inferencer] Error in enhanced code_explaining:`, error);
      return super.code_explaining(prompt, enrichedContext, options);
    }
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

  /**
   * Get available tools for LLM integration
   */
  async getAvailableToolsForLLM(): Promise<IMCPTool[]> {
    const allTools: IMCPTool[] = [];
    const toolsFromServers = await this.getAllTools();

    for (const [serverName, tools] of Object.entries(toolsFromServers)) {
      for (const tool of tools) {
        // Add server context to tool for execution routing
        const enhancedTool: IMCPTool & { _mcpServer?: string } = {
          ...tool,
          _mcpServer: serverName
        };
        allTools.push(enhancedTool);
      }
    }

    console.log(`[MCP Inferencer] Available tools for LLM: ${allTools.length} total from ${Object.keys(toolsFromServers).length} servers`);
    return allTools;
  }

  async getToolsForLLMRequest(): Promise<any[]> {
    const mcpTools = await this.getAvailableToolsForLLM();

    const convertedTools = mcpTools.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));

    console.log(`[MCP Inferencer] Converted ${convertedTools.length} tools to LLM request format`);
    return convertedTools;
  }

  convertLLMToolCallToMCP(llmToolCall: any): IMCPToolCall {
    return {
      name: llmToolCall.function.name,
      arguments: typeof llmToolCall.function.arguments === 'string'
        ? JSON.parse(llmToolCall.function.arguments)
        : llmToolCall.function.arguments
    };
  }

  /**
   * Execute a tool call from the LLM
   */
  async executeToolForLLM(toolCall: IMCPToolCall): Promise<IMCPToolResult> {
    console.log(`[MCP Inferencer] Executing tool for LLM: ${toolCall.name}`);

    // Find which server has this tool
    const toolsFromServers = await this.getAllTools();
    let targetServer: string | undefined;

    for (const [serverName, tools] of Object.entries(toolsFromServers)) {
      if (tools.some(tool => tool.name === toolCall.name)) {
        targetServer = serverName;
        break;
      }
    }

    if (!targetServer) {
      throw new Error(`Tool '${toolCall.name}' not found in any connected MCP server`);
    }

    console.log(`[MCP Inferencer] Routing tool '${toolCall.name}' to server '${targetServer}'`);
    return this.executeTool(targetServer, toolCall);
  }

  /**
   * Check if tools are available for LLM integration
   */
  async hasAvailableTools(): Promise<boolean> {
    try {
      const tools = await this.getAvailableToolsForLLM();
      return tools.length > 0;
    } catch (error) {
      console.warn(`[MCP Inferencer] Error checking available tools:`, error);
      return false;
    }
  }
}