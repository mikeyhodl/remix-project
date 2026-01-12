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
 * Get Valid Source Location From VM Trace Index Handler
 */
export class GetValidSourceLocationFromVMTraceIndexHandler extends BaseToolHandler {
  name = 'get_valid_source_location_from_vm_trace_index';
  description = 'Get a valid source location from a VM trace step index';
  inputSchema = {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'Contract address',
        pattern: '^0x[a-fA-F0-9]{40}$'
      },
      stepIndex: {
        type: 'number',
        description: 'VM trace step index'
      }
    },
    required: ['address', 'stepIndex']
  };

  getPermissions(): string[] {
    return ['debug:read'];
  }

  validate(args: { address: string; stepIndex: number }): boolean | string {
    const required = this.validateRequired(args, ['address', 'stepIndex']);
    if (required !== true) return required;

    const types = this.validateTypes(args, {
      address: 'string',
      stepIndex: 'number',
    });
    if (types !== true) return types;

    if (!args.address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return 'Invalid contract address format';
    }

    return true;
  }

  async execute(args: { address: string; stepIndex: number }, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await plugin.call('debugger', 'getValidSourceLocationFromVMTraceIndex', args.address, args.stepIndex);

      if (!result) {
        return this.createErrorResult('Source location not available. Ensure a debug session is active.');
      }

      return this.createSuccessResult({
        success: true,
        address: args.address,
        stepIndex: args.stepIndex,
        sourceLocation: result
      });

    } catch (error) {
      return this.createErrorResult(`Failed to get valid source location: ${error.message}`);
    }
  }
}

/**
 * Source Location From Instruction Index Handler
 */
export class SourceLocationFromInstructionIndexHandler extends BaseToolHandler {
  name = 'source_location_from_instruction_index';
  description = 'Get the source location from an instruction index (bytecode position)';
  inputSchema = {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'Contract address',
        pattern: '^0x[a-fA-F0-9]{40}$'
      },
      instIndex: {
        type: 'number',
        description: 'Instruction index in the bytecode'
      }
    },
    required: ['address', 'instIndex']
  };

  getPermissions(): string[] {
    return ['debug:read'];
  }

  validate(args: { address: string; instIndex: number }): boolean | string {
    const required = this.validateRequired(args, ['address', 'instIndex']);
    if (required !== true) return required;

    const types = this.validateTypes(args, {
      address: 'string',
      instIndex: 'number',
    });
    if (types !== true) return types;

    if (!args.address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return 'Invalid contract address format';
    }

    return true;
  }

  async execute(args: { address: string; instIndex: number }, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await plugin.call('debugger', 'sourceLocationFromInstructionIndex', args.address, args.instIndex);

      if (!result) {
        return this.createErrorResult('Source location not available. Ensure a debug session is active.');
      }

      return this.createSuccessResult({
        success: true,
        address: args.address,
        instIndex: args.instIndex,
        sourceLocation: result
      });

    } catch (error) {
      return this.createErrorResult(`Failed to get source location from instruction index: ${error.message}`);
    }
  }
}

/**
 * Extract Locals At Handler
 */
export class ExtractLocalsAtHandler extends BaseToolHandler {
  name = 'extract_locals_at';
  description = 'Extract the scope information (local variables context) at a specific execution step';
  inputSchema = {
    type: 'object',
    properties: {
      step: {
        type: 'number',
        description: 'Execution step index'
      }
    },
    required: ['step']
  };

  getPermissions(): string[] {
    return ['debug:read'];
  }

  validate(args: { step: number }): boolean | string {
    const required = this.validateRequired(args, ['step']);
    if (required !== true) return required;

    const types = this.validateTypes(args, { step: 'number' });
    if (types !== true) return types;

    return true;
  }

  async execute(args: { step: number }, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await plugin.call('debugger', 'extractLocalsAt', args.step);

      if (!result) {
        return this.createErrorResult('Scope information not available. Ensure a debug session is active.');
      }

      return this.createSuccessResult({
        success: true,
        step: args.step,
        scope: result
      });

    } catch (error) {
      return this.createErrorResult(`Failed to extract locals: ${error.message}`);
    }
  }
}

/**
 * Decode Locals At Handler
 */
export class DecodeLocalsAtHandler extends BaseToolHandler {
  name = 'decode_locals_at';
  description = 'Decode all local variables at a specific execution step and source location';
  inputSchema = {
    type: 'object',
    properties: {
      step: {
        type: 'number',
        description: 'Execution step index'
      },
      sourceLocation: {
        type: 'object',
        description: 'Source code location for context'
      }
    },
    required: ['step', 'sourceLocation']
  };

