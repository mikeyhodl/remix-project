import { ICompletions, IGeneration, IParams, AIRequestType } from "../../types/types";
import { GenerationParams, CompletionParams, InsertionParams } from "../../types/models";
import { RemoteInferencer } from "../remote/remoteInference";
import EventEmitter from "events";
import {
  MCPServer,
  MCPResource,
  MCPResourceContent,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPConnectionStatus,
  MCPInitializeResult,
  MCPProviderParams,
  MCPAwareParams,
  EnhancedMCPProviderParams,
  UserIntent,
  ResourceScore,
  ResourceSelectionResult
} from "../../types/mcp";
import { IntentAnalyzer } from "../../services/intentAnalyzer";
import { ResourceScoring } from "../../services/resourceScoring";

export class MCPClient {
  private server: MCPServer;
  private connected: boolean = false;
  private capabilities?: any;
  private eventEmitter: EventEmitter;
  private resources: MCPResource[] = [];
  private tools: MCPTool[] = [];

  constructor(server: MCPServer) {
    this.server = server;
    this.eventEmitter = new EventEmitter();
  }

  async connect(): Promise<MCPInitializeResult> {
    try {
      this.eventEmitter.emit('connecting', this.server.name);

      // TODO: Implement actual MCP client connection
      // This is a placeholder implementation
      // In a real implementation, this would:
      // 1. Establish connection based on transport type (stdio/sse/websocket)
      // 2. Send initialize request
      // 3. Handle initialization response

      await this.delay(1000); // Simulate connection delay

      this.connected = true;
      this.capabilities = {
        resources: { subscribe: true, listChanged: true },
        tools: { listChanged: true },
        prompts: { listChanged: true }
      };

      const result: MCPInitializeResult = {
        protocolVersion: "2024-11-05",
        capabilities: this.capabilities,
        serverInfo: {
          name: this.server.name,
          version: "1.0.0"
        },
        instructions: `Connected to ${this.server.name} MCP server`
      };

      this.eventEmitter.emit('connected', this.server.name, result);
      return result;

    } catch (error) {
      this.eventEmitter.emit('error', this.server.name, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      this.connected = false;
      this.resources = [];
      this.tools = [];
      this.eventEmitter.emit('disconnected', this.server.name);
    }
  }

  async listResources(): Promise<MCPResource[]> {
    if (!this.connected) {
      throw new Error(`MCP server ${this.server.name} is not connected`);
    }

    // TODO: Implement actual resource listing
    // Placeholder implementation
    const mockResources: MCPResource[] = [
      {
        uri: `file://${this.server.name}/README.md`,
        name: "README",
        description: "Project documentation",
        mimeType: "text/markdown"
      }
    ];

    this.resources = mockResources;
    return mockResources;
  }

  async readResource(uri: string): Promise<MCPResourceContent> {
    if (!this.connected) {
      throw new Error(`MCP server ${this.server.name} is not connected`);
    }

    // TODO: Implement actual resource reading
    return {
      uri,
      mimeType: "text/plain",
      text: `Content from ${uri} via ${this.server.name}`
    };
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.connected) {
      throw new Error(`MCP server ${this.server.name} is not connected`);
    }

    // TODO: Implement actual tool listing
    const mockTools: MCPTool[] = [
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
    return mockTools;
  }

  async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    if (!this.connected) {
      throw new Error(`MCP server ${this.server.name} is not connected`);
    }

    // TODO: Implement actual tool execution
    return {
      content: [{
        type: 'text',
        text: `Tool ${toolCall.name} executed with args: ${JSON.stringify(toolCall.arguments)}`
      }]
    };
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
  private connectionStatuses: Map<string, MCPConnectionStatus> = new Map();
  private resourceCache: Map<string, MCPResourceContent> = new Map();
  private cacheTimeout: number = 300000; // 5 minutes
  private intentAnalyzer: IntentAnalyzer = new IntentAnalyzer();
  private resourceScoring: ResourceScoring = new ResourceScoring();

  constructor(servers: MCPServer[] = [], apiUrl?: string, completionUrl?: string) {
    super(apiUrl, completionUrl);
    this.initializeMCPServers(servers);
  }

  private initializeMCPServers(servers: MCPServer[]): void {
    for (const server of servers) {
      if (server.enabled !== false) {
        const client = new MCPClient(server);
        this.mcpClients.set(server.name, client);
        this.connectionStatuses.set(server.name, {
          status: 'disconnected',
          serverName: server.name
        });

        // Set up event listeners
        client.on('connected', (serverName: string, result: MCPInitializeResult) => {
          this.connectionStatuses.set(serverName, {
            status: 'connected',
            serverName,
            capabilities: result.capabilities
          });
          this.event.emit('mcpServerConnected', serverName, result);
        });

        client.on('error', (serverName: string, error: Error) => {
          this.connectionStatuses.set(serverName, {
            status: 'error',
            serverName,
            error: error.message,
            lastAttempt: Date.now()
          });
          this.event.emit('mcpServerError', serverName, error);
        });

        client.on('disconnected', (serverName: string) => {
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
    const promises = Array.from(this.mcpClients.values()).map(async (client) => {
      try {
        await client.connect();
      } catch (error) {
        console.warn(`Failed to connect to MCP server ${client.getServerName()}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  async disconnectAllServers(): Promise<void> {
    const promises = Array.from(this.mcpClients.values()).map(client => client.disconnect());
    await Promise.allSettled(promises);
    this.resourceCache.clear();
  }

  async addMCPServer(server: MCPServer): Promise<void> {
    if (this.mcpClients.has(server.name)) {
      throw new Error(`MCP server ${server.name} already exists`);
    }

    const client = new MCPClient(server);
    this.mcpClients.set(server.name, client);
    this.connectionStatuses.set(server.name, {
      status: 'disconnected',
      serverName: server.name
    });

    if (server.autoStart !== false) {
      try {
        await client.connect();
      } catch (error) {
        console.warn(`Failed to auto-connect to MCP server ${server.name}:`, error);
      }
    }
  }

  async removeMCPServer(serverName: string): Promise<void> {
    const client = this.mcpClients.get(serverName);
    if (client) {
      await client.disconnect();
      this.mcpClients.delete(serverName);
      this.connectionStatuses.delete(serverName);
    }
  }

  private async enrichContextWithMCPResources(params: IParams, prompt?: string): Promise<string> {
    const mcpParams = (params as any).mcp as EnhancedMCPProviderParams;
    if (!mcpParams?.mcpServers?.length) {
      return "";
    }

    // Use intelligent resource selection if enabled
    if (mcpParams.enableIntentMatching && prompt) {
      return this.intelligentResourceSelection(prompt, mcpParams);
    }

    // Fallback to original logic
    return this.legacyResourceSelection(mcpParams);
  }

  private async intelligentResourceSelection(prompt: string, mcpParams: EnhancedMCPProviderParams): Promise<string> {
    try {
      // Analyze user intent
      const intent = await this.intentAnalyzer.analyzeIntent(prompt);
      
      // Gather all available resources
      const allResources: Array<{ resource: MCPResource; serverName: string }> = [];
      
      for (const serverName of mcpParams.mcpServers || []) {
        const client = this.mcpClients.get(serverName);
        if (!client || !client.isConnected()) continue;

        try {
          const resources = await client.listResources();
          resources.forEach(resource => {
            allResources.push({ resource, serverName });
          });
        } catch (error) {
          console.warn(`Failed to list resources from ${serverName}:`, error);
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

  private async legacyResourceSelection(mcpParams: EnhancedMCPProviderParams): Promise<string> {
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
    const mcpContext = await this.enrichContextWithMCPResources(options, prompt);
    const enrichedPrompt = mcpContext ? `${mcpContext}\n\n${prompt}` : prompt;

    return super.code_completion(enrichedPrompt, promptAfter, ctxFiles, fileName, options);
  }

  async code_insertion(msg_pfx: string, msg_sfx: string, ctxFiles: any, fileName: string, options: IParams = InsertionParams): Promise<any> {
    const mcpContext = await this.enrichContextWithMCPResources(options, msg_pfx);
    const enrichedPrefix = mcpContext ? `${mcpContext}\n\n${msg_pfx}` : msg_pfx;

    return super.code_insertion(enrichedPrefix, msg_sfx, ctxFiles, fileName, options);
  }

  async code_generation(prompt: string, options: IParams = GenerationParams): Promise<any> {
    const mcpContext = await this.enrichContextWithMCPResources(options, prompt);
    const enrichedPrompt = mcpContext ? `${mcpContext}\n\n${prompt}` : prompt;

    return super.code_generation(enrichedPrompt, options);
  }

  async answer(prompt: string, options: IParams = GenerationParams): Promise<any> {
    const mcpContext = await this.enrichContextWithMCPResources(options, prompt);
    const enrichedPrompt = mcpContext ? `${mcpContext}\n\n${prompt}` : prompt;

    return super.answer(enrichedPrompt, options);
  }

  async code_explaining(prompt: string, context: string = "", options: IParams = GenerationParams): Promise<any> {
    const mcpContext = await this.enrichContextWithMCPResources(options, prompt);
    const enrichedContext = mcpContext ? `${mcpContext}\n\n${context}` : context;

    return super.code_explaining(prompt, enrichedContext, options);
  }

  // MCP-specific methods
  getConnectionStatuses(): MCPConnectionStatus[] {
    return Array.from(this.connectionStatuses.values());
  }

  getConnectedServers(): string[] {
    return Array.from(this.connectionStatuses.entries())
      .filter(([_, status]) => status.status === 'connected')
      .map(([name, _]) => name);
  }

  async getAllResources(): Promise<Record<string, MCPResource[]>> {
    const result: Record<string, MCPResource[]> = {};

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

  async getAllTools(): Promise<Record<string, MCPTool[]>> {
    const result: Record<string, MCPTool[]> = {};

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

  async executeTool(serverName: string, toolCall: MCPToolCall): Promise<MCPToolResult> {
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
export class MCPEnhancedInferencer implements ICompletions, IGeneration {
  private baseInferencer: ICompletions & IGeneration;
  private mcpClients: Map<string, MCPClient> = new Map();
  private connectionStatuses: Map<string, MCPConnectionStatus> = new Map();
  private resourceCache: Map<string, MCPResourceContent> = new Map();
  private cacheTimeout: number = 300000; // 5 minutes
  private intentAnalyzer: IntentAnalyzer = new IntentAnalyzer();
  private resourceScoring: ResourceScoring = new ResourceScoring();
  public event: EventEmitter;

  constructor(baseInferencer: ICompletions & IGeneration, servers: MCPServer[] = []) {
    this.baseInferencer = baseInferencer;
    this.event = new EventEmitter();
    this.initializeMCPServers(servers);
  }

  // Delegate all properties to base inferencer
  get api_url(): string {
    return (this.baseInferencer as any).api_url;
  }

  get completion_url(): string {
    return (this.baseInferencer as any).completion_url;
  }

  get max_history(): number {
    return (this.baseInferencer as any).max_history || 7;
  }

  private initializeMCPServers(servers: MCPServer[]): void {
    for (const server of servers) {
      if (server.enabled !== false) {
        const client = new MCPClient(server);
        this.mcpClients.set(server.name, client);
        this.connectionStatuses.set(server.name, {
          status: 'disconnected',
          serverName: server.name
        });

        // Set up event listeners
        client.on('connected', (serverName: string, result: MCPInitializeResult) => {
          this.connectionStatuses.set(serverName, {
            status: 'connected',
            serverName,
            capabilities: result.capabilities
          });
          this.event.emit('mcpServerConnected', serverName, result);
        });

        client.on('error', (serverName: string, error: Error) => {
          this.connectionStatuses.set(serverName, {
            status: 'error',
            serverName,
            error: error.message,
            lastAttempt: Date.now()
          });
          this.event.emit('mcpServerError', serverName, error);
        });

        client.on('disconnected', (serverName: string) => {
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
    const promises = Array.from(this.mcpClients.values()).map(async (client) => {
      try {
        await client.connect();
      } catch (error) {
        console.warn(`Failed to connect to MCP server ${client.getServerName()}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  async disconnectAllServers(): Promise<void> {
    const promises = Array.from(this.mcpClients.values()).map(client => client.disconnect());
    await Promise.allSettled(promises);
    this.resourceCache.clear();
  }

  async addMCPServer(server: MCPServer): Promise<void> {
    if (this.mcpClients.has(server.name)) {
      throw new Error(`MCP server ${server.name} already exists`);
    }

    const client = new MCPClient(server);
    this.mcpClients.set(server.name, client);
    this.connectionStatuses.set(server.name, {
      status: 'disconnected',
      serverName: server.name
    });

    if (server.autoStart !== false) {
      try {
        await client.connect();
      } catch (error) {
        console.warn(`Failed to auto-connect to MCP server ${server.name}:`, error);
      }
    }
  }

  async removeMCPServer(serverName: string): Promise<void> {
    const client = this.mcpClients.get(serverName);
    if (client) {
      await client.disconnect();
      this.mcpClients.delete(serverName);
      this.connectionStatuses.delete(serverName);
    }
  }

  private async enrichContextWithMCPResources(params: IParams, prompt?: string): Promise<string> {
    const mcpParams = (params as any).mcp as EnhancedMCPProviderParams;
    if (!mcpParams?.mcpServers?.length) {
      return "";
    }

    // Use intelligent resource selection if enabled
    if (mcpParams.enableIntentMatching && prompt) {
      return this.intelligentResourceSelection(prompt, mcpParams);
    }

    // Fallback to original logic
    return this.legacyResourceSelection(mcpParams);
  }

  private async intelligentResourceSelection(prompt: string, mcpParams: EnhancedMCPProviderParams): Promise<string> {
    try {
      // Analyze user intent
      const intent = await this.intentAnalyzer.analyzeIntent(prompt);
      
      // Gather all available resources
      const allResources: Array<{ resource: MCPResource; serverName: string }> = [];
      
      for (const serverName of mcpParams.mcpServers || []) {
        const client = this.mcpClients.get(serverName);
        if (!client || !client.isConnected()) continue;

        try {
          const resources = await client.listResources();
          resources.forEach(resource => {
            allResources.push({ resource, serverName });
          });
        } catch (error) {
          console.warn(`Failed to list resources from ${serverName}:`, error);
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

  private async legacyResourceSelection(mcpParams: EnhancedMCPProviderParams): Promise<string> {
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
    const mcpContext = await this.enrichContextWithMCPResources(options, prompt);
    const enrichedPrompt = mcpContext ? `${mcpContext}\n\n${prompt}` : prompt;

    return this.baseInferencer.code_completion(enrichedPrompt, promptAfter, ctxFiles, fileName, options);
  }

  async code_insertion(msg_pfx: string, msg_sfx: string, ctxFiles: any, fileName: string, options: IParams = InsertionParams): Promise<any> {
    const mcpContext = await this.enrichContextWithMCPResources(options, msg_pfx);
    const enrichedPrefix = mcpContext ? `${mcpContext}\n\n${msg_pfx}` : msg_pfx;

    return this.baseInferencer.code_insertion(enrichedPrefix, msg_sfx, ctxFiles, fileName, options);
  }

  async code_generation(prompt: string, options: IParams = GenerationParams): Promise<any> {
    const mcpContext = await this.enrichContextWithMCPResources(options, prompt);
    const enrichedPrompt = mcpContext ? `${mcpContext}\n\n${prompt}` : prompt;

    return this.baseInferencer.code_generation(enrichedPrompt, options);
  }

  async answer(prompt: string, options: IParams = GenerationParams): Promise<any> {
    const mcpContext = await this.enrichContextWithMCPResources(options, prompt);
    const enrichedPrompt = mcpContext ? `${mcpContext}\n\n${prompt}` : prompt;

    return this.baseInferencer.answer(enrichedPrompt, options);
  }

  async code_explaining(prompt: string, context: string = "", options: IParams = GenerationParams): Promise<any> {
    const mcpContext = await this.enrichContextWithMCPResources(options, prompt);
    const enrichedContext = mcpContext ? `${mcpContext}\n\n${context}` : context;

    return this.baseInferencer.code_explaining(prompt, enrichedContext, options);
  }

  async error_explaining(prompt, params:IParams): Promise<any>{}
  async generate(prompt, params:IParams): Promise<any>{}
  async generateWorkspace(prompt, params:IParams): Promise<any>{}
  async vulnerability_check(prompt, params:IParams): Promise<any>{}


  // MCP-specific methods
  getConnectionStatuses(): MCPConnectionStatus[] {
    return Array.from(this.connectionStatuses.values());
  }

  getConnectedServers(): string[] {
    return Array.from(this.connectionStatuses.entries())
      .filter(([_, status]) => status.status === 'connected')
      .map(([name, _]) => name);
  }

  async getAllResources(): Promise<Record<string, MCPResource[]>> {
    const result: Record<string, MCPResource[]> = {};

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

  async getAllTools(): Promise<Record<string, MCPTool[]>> {
    const result: Record<string, MCPTool[]> = {};

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

  async executeTool(serverName: string, toolCall: MCPToolCall): Promise<MCPToolResult> {
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