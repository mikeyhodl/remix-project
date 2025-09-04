import * as packageJson from '../../../../../package.json'
import { Plugin } from '@remixproject/engine';
import { IModel, RemoteInferencer, IRemoteModel, IParams, GenerationParams, AssistantParams, CodeExplainAgent, SecurityAgent, CompletionParams, OllamaInferencer, isOllamaAvailable, getBestAvailableModel } from '@remix/remix-ai-core';
import { CodeCompletionAgent, ContractAgent, workspaceAgent, IContextType } from '@remix/remix-ai-core';
import { MCPInferencer } from '@remix/remix-ai-core';
import { MCPServer, MCPConnectionStatus } from '@remix/remix-ai-core';
import axios from 'axios';
import { endpointUrls } from "@remix-endpoints-helper"
const _paq = (window._paq = window._paq || [])

type chatRequestBufferT<T> = {
  [key in keyof T]: T[key]
}

const profile = {
  name: 'remixAI',
  displayName: 'RemixAI',
  methods: ['code_generation', 'code_completion', 'setContextFiles',
    "answer", "code_explaining", "generateWorkspace", "fixWorspaceErrors",
    "code_insertion", "error_explaining", "vulnerability_check", 'generate',
    "initialize", 'chatPipe', 'ProcessChatRequestBuffer', 'isChatRequestPending',
    'resetChatRequestBuffer', 'setAssistantThrId',
    'getAssistantThrId', 'getAssistantProvider', 'setAssistantProvider', 'setModel',
    'addMCPServer', 'removeMCPServer', 'getMCPConnectionStatus', 'getMCPResources', 'getMCPTools', 'executeMCPTool',
    'enableMCPEnhancement', 'disableMCPEnhancement', 'isMCPEnabled'],
  events: [],
  icon: 'assets/img/remix-logo-blue.png',
  description: 'RemixAI provides AI services to Remix IDE.',
  kind: '',
  location: 'popupPanel',
  documentation: 'https://remix-ide.readthedocs.io/en/latest/ai.html',
  version: packageJson.version,
  maintainedBy: 'Remix'
}

// add Plugin<any, CustomRemixApi>
export class RemixAIPlugin extends Plugin {
  isOnDesktop:boolean = false
  aiIsActivated:boolean = false
  readonly remixDesktopPluginName = 'remixAID'
  remoteInferencer:RemoteInferencer = null
  isInferencing: boolean = false
  chatRequestBuffer: chatRequestBufferT<any> = null
  codeExpAgent: CodeExplainAgent
  securityAgent: SecurityAgent
  contractor: ContractAgent
  workspaceAgent: workspaceAgent
  assistantProvider: string = 'mistralai' // default provider
  assistantThreadId: string = ''
  useRemoteInferencer:boolean = false
  completionAgent: CodeCompletionAgent
  mcpServers: MCPServer[] = []
  mcpInferencer: MCPInferencer | null = null
  mcpEnabled: boolean = false
  baseInferencer: any = null

  constructor(inDesktop:boolean) {
    super(profile)
    this.isOnDesktop = inDesktop
    // user machine dont use ressource for remote inferencing
  }

  onActivation(): void {

    if (this.isOnDesktop) {
      this.useRemoteInferencer = true
      this.initialize(null, null, null, this.useRemoteInferencer);
      // })
    } else {
      this.useRemoteInferencer = true
      this.initialize()
    }
    this.completionAgent = new CodeCompletionAgent(this)
    this.securityAgent = new SecurityAgent(this)
    this.codeExpAgent = new CodeExplainAgent(this)
    this.contractor = ContractAgent.getInstance(this)
    this.workspaceAgent = workspaceAgent.getInstance(this)

    // Load MCP servers from settings
    this.loadMCPServersFromSettings();
  }