  getPermissions(): string[] {
    return ['debug:read'];
  }

  validate(args: { step: number; sourceLocation: any }): boolean | string {
    const required = this.validateRequired(args, ['step', 'sourceLocation']);
    if (required !== true) return required;

    const types = this.validateTypes(args, {
      step: 'number',
      sourceLocation: 'object'
    });
    if (types !== true) return types;

    return true;
  }

  async execute(args: { step: number; sourceLocation: any }, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      return new Promise((resolve) => {
        plugin.call('debugger', 'decodeLocalsAt', args.step, args.sourceLocation, (error, locals) => {
          if (error) {
            resolve(this.createErrorResult(`Failed to decode locals: ${error}`));
          } else {
            resolve(this.createSuccessResult({
              success: true,
              step: args.step,
              locals: locals
            }));
          }
        });
      });

    } catch (error) {
      return this.createErrorResult(`Failed to decode locals: ${error.message}`);
    }
  }
}

/**
 * Extract State At Handler
 */
export class ExtractStateAtHandler extends BaseToolHandler {
  name = 'extract_state_at';
  description = 'Extract all state variables metadata at a specific execution step';
  inputSchema = {
    type: 'object',
    properties: {
      step: {
        type: 'number',
        description: 'Execution step index'
      }
    },
    required: ['step']
  };

  getPermissions(): string[] {
    return ['debug:read'];
  }

  validate(args: { step: number }): boolean | string {
    const required = this.validateRequired(args, ['step']);
    if (required !== true) return required;

    const types = this.validateTypes(args, { step: 'number' });
    if (types !== true) return types;

    return true;
  }

  async execute(args: { step: number }, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await plugin.call('debugger', 'extractStateAt', args.step);

      if (!result) {
        return this.createErrorResult('State variables not available. Ensure a debug session is active.');
      }

      return this.createSuccessResult({
        success: true,
        step: args.step,
        stateVariables: result
      });

    } catch (error) {
      return this.createErrorResult(`Failed to extract state variables: ${error.message}`);
    }
  }
}

/**
 * Decode State At Handler
 */
export class DecodeStateAtHandler extends BaseToolHandler {
  name = 'decode_state_at';
  description = 'Decode the values of specified state variables at a specific execution step';
  inputSchema = {
    type: 'object',
    properties: {
      step: {
        type: 'number',
        description: 'Execution step index'
      },
      stateVars: {
        type: 'array',
        description: 'Array of state variable metadata to decode'
      }
    },
    required: ['step', 'stateVars']
  };

  getPermissions(): string[] {
    return ['debug:read'];
  }

  validate(args: { step: number; stateVars: any[] }): boolean | string {
    const required = this.validateRequired(args, ['step', 'stateVars']);
    if (required !== true) return required;

    const types = this.validateTypes(args, {
      step: 'number',
      stateVars: 'object'
    });
    if (types !== true) return types;

    if (!Array.isArray(args.stateVars)) {
      return 'stateVars must be an array';
    }

    return true;
  }

  async execute(args: { step: number; stateVars: any[] }, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await plugin.call('debugger', 'decodeStateAt', args.step, args.stateVars);

      if (!result) {
        return this.createErrorResult('Failed to decode state variables. Ensure a debug session is active.');
      }

      return this.createSuccessResult({
        success: true,
        step: args.step,
        decodedState: result
      });

    } catch (error) {
      return this.createErrorResult(`Failed to decode state: ${error.message}`);
    }
  }
}

/**
 * Storage View At Handler
 */
export class StorageViewAtHandler extends BaseToolHandler {
  name = 'storage_view_at';
  description = 'Create a storage viewer for inspecting contract storage at a specific step';
  inputSchema = {
    type: 'object',
    properties: {
      step: {
        type: 'number',
        description: 'Execution step index'
      },
      address: {
        type: 'string',
        description: 'Contract address whose storage to view',
        pattern: '^0x[a-fA-F0-9]{40}$'
      }
    },
    required: ['step', 'address']
  };

  getPermissions(): string[] {
    return ['debug:read'];
  }

  validate(args: { step: number; address: string }): boolean | string {
    const required = this.validateRequired(args, ['step', 'address']);
    if (required !== true) return required;

    const types = this.validateTypes(args, {
      step: 'number',
      address: 'string'
    });
    if (types !== true) return types;

    if (!args.address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return 'Invalid contract address format';
    }

    return true;
  }

