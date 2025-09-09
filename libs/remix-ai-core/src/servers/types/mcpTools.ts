/**
 * Types and interfaces for Remix IDE MCP Tools
 */

import { MCPTool, MCPToolCall, MCPToolResult } from '../../types/mcp';
import { ICustomRemixApi } from '@remix-api';

/**
 * Base interface for all Remix MCP tool handlers
 */
export interface RemixToolHandler {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Input schema for the tool */
  inputSchema: MCPTool['inputSchema'];
  /** Execute the tool with given arguments */
  execute(args: any, remixApi: ICustomRemixApi): Promise<MCPToolResult>;
  /** Get tool permissions required */
  getPermissions?(): string[];
  /** Validate tool arguments */
  validate?(args: any): boolean | string;
}

/**
 * Categories of Remix tools
 */
export enum ToolCategory {
  FILE_MANAGEMENT = 'file_management',
  COMPILATION = 'compilation',
  DEPLOYMENT = 'deployment',
  DEBUGGING = 'debugging',
  ANALYSIS = 'analysis',
  WORKSPACE = 'workspace',
  TESTING = 'testing',
  GIT = 'git'
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  /** User ID */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Current workspace */
  workspace?: string;
  /** Current file */
  currentFile?: string;
  /** User permissions */
  permissions: string[];
  /** Request timestamp */
  timestamp: Date | number;
  /** Request ID for tracking */
  requestId?: string;
}

/**
 * File management tool argument types
 */
export interface FileReadArgs {
  path: string;
}

export interface FileWriteArgs {
  path: string;
  content: string;
  encoding?: string;
}

export interface FileCreateArgs {
  path: string;
  content?: string;
  type?: 'file' | 'directory';
}

export interface FileDeleteArgs {
  path: string;
}

export interface FileMoveArgs {
  from: string;
  to: string;
}

export interface FileCopyArgs {
  from: string;
  to: string;
}

export interface DirectoryListArgs {
  path: string;
  recursive?: boolean;
}

/**
 * Compilation tool argument types
 */
export interface SolidityCompileArgs {
  file?: string;
  version?: string;
  optimize?: boolean;
  runs?: number;
  evmVersion?: string;
}

export interface CompilerConfigArgs {
  version: string;
  optimize: boolean;
  runs: number;
  evmVersion: string;
  language: string;
}

/**
 * Deployment tool argument types
 */
export interface DeployContractArgs {
  contractName: string;
  constructorArgs?: any[];
  gasLimit?: number;
  gasPrice?: string;
  value?: string;
  account?: string;
}

export interface CallContractArgs {
  address: string;
  abi: any[];
  methodName: string;
  args?: any[];
  gasLimit?: number;
  gasPrice?: string;
  value?: string;
  account?: string;
}

export interface SendTransactionArgs {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: number;
  gasPrice?: string;
  account?: string;
}

/**
 * Debugging tool argument types
 */
export interface DebugSessionArgs {
  contractAddress: string;
  transactionHash?: string;
  sourceFile?: string;
  network?: string;
}

export interface BreakpointArgs {
  sourceFile: string;
  lineNumber: number;
  condition?: string;
  hitCount?: number;
}

export interface DebugStepArgs {
  sessionId: string;
  stepType: 'into' | 'over' | 'out' | 'continue';
}

export interface DebugWatchArgs {
  sessionId: string;
  expression: string;
  watchType?: 'variable' | 'expression' | 'memory';
}

export interface DebugEvaluateArgs {
  sessionId: string;
  expression: string;
  context?: 'current' | 'global' | 'local';
}

export interface DebugCallStackArgs {
  sessionId: string;
}

export interface DebugVariablesArgs {
  sessionId: string;
  scope?: 'local' | 'global' | 'storage' | 'memory';
}

export interface StartDebuggerArgs {
  txHash: string;
}

export interface SetBreakpointArgs {
  file: string;
  line: number;
}

export interface InspectVariableArgs {
  variable: string;
  scope?: string;
}

/**
 * Analysis tool argument types
 */