  async initialize(model1?:IModel, model2?:IModel, remoteModel?:IRemoteModel, useRemote?:boolean){
    if (this.isOnDesktop && !this.useRemoteInferencer) {
      // on desktop use remote inferencer -> false
      const res = await this.call(this.remixDesktopPluginName, 'initializeModelBackend', useRemote, model1, model2)
      if (res) {
        this.on(this.remixDesktopPluginName, 'onStreamResult', (value) => {
          this.call('terminal', 'log', { type: 'log', value: value })
        })

        this.on(this.remixDesktopPluginName, 'onInference', () => {
          this.isInferencing = true
        })

        this.on(this.remixDesktopPluginName, 'onInferenceDone', () => {
          this.isInferencing = false
        })
      }

    } else {
      this.remoteInferencer = new RemoteInferencer(remoteModel?.apiUrl, remoteModel?.completionUrl)
      this.remoteInferencer.event.on('onInference', () => {
        this.isInferencing = true
      })
      this.remoteInferencer.event.on('onInferenceDone', () => {
        this.isInferencing = false
      })
    }
    this.setAssistantProvider(this.assistantProvider) // propagate the provider to the remote inferencer
    this.aiIsActivated = true
    return true
  }

  async code_generation(prompt: string, params: IParams=CompletionParams): Promise<any> {
    const enrichedPrompt = await this.enrichWithMCPContext(prompt, params);

    if (this.isOnDesktop && !this.useRemoteInferencer) {
      return await this.call(this.remixDesktopPluginName, 'code_generation', enrichedPrompt, params)
    } else {
      return await this.remoteInferencer.code_generation(enrichedPrompt, params)
    }
  }

  async code_completion(prompt: string, promptAfter: string, params:IParams=CompletionParams): Promise<any> {
    if (this.completionAgent.indexer == null || this.completionAgent.indexer == undefined) await this.completionAgent.indexWorkspace()
    params.provider = 'mistralai' // default provider for code completion
    const currentFileName = await this.call('fileManager', 'getCurrentFile')
    const contextfiles = await this.completionAgent.getContextFiles(prompt)
    if (this.isOnDesktop && !this.useRemoteInferencer) {
      return await this.call(this.remixDesktopPluginName, 'code_completion', prompt, promptAfter, contextfiles, currentFileName, params)
    } else {
      return await this.remoteInferencer.code_completion(prompt, promptAfter, contextfiles, currentFileName, params)
    }
  }

  async answer(prompt: string, params: IParams=GenerationParams): Promise<any> {
    const enrichedPrompt = await this.enrichWithMCPContext(prompt, params);

    let newPrompt = await this.codeExpAgent.chatCommand(enrichedPrompt)
    // add workspace context
    newPrompt = !this.workspaceAgent.ctxFiles ? newPrompt : "Using the following context: ```\n" + this.workspaceAgent.ctxFiles + "```\n\n" + newPrompt

    let result
    if (this.isOnDesktop && !this.useRemoteInferencer) {
      result = await this.call(this.remixDesktopPluginName, 'answer', newPrompt)
    } else {
      result = await this.remoteInferencer.answer(newPrompt)
    }
    if (result && params.terminal_output) this.call('terminal', 'log', { type: 'aitypewriterwarning', value: result })
    return result
  }

  async code_explaining(prompt: string, context: string, params: IParams=GenerationParams): Promise<any> {
    const enrichedPrompt = await this.enrichWithMCPContext(prompt, params);
    let result
    if (this.isOnDesktop && !this.useRemoteInferencer) {
      result = await this.call(this.remixDesktopPluginName, 'code_explaining', enrichedPrompt, context, params)

    } else {
      result = await this.remoteInferencer.code_explaining(enrichedPrompt, context, params)
    }
    if (result && params.terminal_output) this.call('terminal', 'log', { type: 'aitypewriterwarning', value: result })
    return result
  }

  async error_explaining(prompt: string, params: IParams=GenerationParams): Promise<any> {
    let result
    let localFilesImports = ""

    // Get local imports from the workspace restrict to 5 most relevant files
    const relevantFiles = this.workspaceAgent.getRelevantLocalFiles(prompt, 5);

    for (const file in relevantFiles) {
      localFilesImports += `\n\nFileName: ${file}\n\n${relevantFiles[file]}`
    }
    localFilesImports = localFilesImports + "\n End of local files imports.\n\n"
    prompt = localFilesImports ? `Using the following local imports: ${localFilesImports}\n\n` + prompt : prompt
    if (this.isOnDesktop && !this.useRemoteInferencer) {
      result = await this.call(this.remixDesktopPluginName, 'error_explaining', prompt)
    } else {
      result = await this.remoteInferencer.error_explaining(prompt, params)
    }
    if (result && params.terminal_output) this.call('terminal', 'log', { type: 'aitypewriterwarning', value: result })
    return result
  }