  async execute(args: { step: number; address: string }, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await plugin.call('debugger', 'storageViewAt', args.step, args.address);

      if (!result) {
        return this.createErrorResult('Storage viewer not available. Ensure a debug session is active.');
      }

      return this.createSuccessResult({
        success: true,
        step: args.step,
        address: args.address,
        message: 'Storage viewer created successfully. Use this for inspecting contract storage.'
      });

    } catch (error) {
      return this.createErrorResult(`Failed to create storage viewer: ${error.message}`);
    }
  }
}

/**
 * Jump To Step Handler
 */
export class JumpToHandler extends BaseToolHandler {
  name = 'jump_to';
  description = 'Jump directly to a specific step in the execution trace';
  inputSchema = {
    type: 'object',
    properties: {
      step: {
        type: 'number',
        description: 'The target step index to jump to'
      }
    },
    required: ['step']
  };

  getPermissions(): string[] {
    return ['debug:control'];
  }

  validate(args: { step: number }): boolean | string {
    const required = this.validateRequired(args, ['step']);
    if (required !== true) return required;

    const types = this.validateTypes(args, { step: 'number' });
    if (types !== true) return types;

    if (args.step < 0) {
      return 'Step index must be a non-negative number';
    }

    return true;
  }

  async execute(args: { step: number }, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      await plugin.call('debugger', 'jumpTo', args.step);

      return this.createSuccessResult({
        success: true,
        step: args.step,
        message: `Successfully jumped to step ${args.step}`
      });

    } catch (error) {
      return this.createErrorResult(`Failed to jump to step: ${error.message}`);
    }
  }
}

/**
 * Get All Debug Cache Handler
 *
 * Returns comprehensive trace cache data accumulated during transaction execution debugging.
 * The trace cache stores metadata about the execution trace including calls, storage changes, memory changes, and more.
 *
 * Returned properties:
 *
 * - returnValues: Object mapping VM trace step indices to their return values
 *   - Keys: VM trace step indices (numbers)
 *   - Values: Return value data from RETURN operations
 *
 * - stopIndexes: Array of STOP operation occurrences
 *   - Each element: {index: number, address: string} where index is VM trace step and address is contract address
 *
 * - outofgasIndexes: Array of out-of-gas occurrences
 *   - Each element: {index: number, address: string} indicating where out-of-gas errors occurred
 *
 * - callsTree: Root node of the nested call tree structure representing the execution flow
 *   - Structure: {call: {op, address, callStack, calls, start, return?, reverted?}}
 *   - op: EVM operation that initiated the call (CALL, DELEGATECALL, CREATE, etc.)
 *   - address: Contract address being called
 *   - callStack: Stack trace at the point of call
 *   - calls: Nested object of child calls indexed by their start step
 *   - start: VM trace index where call begins
 *   - return: VM trace index where call ends (optional)
 *   - reverted: Boolean indicating if the call was reverted (optional)
 *
 * - callsData: Object mapping VM trace indices to calldata at that point
 *   - Keys: VM trace step indices where calldata changed
 *   - Values: Calldata byte arrays or hex strings
 *
 * - contractCreation: Object mapping creation tokens to deployed contract bytecode
 *   - Keys: Unique tokens identifying contract creation operations
 *   - Values: Hex-encoded bytecode of created contracts (format: '0x...')
 *
 * - addresses: Array of all contract addresses encountered during execution
 *   - Ordered chronologically as they appear in the trace
 *   - May contain duplicates if same address accessed multiple times
 *
 * - callDataChanges: Array of VM trace step indices where calldata changed
 *   - Indices correspond to keys in callsData object
 *   - Useful for tracking when new calls are made
 *
 * - memoryChanges: Array of VM trace step indices where EVM memory changed
 *   - Tracks all MSTORE, MLOAD, and similar operations
 *   - Use to identify when memory is read/written
 *
 * - storageChanges: Array of VM trace step indices where storage was modified (SSTORE operations)
 *   - Indices correspond to keys in sstore object
 *   - Chronologically ordered
 *
 * - sstore: Object mapping VM trace indices to detailed SSTORE operation information
 *   - Keys: VM trace step indices where SSTORE occurred
 *   - Values: Objects containing:
 *     * address: Contract address where storage was modified
 *     * key: Storage slot key (unhashed)
 *     * value: New storage value
 *     * hashedKey: SHA3-256 hash of the key
 *     * contextCall: Reference to the call context when SSTORE occurred
 */
