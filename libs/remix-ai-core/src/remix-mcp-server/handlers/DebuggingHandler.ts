/**
 * Debugging Tool Handlers for Remix MCP Server
 */

import { ICustomRemixApi } from '@remix-api';
import { IMCPToolResult } from '../../types/mcp';
import { BaseToolHandler } from '../registry/RemixToolRegistry';
import {
  ToolCategory,
  RemixToolDefinition,
  DebugSessionArgs,
  DebugSessionResult,
} from '../types/mcpTools';
import { Plugin } from '@remixproject/engine';

/**
 * Start Debug Session Tool Handler
 */
export class StartDebugSessionHandler extends BaseToolHandler {
  name = 'start_debug_session';
  description = 'Start a debugging session for a smart contract';
  inputSchema = {
    type: 'object',
    properties: {
      transactionHash: {
        type: 'string',
        description: 'Transaction hash to debug (optional)',
        pattern: '^0x[a-fA-F0-9]{64}$'
      },
      /*
      network: {
        type: 'string',
        description: 'Network to debug on',
        default: 'local'
      }
        */
    },
    required: ['transactionHash']
  };

  getPermissions(): string[] {
    return ['debug:start'];
  }

  validate(args: DebugSessionArgs): boolean | string {
    const required = this.validateRequired(args, ['transactionHash']);
    if (required !== true) return required;

    const types = this.validateTypes(args, {
      transactionHash: 'string',
    });
    if (types !== true) return types;

    if (args.transactionHash && !args.transactionHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      return 'Invalid transaction hash format';
    }

    return true;
  }

  async execute(args: DebugSessionArgs, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      await plugin.call('debugger', 'debug', args.transactionHash)
      // Mock debug session creation
      const result: DebugSessionResult = {
        success: true,
        transactionHash: args.transactionHash,
        status: 'started',
        createdAt: new Date().toISOString()
      };
      plugin.call('menuicons', 'select', 'debugger')
      return this.createSuccessResult(result);

    } catch (error) {
      return this.createErrorResult(`Failed to start debug session: ${error.message}`);
    }
  }
}

/**
 * Stop Debug Session Tool Handler
 */
export class StopDebugSessionHandler extends BaseToolHandler {
  name = 'stop_debug_session';
  description = 'Stop an active debugging session';
  inputSchema = {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Debug session ID to stop'
      }
    },
    required: ['sessionId']
  };

  getPermissions(): string[] {
    return ['debug:stop'];
  }

  validate(args: { sessionId: string }): boolean | string {
    const required = this.validateRequired(args, ['sessionId']);
    if (required !== true) return required;

    const types = this.validateTypes(args, { sessionId: 'string' });
    if (types !== true) return types;

    return true;
  }

  async execute(args: { sessionId: string }, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      // TODO: Stop debug session via Remix debugger API

      const result = {
        success: true,
        sessionId: args.sessionId,
        status: 'stopped',
        stoppedAt: new Date().toISOString(),
        message: 'Debug session stopped successfully'
      };

      return this.createSuccessResult(result);

    } catch (error) {
      return this.createErrorResult(`Failed to stop debug session: ${error.message}`);
    }
  }
}

/**
 * Create debugging tool definitions
 */
export function createDebuggingTools(): RemixToolDefinition[] {
  return [
    {
      name: 'start_debug_session',
      description: 'Start a debugging session for a smart contract',
      inputSchema: new StartDebugSessionHandler().inputSchema,
      category: ToolCategory.DEBUGGING,
      permissions: ['debug:start'],
      handler: new StartDebugSessionHandler()
    },
    {
      name: 'stop_debug_session',
      description: 'Stop an active debugging session',
      inputSchema: new StopDebugSessionHandler().inputSchema,
      category: ToolCategory.DEBUGGING,
      permissions: ['debug:stop'],
      handler: new StopDebugSessionHandler()
    }
  ];
}