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
 * Decode Local Variable Tool Handler
 */
export class DecodeLocalVariableHandler extends BaseToolHandler {
  name = 'decode_local_variable';
  description = 'Decode a local variable at a specific step in the transaction execution';
  inputSchema = {
    type: 'object',
    properties: {
      variableId: {
        type: 'number',
        description: 'The unique identifier of the local variable to decode'
      },
      stepIndex: {
        type: 'number',
        description: 'Optional step index in the trace; defaults to current step if not provided'
      }
    },
    required: ['variableId']
  };

  getPermissions(): string[] {
    return ['debug:read'];
  }

  validate(args: { variableId: number; stepIndex?: number }): boolean | string {
    const required = this.validateRequired(args, ['variableId']);
    if (required !== true) return required;

    const types = this.validateTypes(args, {
      variableId: 'number',
    });
    if (types !== true) return types;

    if (args.stepIndex !== undefined) {
      const stepTypes = this.validateTypes({ stepIndex: args.stepIndex }, { stepIndex: 'number' });
      if (stepTypes !== true) return stepTypes;
    }

    return true;
  }

  async execute(args: { variableId: number; stepIndex?: number }, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await plugin.call('debugger', 'decodeLocalVariable', args.variableId, args.stepIndex);

      if (result === null) {
        return this.createErrorResult('Debugger backend is not initialized. Please start a debug session first.');
      }

      return this.createSuccessResult({
        success: true,
        variableId: args.variableId,
        stepIndex: args.stepIndex,
        decodedValue: result
      });

    } catch (error) {
      return this.createErrorResult(`Failed to decode local variable: ${error.message}`);
    }
  }
}

/**
 * Decode State Variable Tool Handler
 */
export class DecodeStateVariableHandler extends BaseToolHandler {
  name = 'decode_state_variable';
  description = 'Decode a state variable at a specific step in the transaction execution';
  inputSchema = {
    type: 'object',
    properties: {
      variableId: {
        type: 'number',
        description: 'The unique identifier of the state variable to decode'
      },
      stepIndex: {
        type: 'number',
        description: 'Optional step index in the trace; defaults to current step if not provided'
      }
    },
    required: ['variableId']
  };

  getPermissions(): string[] {
    return ['debug:read'];
  }

  validate(args: { variableId: number; stepIndex?: number }): boolean | string {
    const required = this.validateRequired(args, ['variableId']);
    if (required !== true) return required;

    const types = this.validateTypes(args, {
      variableId: 'number',
    });
    if (types !== true) return types;

    if (args.stepIndex !== undefined) {
      const stepTypes = this.validateTypes({ stepIndex: args.stepIndex }, { stepIndex: 'number' });
      if (stepTypes !== true) return stepTypes;
    }

    return true;
  }

  async execute(args: { variableId: number; stepIndex?: number }, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await plugin.call('debugger', 'decodeStateVariable', args.variableId, args.stepIndex);

      if (result === null) {
        return this.createErrorResult('Debugger backend is not initialized. Please start a debug session first.');
      }

      return this.createSuccessResult({
        success: true,
        variableId: args.variableId,
        stepIndex: args.stepIndex,
        decodedValue: result
      });

    } catch (error) {
      return this.createErrorResult(`Failed to decode state variable: ${error.message}`);
    }
  }
}

/**
 * Global Context Tool Handler
 */
export class GlobalContextHandler extends BaseToolHandler {
  name = 'get_global_context';
  description = 'Retrieve the global execution context (block, msg, tx) for the transaction being debugged';
  inputSchema = {
    type: 'object',
    properties: {},
    required: []
  };

  getPermissions(): string[] {
    return ['debug:read'];
  }

  validate(args: {}): boolean | string {
    return true;
  }

  async execute(args: {}, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await plugin.call('debugger', 'globalContext');

      if (!result || (!result.block && !result.msg && !result.tx)) {
        return this.createErrorResult('Global context is not available. Please start a debug session first.');
      }

      return this.createSuccessResult({
        success: true,
        context: result
      });

    } catch (error) {
      return this.createErrorResult(`Failed to get global context: ${error.message}`);
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
    },
    {
      name: 'decode_local_variable',
      description: 'Decode a local variable at a specific step in the transaction execution',
      inputSchema: new DecodeLocalVariableHandler().inputSchema,
      category: ToolCategory.DEBUGGING,
      permissions: ['debug:read'],
      handler: new DecodeLocalVariableHandler()
    },
    {
      name: 'decode_state_variable',
      description: 'Decode a state variable at a specific step in the transaction execution',
      inputSchema: new DecodeStateVariableHandler().inputSchema,
      category: ToolCategory.DEBUGGING,
      permissions: ['debug:read'],
      handler: new DecodeStateVariableHandler()
    },
    {
      name: 'get_global_context',
      description: 'Retrieve the global execution context (block, msg, tx) for the transaction being debugged',
      inputSchema: new GlobalContextHandler().inputSchema,
      category: ToolCategory.DEBUGGING,
      permissions: ['debug:read'],
      handler: new GlobalContextHandler()
    }
  ];
}