  async vulnerability_check(prompt: string, params: IParams=GenerationParams): Promise<any> {
    let result
    if (this.isOnDesktop && !this.useRemoteInferencer) {
      result = await this.call(this.remixDesktopPluginName, 'vulnerability_check', prompt)

    } else {
      result = await this.remoteInferencer.vulnerability_check(prompt, params)
    }
    if (result && params.terminal_output) this.call('terminal', 'log', { type: 'aitypewriterwarning', value: result })
    return result
  }

  getVulnerabilityReport(file: string): any {
    return this.securityAgent.getReport(file)
  }

  /**
   * Generates a new remix IDE workspace based on the provided user prompt, optionally using Retrieval-Augmented Generation (RAG) context.
   * - If `useRag` is `true`, the function fetches additional context from a RAG API and prepends it to the user prompt.
   */
  async generate(prompt: string, params: IParams=AssistantParams, newThreadID:string="", useRag:boolean=false, statusCallback?: (status: string) => Promise<void>): Promise<any> {
    params.stream_result = false // enforce no stream result
    params.threadId = newThreadID
    params.provider = 'anthropic' // enforce all generation to be only on anthropic
    useRag = false
    _paq.push(['trackEvent', 'ai', 'remixAI', 'GenerateNewAIWorkspace'])
    let userPrompt = ''

    if (useRag) {
      statusCallback?.('Fetching RAG context...')
      try {
        let ragContext = ""
        const options = { headers: { 'Content-Type': 'application/json', } }
        const response = await axios.post(endpointUrls.rag, { query: prompt, endpoint:"query" }, options)
        if (response.data) {
          ragContext = response.data.response
          userPrompt = "Using the following context: ```\n\n" + JSON.stringify(ragContext) + "```\n\n" + userPrompt
        } else {
          console.log('Invalid response from RAG context API:', response.data)
        }
      } catch (error) {
        console.log('RAG context error:', error)
      }
    } else {
      userPrompt = prompt
    }
    await statusCallback?.('Generating new workspace with AI...\nThis might take some minutes. Please be patient!')
    const result = await this.remoteInferencer.generate(userPrompt, params)

    await statusCallback?.('Creating contracts and files...')
    const genResult = await this.contractor.writeContracts(result, userPrompt, statusCallback)

    if (genResult.includes('No payload')) return genResult
    await this.call('menuicons', 'select', 'filePanel')
    return genResult
  }

  /**
   * Performs any user action on the entire curren workspace or updates the workspace based on a user prompt,
   * optionally using Retrieval-Augmented Generation (RAG) for additional context.
   *
   */
  async generateWorkspace (userPrompt: string, params: IParams=AssistantParams, newThreadID:string="", useRag:boolean=false, statusCallback?: (status: string) => Promise<void>): Promise<any> {
    params.stream_result = false // enforce no stream result
    params.threadId = newThreadID
    params.provider = this.assistantProvider
    useRag = false
    _paq.push(['trackEvent', 'ai', 'remixAI', 'WorkspaceAgentEdit'])

    await statusCallback?.('Performing workspace request...')
    if (useRag) {
      await statusCallback?.('Fetching RAG context...')
      try {
        let ragContext = ""
        const options = { headers: { 'Content-Type': 'application/json', } }
        const response = await axios.post(endpointUrls.rag, { query: userPrompt, endpoint:"query" }, options)
        if (response.data) {
          ragContext = response.data.response
          userPrompt = "Using the following context: ```\n\n" + ragContext + "```\n\n" + userPrompt
        }
        else {
          console.log('Invalid response from RAG context API:', response.data)
        }
      } catch (error) {
        console.log('RAG context error:', error)
      }
    }
    await statusCallback?.('Loading workspace context...')
    const files = !this.workspaceAgent.ctxFiles ? await this.workspaceAgent.getCurrentWorkspaceFiles() : this.workspaceAgent.ctxFiles
    userPrompt = "Using the following workspace context: ```\n" + files + "```\n\n" + userPrompt

    await statusCallback?.('Generating workspace updates with AI...')
    const result = await this.remoteInferencer.generateWorkspace(userPrompt, params)

    await statusCallback?.('Applying changes to workspace...')
    return (result !== undefined) ? this.workspaceAgent.writeGenerationResults(result, statusCallback) : "### No Changes applied!"
  }

