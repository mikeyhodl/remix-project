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

export class MCPClient {
  private server: IMCPServer;
  private connected: boolean = false;
  private capabilities?: any;
  private eventEmitter: EventEmitter;
  private resources: IMCPResource[] = [];
  private tools: IMCPTool[] = [];

  constructor(server: IMCPServer) {
    this.server = server;
    this.eventEmitter = new EventEmitter();
  }

  async connect(): Promise<IMCPInitializeResult> {
    try {
      console.log(`[MCP] Connecting to server: ${this.server.name} (${this.server.url})`);
      this.eventEmitter.emit('connecting', this.server.name);

      // TODO: Implement actual MCP client connection
      // This is a placeholder implementation
      // In a real implementation, this would:
      // 1. Establish connection based on transport type (stdio/sse/websocket)
      // 2. Send initialize request
      // 3. Handle initialization response

      console.log(`[MCP] Establishing connection to ${this.server.name}...`);
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
        instructions: `Connected to ${this.server.name} MCP server`
      };

      this.eventEmitter.emit('connected', this.server.name, result);
      console.log(`[MCP] Connection established with capabilities:`, this.capabilities);
      return result;

    } catch (error) {
      console.error(`[MCP] Failed to connect to ${this.server.name}:`, error);
      this.eventEmitter.emit('error', this.server.name, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      console.log(`[MCP] Disconnecting from server: ${this.server.name}`);
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
    // TODO: Implement actual resource listing
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

  async readResource(uri: string): Promise<IMCPResourceContent> {
    if (!this.connected) {
      console.error(`[MCP] Cannot read resource - ${this.server.name} is not connected`);
      throw new Error(`MCP server ${this.server.name} is not connected`);
    }

    console.log(`[MCP] Reading resource: ${uri} from ${this.server.name}`);
    // TODO: Implement actual resource reading
    const content: IMCPResourceContent = {
      uri,
      mimeType: "text/plain",
      text: `Content from ${uri} via ${this.server.name}`
    };
    console.log(`[MCP] Resource read successfully: ${uri}`);
    return content;
  }

  async listTools(): Promise<IMCPTool[]> {
    if (!this.connected) {
      console.error(`[MCP] Cannot list tools - ${this.server.name} is not connected`);
      throw new Error(`MCP server ${this.server.name} is not connected`);
    }

    console.log(`[MCP] Listing tools from ${this.server.name}...`);
    // TODO: Implement actual tool listing
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

  async callTool(toolCall: IMCPToolCall): Promise<IMCPToolResult> {
    if (!this.connected) {
      console.error(`[MCP] Cannot call tool - ${this.server.name} is not connected`);
      throw new Error(`MCP server ${this.server.name} is not connected`);
    }

    console.log(`[MCP] Calling tool: ${toolCall.name} with args:`, toolCall.arguments);
    // TODO: Implement actual tool execution
    const result: IMCPToolResult = {
      content: [{
        type: 'text',
        text: `Tool ${toolCall.name} executed with args: ${JSON.stringify(toolCall.arguments)}`
      }]
    };
    console.log(`[MCP] Tool ${toolCall.name} executed successfully`);
    return result;
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
  private connectionStatuses: Map<string, IMCPConnectionStatus> = new Map();
  private resourceCache: Map<string, IMCPResourceContent> = new Map();
  private cacheTimeout: number = 300000; // 5 minutes
  private intentAnalyzer: IntentAnalyzer = new IntentAnalyzer();
  private resourceScoring: ResourceScoring = new ResourceScoring();

  constructor(servers: IMCPServer[] = [], apiUrl?: string, completionUrl?: string) {
    super(apiUrl, completionUrl);
    console.log(`[MCP Inferencer] Initializing with ${servers.length} servers:`, servers.map(s => s.name));
    this.initializeMCPServers(servers);
  }

  private initializeMCPServers(servers: IMCPServer[]): void {
    console.log(`[MCP Inferencer] Initializing MCP servers...`);
    for (const server of servers) {
      if (server.enabled !== false) {
        console.log(`[MCP Inferencer] Setting up client for server: ${server.name}`);
        const client = new MCPClient(server);
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

    const client = new MCPClient(server);
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