export class GetAllDebugCacheHandler extends BaseToolHandler {
  name = 'get_all_debug_cache';
  description = `Retrieve comprehensive trace cache data accumulated during transaction execution debugging. The trace cache stores metadata about execution including calls, storage changes, memory changes, return values, and more.

Returns an object with the following properties:

1. returnValues: Object mapping VM trace step indices to return values from RETURN operations

2. stopIndexes: Array of STOP operation occurrences [{index: number, address: string}]

3. outofgasIndexes: Array of out-of-gas occurrences [{index: number, address: string}]

4. callsTree: Root node of nested call tree representing execution flow
   - Structure: {call: {op, address, callStack, calls, start, return?, reverted?}}
   - Captures all CALL, DELEGATECALL, CREATE operations and their nesting

5. callsData: Object mapping VM trace indices to calldata at each point

6. contractCreation: Object mapping creation tokens to deployed contract bytecode (hex format)

7. addresses: Array of all contract addresses encountered during execution (chronological, may have duplicates)

8. callDataChanges: Array of VM trace indices where calldata changed

9. memoryChanges: Array of VM trace indices where EVM memory changed (MSTORE, MLOAD operations)

10. storageChanges: Array of VM trace indices where storage was modified (SSTORE operations)

11. sstore: Object mapping VM trace indices to SSTORE operation details
    - Each entry: {address, key, value, hashedKey, contextCall}
    - Tracks all storage modifications with context

Use this to analyze transaction execution patterns, track state changes, debug call flows, and understand contract interactions.`;
  inputSchema = {
    type: 'object',
    properties: {},
    required: []
  };

  getPermissions(): string[] {
    return ['debug:read'];
  }

  validate(_args: {}): boolean | string {
    return true;
  }

  async execute(_args: {}, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await plugin.call('debugger', 'getAllDebugCache');

      if (!result) {
        return this.createErrorResult('Debug cache not available. Please start a debug session first.');
      }

      return this.createSuccessResult({
        success: true,
        cache: result
      });

    } catch (error) {
      return this.createErrorResult(`Failed to get debug cache: ${error.message}`);
    }
  }
}

/**
 * Get Call Tree Scopes Handler
 *
 * Returns comprehensive scope information from the internal call tree analysis.
 * The call tree represents the execution flow including function calls, internal jumps, and constructor executions.
 *
 * Returned properties:
 *
 * - scopes: Map of all scopes in the execution trace. Each scope represents a function call or execution context.
 *   - Keys: scopeId strings in dotted notation (e.g., "1", "1.2", "1.2.3" for nested scopes)
 *   - Values: Scope objects containing:
 *     - firstStep: VM trace index where the scope begins
 *     - lastStep: VM trace index where the scope ends
 *     - locals: Map of local variables in this scope (variable name -> {name, type, stackDepth, sourceLocation})
 *     - isCreation: Boolean indicating if this is a contract creation context
 *     - gasCost: Total gas consumed within this scope
 *
 * - scopeStarts: Map linking VM trace indices to scope identifiers
 *   - Keys: VM trace step indices
 *   - Values: scopeId strings indicating which scope starts at each step
 *
 * - functionDefinitionsByScope: Map of function definitions for each scope
 *   - Keys: scopeId strings
 *   - Values: Objects containing:
 *     - functionDefinition: AST node with function metadata (name, parameters, returnParameters, etc.)
 *     - inputs: Array of input parameter names
 *
 * - functionCallStack: Array of VM trace step indices where function calls occur, ordered chronologically
 */
export class GetCallTreeScopesHandler extends BaseToolHandler {
  name = 'get_call_tree_scopes';
  description = `Retrieve comprehensive scope information from the call tree analysis of the current debug session. The call tree represents execution flow including function calls, internal jumps, and constructor executions.

Returns an object with the following properties:

1. scopes: Map of all scopes in the execution trace. Each scope represents a function call or execution context.
   - Keys: scopeId strings in dotted notation (e.g., "1" for top-level, "1.2" for nested, "1.2.3" for deeply nested)
   - Values: Scope objects with:
     * firstStep: VM trace index where scope begins
     * lastStep: VM trace index where scope ends
     * locals: Map of local variables (variable name -> {name, type, stackDepth, sourceLocation})
     * isCreation: Boolean indicating if this is a contract creation context
     * gasCost: Total gas consumed within this scope

2. scopeStarts: Map linking VM trace indices to scope identifiers
   - Keys: VM trace step indices
   - Values: scopeId strings indicating which scope starts at each step

3. functionDefinitionsByScope: Map of function definitions for each scope
   - Keys: scopeId strings
   - Values: Objects containing:
     * functionDefinition: AST node with function metadata (name, parameters, returnParameters, kind, etc.)
     * inputs: Array of input parameter names

4. functionCallStack: Array of VM trace step indices where function calls occur, ordered chronologically

Use this to understand the execution structure, navigate between scopes, analyze function calls, and inspect local variables at different execution levels.`;
  inputSchema = {
    type: 'object',
    properties: {},
    required: []
  };