  async fixWorspaceErrors(): Promise<any> {
    try {
      return this.contractor.fixWorkspaceCompilationErrors(this.workspaceAgent)
    } catch (error) {
    }
  }

  async code_insertion(msg_pfx: string, msg_sfx: string, params:IParams=CompletionParams): Promise<any> {
    if (this.completionAgent.indexer == null || this.completionAgent.indexer == undefined) await this.completionAgent.indexWorkspace()

    params.provider = 'mistralai' // default provider for code completion
    const currentFileName = await this.call('fileManager', 'getCurrentFile')
    const contextfiles = await this.completionAgent.getContextFiles(msg_pfx)
    if (this.isOnDesktop && !this.useRemoteInferencer) {
      return await this.call(this.remixDesktopPluginName, 'code_insertion', msg_pfx, msg_sfx, contextfiles, currentFileName, params)
    } else {
      return await this.remoteInferencer.code_insertion( msg_pfx, msg_sfx, contextfiles, currentFileName, params)
    }
  }

  chatPipe(fn, prompt: string, context?: string, pipeMessage?: string){
    if (this.chatRequestBuffer == null){
      this.chatRequestBuffer = {
        fn_name: fn,
        prompt: prompt,
        context: context
      }

      if (pipeMessage) this.call('remixaiassistant', 'chatPipe', pipeMessage)
      else {
        if (fn === "code_explaining") this.call('remixaiassistant', 'chatPipe',"Explain the current code")
        else if (fn === "error_explaining") this.call('remixaiassistant', 'chatPipe', "Explain the error")
        else if (fn === "answer") this.call('remixaiassistant', 'chatPipe', "Answer the following question")
        else if (fn === "vulnerability_check") this.call('remixaiassistant', 'chatPipe',"Is there any vulnerability in the pasted code?")
        else console.log("chatRequestBuffer function name not recognized.")
      }
    }
    else {
      console.log("chatRequestBuffer is not empty. First process the last request.", this.chatRequestBuffer)
    }
    _paq.push(['trackEvent', 'ai', 'remixAI', 'remixAI_chat'])
  }

  async ProcessChatRequestBuffer(params:IParams=GenerationParams){
    if (this.chatRequestBuffer != null){
      const result = this[this.chatRequestBuffer.fn_name](this.chatRequestBuffer.prompt, this.chatRequestBuffer.context, params)
      this.chatRequestBuffer = null
      return result
    }
    else {
      console.log("chatRequestBuffer is empty.")
      return ""
    }
  }

  async setContextFiles(context: IContextType) {
    this.workspaceAgent.setCtxFiles(context)
  }

  async setAssistantThrId(newThrId: string){
    this.assistantThreadId = newThrId
    AssistantParams.threadId = newThrId
    GenerationParams.threadId = newThrId
    CompletionParams.threadId = newThrId
  }

  async getAssistantThrId(){
    return this.assistantThreadId
  }

  async getAssistantProvider(){
    return this.assistantProvider
  }