export interface StaticAnalysisArgs {
  file?: string;
  modules?: string[];
}

export interface SecurityScanArgs {
  file?: string;
  depth?: 'basic' | 'detailed' | 'comprehensive';
}

export interface GasEstimationArgs {
  contractName: string;
  methodName?: string;
  args?: any[];
}

/**
 * Workspace tool argument types
 */
export interface CreateWorkspaceArgs {
  name: string;
  template?: string;
  isLocalhost?: boolean;
}

export interface SwitchWorkspaceArgs {
  name: string;
}

export interface ImportProjectArgs {
  source: 'github' | 'ipfs' | 'url';
  path: string;
  workspace?: string;
}

/**
 * Testing tool argument types
 */
export interface RunTestsArgs {
  file?: string;
  testName?: string;
  framework?: 'mocha' | 'jest' | 'hardhat';
}

export interface GenerateTestArgs {
  contractName: string;
  methods?: string[];
  framework?: 'mocha' | 'jest' | 'hardhat';
}

/**
 * Git tool argument types
 */
export interface GitCommitArgs {
  message: string;
  files?: string[];
}

export interface GitPushArgs {
  remote?: string;
  branch?: string;
}

export interface GitPullArgs {
  remote?: string;
  branch?: string;
}

/**
 * Tool result types
 */
export interface FileOperationResult {
  success: boolean;
  path: string;
  message?: string;
  content?: string;
  size?: number;
  lastModified?: string;
}

export interface CompilationResult {
  success: boolean;
  contracts: Record<string, {
    abi: any[];
    bytecode: string;
    deployedBytecode: string;
    metadata: any;
    gasEstimates: any;
  }>;
  errors: any[];
  warnings: any[];
  sources: Record<string, any>;
}

export interface DeploymentResult {
  success: boolean;
  contractAddress?: string;
  transactionHash: string;
  gasUsed: number;
  effectiveGasPrice: string;
  blockNumber: number;
  logs: any[];
}

export interface ContractInteractionResult {
  success: boolean;
  result?: any;
  transactionHash?: string;
  gasUsed?: number;
  logs?: any[];
  error?: string;
}

export interface DebugSessionResult {
  success: boolean;
  sessionId: string;
  contractAddress: string;
  network: string;
  transactionHash?: string;
  sourceFile?: string;
  status: string;
  createdAt: string;
}

export interface BreakpointResult {
  success: boolean;
  breakpointId: string;
  sourceFile: string;
  lineNumber: number;
  condition?: string;
  hitCount?: number;
  enabled: boolean;
  setAt: string;
}

export interface DebugStepResult {
  success: boolean;
  sessionId: string;
  stepType: string;
  currentLocation: {
    sourceFile: string;
    lineNumber: number;
    columnNumber?: number;
  };
  stackTrace: {
    function: string;
    sourceFile: string;
    lineNumber: number;
  }[];
  steppedAt: string;
}

export interface DebugInfo {
  currentStep: number;
  totalSteps: number;
  currentFile: string;
  currentLine: number;
  callStack: any[];
  variables: Record<string, any>;
  memory: string;
  stack: string[];
  storage: Record<string, string>;
}

export interface AnalysisResult {
  file: string;
  issues: {
    severity: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
    column?: number;
    rule?: string;
  }[];
  metrics: {
    complexity: number;
    linesOfCode: number;
    maintainabilityIndex: number;
  };
}

export interface TestResult {
  success: boolean;
  tests: {
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: string;
  }[];
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

/**
 * Remix-specific tool extensions
 */
export interface RemixToolDefinition extends MCPTool {
  category: ToolCategory;
  permissions: string[];
  handler: RemixToolHandler;
}

/**
 * Tool registry interface
 */
export interface ToolRegistry {
  register(tool: RemixToolDefinition): void;
  unregister(name: string): void;
  get(name: string): RemixToolDefinition | undefined;
  list(category?: ToolCategory): RemixToolDefinition[];
  execute(call: MCPToolCall, context: ToolExecutionContext, remixApi: ICustomRemixApi): Promise<MCPToolResult>;
}