  getPermissions(): string[] {
    return ['debug:read'];
  }

  validate(_args: {}): boolean | string {
    return true;
  }

  async execute(_args: {}, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await plugin.call('debugger', 'getCallTreeScopes');

      if (!result) {
        return this.createErrorResult('Call tree scopes not available. Please start a debug session first.');
      }

      return this.createSuccessResult({
        success: true,
        scopes: result.scopes,
        scopeStarts: result.scopeStarts,
        functionDefinitionsByScope: result.functionDefinitionsByScope,
        functionCallStack: result.functionCallStack
      });

    } catch (error) {
      return this.createErrorResult(`Failed to get call tree scopes: ${error.message}`);
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
    },
    {
      name: 'get_valid_source_location_from_vm_trace_index',
      description: 'Get a valid source location from a VM trace step index',
      inputSchema: new GetValidSourceLocationFromVMTraceIndexHandler().inputSchema,
      category: ToolCategory.DEBUGGING,
      permissions: ['debug:read'],
      handler: new GetValidSourceLocationFromVMTraceIndexHandler()
    },
    {
      name: 'source_location_from_instruction_index',
      description: 'Get the source location from an instruction index (bytecode position)',
      inputSchema: new SourceLocationFromInstructionIndexHandler().inputSchema,
      category: ToolCategory.DEBUGGING,
      permissions: ['debug:read'],
      handler: new SourceLocationFromInstructionIndexHandler()
    },
    {
      name: 'extract_locals_at',
      description: 'Extract the scope information (local variables context) at a specific execution step',
      inputSchema: new ExtractLocalsAtHandler().inputSchema,
      category: ToolCategory.DEBUGGING,
      permissions: ['debug:read'],
      handler: new ExtractLocalsAtHandler()
    },
    {
      name: 'decode_locals_at',
      description: 'Decode all local variables at a specific execution step and source location',
      inputSchema: new DecodeLocalsAtHandler().inputSchema,
      category: ToolCategory.DEBUGGING,
      permissions: ['debug:read'],
      handler: new DecodeLocalsAtHandler()
    },
    {
      name: 'extract_state_at',
      description: 'Extract all state variables metadata at a specific execution step',
      inputSchema: new ExtractStateAtHandler().inputSchema,
      category: ToolCategory.DEBUGGING,
      permissions: ['debug:read'],
      handler: new ExtractStateAtHandler()
    },
    {
      name: 'decode_state_at',
      description: 'Decode the values of specified state variables at a specific execution step',
      inputSchema: new DecodeStateAtHandler().inputSchema,
      category: ToolCategory.DEBUGGING,
      permissions: ['debug:read'],
      handler: new DecodeStateAtHandler()
    },
    {
      name: 'storage_view_at',
      description: 'Create a storage viewer for inspecting contract storage at a specific step',
      inputSchema: new StorageViewAtHandler().inputSchema,
      category: ToolCategory.DEBUGGING,
      permissions: ['debug:read'],
      handler: new StorageViewAtHandler()
    },
    {
      name: 'jump_to',
      description: 'Jump directly to a specific step in the execution trace',
      inputSchema: new JumpToHandler().inputSchema,
      category: ToolCategory.DEBUGGING,
      permissions: ['debug:control'],
      handler: new JumpToHandler()
    },
    {
      name: 'get_call_tree_scopes',
      description: new GetCallTreeScopesHandler().description,
      inputSchema: new GetCallTreeScopesHandler().inputSchema,
      category: ToolCategory.DEBUGGING,
      permissions: ['debug:read'],
      handler: new GetCallTreeScopesHandler()
    },
    {
      name: 'get_all_debug_cache',
      description: new GetAllDebugCacheHandler().description,
      inputSchema: new GetAllDebugCacheHandler().inputSchema,
      category: ToolCategory.DEBUGGING,
      permissions: ['debug:read'],
      handler: new GetAllDebugCacheHandler()
    }
  ];
}