  async setAssistantProvider(provider: string) {
    if (provider === 'openai' || provider === 'mistralai' || provider === 'anthropic') {
      GenerationParams.provider = provider
      CompletionParams.provider = provider
      AssistantParams.provider = provider

      if (this.assistantProvider !== provider){
        // clear the threadDds
        this.assistantThreadId = ''
        GenerationParams.threadId = ''
        CompletionParams.threadId = ''
        AssistantParams.threadId = ''
      }
      this.assistantProvider = provider

      // Switch back to remote inferencer for cloud providers -- important
      if (this.remoteInferencer && this.remoteInferencer instanceof OllamaInferencer) {
        this.remoteInferencer = new RemoteInferencer()
        this.remoteInferencer.event.on('onInference', () => {
          this.isInferencing = true
        })
        this.remoteInferencer.event.on('onInferenceDone', () => {
          this.isInferencing = false
        })
      }
    } else if (provider === 'mcp') {
      // Switch to MCP inferencer
      if (!this.mcpInferencer || !(this.mcpInferencer instanceof MCPInferencer)) {
        this.mcpInferencer = new MCPInferencer(this.mcpServers);
        this.mcpInferencer.event.on('onInference', () => {
          this.isInferencing = true
        })
        this.mcpInferencer.event.on('onInferenceDone', () => {
          this.isInferencing = false
        })
        this.mcpInferencer.event.on('mcpServerConnected', (serverName: string) => {
          console.log(`MCP server connected: ${serverName}`)
        })
        this.mcpInferencer.event.on('mcpServerError', (serverName: string, error: Error) => {
          console.error(`MCP server error (${serverName}):`, error)
        })

        // Connect to all configured servers
        await this.mcpInferencer.connectAllServers();
      }

      this.remoteInferencer = this.mcpInferencer;

      if (this.assistantProvider !== provider){
        // clear the threadIds
        this.assistantThreadId = ''
        GenerationParams.threadId = ''
        CompletionParams.threadId = ''
        AssistantParams.threadId = ''
      }
      this.assistantProvider = provider
    } else if (provider === 'ollama') {
      const isAvailable = await isOllamaAvailable();
      if (!isAvailable) {
        console.error('Ollama is not available. Please ensure Ollama is running.')
        return
      }

      const bestModel = await getBestAvailableModel();
      if (!bestModel) {
        console.error('No Ollama models available. Please install a model first.')
        return
      }

      // Switch to Ollama inferencer
      this.remoteInferencer = new OllamaInferencer(bestModel);
      this.remoteInferencer.event.on('onInference', () => {
        this.isInferencing = true
      })
      this.remoteInferencer.event.on('onInferenceDone', () => {
        this.isInferencing = false
      })

      if (this.assistantProvider !== provider){
        // clear the threadIds
        this.assistantThreadId = ''
        GenerationParams.threadId = ''
        CompletionParams.threadId = ''
        AssistantParams.threadId = ''
      }
      this.assistantProvider = provider
    } else {
      console.error(`Unknown assistant provider: ${provider}`)
    }
  }

  async setModel(modelName: string) {
    if (this.assistantProvider === 'ollama' && this.remoteInferencer instanceof OllamaInferencer) {
      try {
        const isAvailable = await isOllamaAvailable();
        if (!isAvailable) {
          console.error('Ollama is not available. Please ensure Ollama is running.')
          return
        }

        this.remoteInferencer = new OllamaInferencer(modelName);
        this.remoteInferencer.event.on('onInference', () => {
          this.isInferencing = true
        })
        this.remoteInferencer.event.on('onInferenceDone', () => {
          this.isInferencing = false
        })

        console.log(`Ollama model changed to: ${modelName}`)
      } catch (error) {
        console.error('Failed to set Ollama model:', error)
      }
    } else {
      console.warn(`setModel is only supported for Ollama provider. Current provider: ${this.assistantProvider}`)
    }
  }

  isChatRequestPending(){
    return this.chatRequestBuffer != null
  }

  resetChatRequestBuffer() {
    this.chatRequestBuffer = null
  }

  // MCP Server Management Methods
  async addMCPServer(server: MCPServer): Promise<void> {
    try {
      // Add to local configuration
      this.mcpServers.push(server);

      // If MCP inferencer is active, add the server dynamically
      if (this.assistantProvider === 'mcp' && this.mcpInferencer) {
        await this.mcpInferencer.addMCPServer(server);
      }

      // Persist configuration
      await this.call('settings', 'set', 'settings/mcp/servers', JSON.stringify(this.mcpServers));
    } catch (error) {
      console.error('Failed to add MCP server:', error);
      throw error;
    }
  }

  async removeMCPServer(serverName: string): Promise<void> {
    try {
      // Remove from local configuration
      this.mcpServers = this.mcpServers.filter(s => s.name !== serverName);

      // If MCP inferencer is active, remove the server dynamically
      if (this.assistantProvider === 'mcp' && this.mcpInferencer) {
        await this.mcpInferencer.removeMCPServer(serverName);
      }

      // Persist configuration
      await this.call('settings', 'set', 'settings/mcp/servers', JSON.stringify(this.mcpServers));
    } catch (error) {
      console.error('Failed to remove MCP server:', error);
      throw error;
    }
  }

  getMCPConnectionStatus(): MCPConnectionStatus[] {
    if (this.assistantProvider === 'mcp' && this.mcpInferencer) {
      return this.mcpInferencer.getConnectionStatuses();
    }
    return [];
  }

