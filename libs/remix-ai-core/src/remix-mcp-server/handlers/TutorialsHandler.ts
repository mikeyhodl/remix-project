/**
 * Code Analysis Tool Handlers for Remix MCP Server
 */
import axios from 'axios';
import { IMCPToolResult } from '../../types/mcp';
import { BaseToolHandler } from '../registry/RemixToolRegistry';
import {
  ToolCategory,
  RemixToolDefinition
} from '../types/mcpTools';
import { Plugin } from '@remixproject/engine';

/**
 * Learneth tutorial Tool Handler
 * Starts a tutorial using learneth
 */
export class TutorialsHandler extends BaseToolHandler {
  name = 'start_tutorial';
  description = 'Start a learneth tutorial. Solidity basics and advanced topics.';
  inputSchema = {
    type: 'object',
    properties: {
      tutorialId: {
        type: 'string',
        description: 'id of the tutorial to start'
      }
    },
    required: ['tutorialId']
  };

  private static readonly CACHE_KEY = 'remix_tutorials_config';
  private static readonly CACHE_EXPIRY_KEY = 'remix_tutorials_config_expiry';
  private static readonly CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
  
  constructor () {
    super()
    this.loadTutorialsConfig()
  }

  private async loadTutorialsConfig(): Promise<void> {
    try {
      const cachedData = this.getCachedConfig();
      if (cachedData) {
        this.description = this.description + ' Here is the list of available tutorials:\n' + cachedData
        console.log(this.description)
        return;
      }

      const response = await axios('https://raw.githubusercontent.com/remix-project-org/remix-workshops/refs/heads/master/config-properties.json');
      const dataStr = JSON.stringify(response.data)
      this.setCachedConfig(dataStr);
      this.description = this.description + ' Here is the list of available tutorials:\n' + dataStr
      console.log(this.description)
    } catch (error) {
      console.error('Failed to load tutorials config:', error);
    }
  }

  private getCachedConfig(): string | null {
    if (typeof localStorage === 'undefined') return null;
    
    try {
      const cachedData = localStorage.getItem(TutorialsHandler.CACHE_KEY);
      const expiryTime = localStorage.getItem(TutorialsHandler.CACHE_EXPIRY_KEY);
      
      if (!cachedData || !expiryTime) return null;
      
      const now = Date.now();
      if (now > parseInt(expiryTime, 10)) {
        localStorage.removeItem(TutorialsHandler.CACHE_KEY);
        localStorage.removeItem(TutorialsHandler.CACHE_EXPIRY_KEY);
        return null;
      }
      
      return cachedData;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  private setCachedConfig(data: string): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const expiryTime = Date.now() + TutorialsHandler.CACHE_DURATION_MS;
      localStorage.setItem(TutorialsHandler.CACHE_KEY, data);
      localStorage.setItem(TutorialsHandler.CACHE_EXPIRY_KEY, expiryTime.toString());
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  }

  getPermissions(): string[] {
    return ['tutorial:start'];
  }

  validate(args: { filePath: string }): boolean | string {
    const required = this.validateRequired(args, ['tutorialId']);
    if (required !== true) return required
    return true;
  }

  async execute(args: { tutorialId: string }, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      await plugin.call('LearnEth', 'startTutorial', "remix-project-org/remix-workshops", "master", args.tutorialId)
      await plugin.call('sidePanel', 'showContent', 'LearnEth' )
      return this.createSuccessResult({
        success: true,
        tutorialId: args.tutorialId,
        message: `Tutorial ${args.tutorialId} started successfully.`
      });
    } catch (error) {
      return this.createErrorResult(`Starting tutorial failed: ${error.message}`);
    }
  }
}

/**
 * Create code analysis tool definitions
 */
export function createTutorialsTools(): RemixToolDefinition[] {
  return [
    {
      name: 'start_tutorial',
      description: 'start a learneth tutorial',
      inputSchema: new TutorialsHandler().inputSchema,
      category: ToolCategory.ANALYSIS,
      permissions: ['analysis:scan', 'file:read'],
      handler: new TutorialsHandler()
    }
  ];
}