  async getMCPResources(): Promise<Record<string, any[]>> {
    if (this.assistantProvider === 'mcp' && this.mcpInferencer) {
      return await this.mcpInferencer.getAllResources();
    }
    return {};
  }

  async getMCPTools(): Promise<Record<string, any[]>> {
    if (this.assistantProvider === 'mcp' && this.mcpInferencer) {
      return await this.mcpInferencer.getAllTools();
    }
    return {};
  }

  async executeMCPTool(serverName: string, toolName: string, arguments_: Record<string, any>): Promise<any> {
    if (this.assistantProvider === 'mcp' && this.mcpInferencer) {
      return await this.mcpInferencer.executeTool(serverName, { name: toolName, arguments: arguments_ });
    }
    throw new Error('MCP provider not active');
  }

  private async loadMCPServersFromSettings(): Promise<void> {
    try {
      const savedServers = await this.call('settings', 'get', 'settings/mcp/servers');
      if (savedServers) {
        this.mcpServers = JSON.parse(savedServers);
      } else {
        // Initialize with default MCP servers
        const defaultServers: MCPServer[] = [
          {
            name: 'OpenZeppelin Contracts',
            description: 'OpenZeppelin smart contract library and security tools',
            transport: 'sse',
            url: 'https://mcp.openzeppelin.com/contracts/solidity/mcp',
            autoStart: true,
            enabled: true,
            timeout: 30000
          }
        ];
        this.mcpServers = defaultServers;
        // Save default servers to settings
        await this.call('settings', 'set', 'settings/mcp/servers', JSON.stringify(defaultServers));
      }
    } catch (error) {
      console.warn('Failed to load MCP servers from settings:', error);
      this.mcpServers = [];
    }
  }

  async enableMCPEnhancement(): Promise<void> {
    if (!this.mcpServers || this.mcpServers.length === 0) {
      console.warn('No MCP servers configured');
      return;
    }

    // Initialize MCP inferencer if not already done
    if (!this.mcpInferencer) {
      this.mcpInferencer = new MCPInferencer(this.mcpServers);
      this.mcpInferencer.event.on('mcpServerConnected', (serverName: string) => {
        console.log(`MCP server connected: ${serverName}`);
      });
      this.mcpInferencer.event.on('mcpServerError', (serverName: string, error: Error) => {
        console.error(`MCP server error (${serverName}):`, error);
      });

      // Connect to all MCP servers
      await this.mcpInferencer.connectAllServers();
    }

    this.mcpEnabled = true;
    console.log('MCP enhancement enabled');
  }

  async disableMCPEnhancement(): Promise<void> {
    this.mcpEnabled = false;
    console.log('MCP enhancement disabled');
  }

  isMCPEnabled(): boolean {
    return this.mcpEnabled;
  }

  private async enrichWithMCPContext(prompt: string, params: IParams): Promise<string> {
    if (!this.mcpEnabled || !this.mcpInferencer) {
      return prompt;
    }

    try {
      // Get MCP resources and tools context
      const resources = await this.mcpInferencer.getAllResources();
      const tools = await this.mcpInferencer.getAllTools();

      let mcpContext = '';

      // Add available resources context
      if (Object.keys(resources).length > 0) {
        mcpContext += '\n--- Available MCP Resources ---\n';
        for (const [serverName, serverResources] of Object.entries(resources)) {
          if (serverResources.length > 0) {
            mcpContext += `Server: ${serverName}\n`;
            for (const resource of serverResources.slice(0, 3)) { // Limit to first 3
              mcpContext += `- ${resource.name}: ${resource.description || resource.uri}\n`;
            }
          }
        }
        mcpContext += '--- End Resources ---\n';
      }

      // Add available tools context
      if (Object.keys(tools).length > 0) {
        mcpContext += '\n--- Available MCP Tools ---\n';
        for (const [serverName, serverTools] of Object.entries(tools)) {
          if (serverTools.length > 0) {
            mcpContext += `Server: ${serverName}\n`;
            for (const tool of serverTools) {
              mcpContext += `- ${tool.name}: ${tool.description || 'No description'}\n`;
            }
          }
        }
        mcpContext += '--- End Tools ---\n';
      }

      return mcpContext ? `${mcpContext}\n${prompt}` : prompt;
    } catch (error) {
      console.warn('Failed to enrich with MCP context:', error);
      return prompt;
    }
  }

}
