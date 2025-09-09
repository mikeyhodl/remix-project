/**
 * Tests for Remix MCP Server
 */

import { RemixMCPServer } from '../RemixMCPServer';
import { MockRemixAPIIntegration } from '../RemixAPIIntegration';
import { createFileManagementTools } from '../handlers/FileManagementHandler';
import { createCompilationTools } from '../handlers/CompilationHandler';
import { createDeploymentTools } from '../handlers/DeploymentHandler';
import { createDebuggingTools } from '../handlers/DebuggingHandler';
import { ProjectResourceProvider } from '../providers/ProjectResourceProvider';
import { CompilationResourceProvider } from '../providers/CompilationResourceProvider';
import { DeploymentResourceProvider } from '../providers/DeploymentResourceProvider';
import { defaultSecurityConfig } from '../middleware/SecurityMiddleware';
import { defaultValidationConfig } from '../middleware/ValidationMiddleware';
import { MCPToolCall } from '../../types/mcp';
import { ToolExecutionContext } from '../types/mcpTools';

describe('RemixMCPServer', () => {
  let server: RemixMCPServer;
  let mockRemixApi: any;

  beforeEach(async () => {
    // Create mock Remix API
    mockRemixApi = {
      fileManager: {
        exists: jest.fn().mockResolvedValue(true),
        readFile: jest.fn().mockResolvedValue('// Mock file content'),
        writeFile: jest.fn().mockResolvedValue(undefined),
        readdir: jest.fn().mockResolvedValue(['file1.sol', 'file2.sol']),
        isDirectory: jest.fn().mockResolvedValue(false),
        mkdir: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
        rename: jest.fn().mockResolvedValue(undefined)
      },
      config: {
        getAppParameter: jest.fn().mockResolvedValue('{"version":"0.8.19"}'),
        setAppParameter: jest.fn().mockResolvedValue(undefined)
      }
    };

    // Initialize server
    server = new RemixMCPServer(mockRemixApi, {
      security: defaultSecurityConfig,
      validation: defaultValidationConfig
    });

    await server.initialize();
  });

  afterEach(async () => {
    await server.shutdown();
  });

  describe('Server Initialization', () => {
    test('should initialize successfully', () => {
      expect(server.isRunning()).toBe(true);
    });

    test('should register all tool handlers', () => {
      const tools = server.getTools();
      
      // Check file management tools
      expect(tools.find(t => t.name === 'file_read')).toBeDefined();
      expect(tools.find(t => t.name === 'file_write')).toBeDefined();
      expect(tools.find(t => t.name === 'file_create')).toBeDefined();
      expect(tools.find(t => t.name === 'file_delete')).toBeDefined();
      
      // Check compilation tools
      expect(tools.find(t => t.name === 'solidity_compile')).toBeDefined();
      expect(tools.find(t => t.name === 'get_compilation_result')).toBeDefined();
      
      // Check deployment tools
      expect(tools.find(t => t.name === 'deploy_contract')).toBeDefined();
      expect(tools.find(t => t.name === 'call_contract')).toBeDefined();
      
      // Check debugging tools
      expect(tools.find(t => t.name === 'start_debug_session')).toBeDefined();
      expect(tools.find(t => t.name === 'set_breakpoint')).toBeDefined();
    });

    test('should register all resource providers', () => {
      const providers = server.getResourceProviders();
      
      expect(providers.find(p => p.name === 'project')).toBeDefined();
      expect(providers.find(p => p.name === 'compilation')).toBeDefined();
      expect(providers.find(p => p.name === 'deployment')).toBeDefined();
    });
  });

  describe('Tool Execution', () => {
    const mockContext: ToolExecutionContext = {
      userId: 'test-user',
      sessionId: 'test-session',
      permissions: ['*'],
      timestamp: new Date()
    };

    test('should execute file_read tool', async () => {
      const call: MCPToolCall = {
        name: 'file_read',
        arguments: {
          path: 'contracts/MyToken.sol'
        }
      };

      const result = await server.executeTool(call, mockContext);

      expect(result.isError).toBe(false);
      expect(result.content).toBeDefined();
      expect(mockRemixApi.fileManager.readFile).toHaveBeenCalledWith('contracts/MyToken.sol');
    });

    test('should execute file_write tool', async () => {
      const call: MCPToolCall = {
        name: 'file_write',
        arguments: {
          path: 'contracts/NewToken.sol',
          content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract NewToken {}'
        }
      };

      const result = await server.executeTool(call, mockContext);

      expect(result.isError).toBe(false);
      expect(mockRemixApi.fileManager.writeFile).toHaveBeenCalledWith(
        'contracts/NewToken.sol',
        '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract NewToken {}'
      );
    });

    test('should handle tool execution errors', async () => {
      // Make the mock throw an error
      mockRemixApi.fileManager.readFile.mockRejectedValue(new Error('File not found'));

      const call: MCPToolCall = {
        name: 'file_read',
        arguments: {
          path: 'nonexistent.sol'
        }
      };

      const result = await server.executeTool(call, mockContext);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
    });

    test('should validate tool arguments', async () => {
      const call: MCPToolCall = {
        name: 'file_read',
        arguments: {
          // Missing required 'path' argument
        }
      };

      await expect(server.executeTool(call, mockContext)).rejects.toThrow();
    });

    test('should enforce permissions', async () => {
      const restrictedContext: ToolExecutionContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        permissions: ['file:read'], // Only read permission
        timestamp: new Date()
      };

      const call: MCPToolCall = {
        name: 'file_write', // Requires write permission
        arguments: {
          path: 'test.sol',
          content: 'content'
        }
      };

      await expect(server.executeTool(call, restrictedContext)).rejects.toThrow('Missing permission');
    });
  });

  describe('Resource Management', () => {
    test('should get resources from providers', async () => {
      const resources = await server.getResources();

      expect(resources.resources.length).toBeGreaterThan(0);
      expect(resources.resources.some(r => r.uri.startsWith('project://'))).toBe(true);
      expect(resources.resources.some(r => r.uri.startsWith('compilation://'))).toBe(true);
      expect(resources.resources.some(r => r.uri.startsWith('deployment://'))).toBe(true);
    });

    test('should get resource content', async () => {
      const content = await server.getResourceContent('project://structure');

      expect(content).toBeDefined();
      expect(content.uri).toBe('project://structure');
      expect(content.mimeType).toBe('application/json');
    });

    test('should handle invalid resource URIs', async () => {
      await expect(server.getResourceContent('invalid://resource')).rejects.toThrow();
    });
  });

  describe('Security and Validation', () => {
    test('should block malicious file paths', async () => {
      const context: ToolExecutionContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        permissions: ['*'],
        timestamp: new Date()
      };

      const call: MCPToolCall = {
        name: 'file_read',
        arguments: {
          path: '../../../etc/passwd' // Path traversal attempt
        }
      };

      await expect(server.executeTool(call, context)).rejects.toThrow();
    });

    test('should validate Ethereum addresses', async () => {
      const context: ToolExecutionContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        permissions: ['*'],
        timestamp: new Date()
      };

      const call: MCPToolCall = {
        name: 'call_contract',
        arguments: {
          address: 'invalid-address', // Invalid Ethereum address
          abi: [],
          methodName: 'test'
        }
      };

      await expect(server.executeTool(call, context)).rejects.toThrow();
    });

    test('should enforce rate limiting', async () => {
      const context: ToolExecutionContext = {
        userId: 'rate-limit-test',
        sessionId: 'test-session',
        permissions: ['*'],
        timestamp: new Date()
      };

      const call: MCPToolCall = {
        name: 'file_exists',
        arguments: {
          path: 'test.sol'
        }
      };

      // Execute many requests rapidly
      const promises = Array(100).fill(0).map(() => 
        server.executeTool(call, context)
      );

      const results = await Promise.allSettled(promises);
      
      // Some should be rejected due to rate limiting
      const rejected = results.filter(r => r.status === 'rejected');
      expect(rejected.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing tools gracefully', async () => {
      const call: MCPToolCall = {
        name: 'nonexistent_tool',
        arguments: {}
      };

      const context: ToolExecutionContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        permissions: ['*'],
        timestamp: new Date()
      };

      await expect(server.executeTool(call, context)).rejects.toThrow('Tool \'nonexistent_tool\' not found');
    });

    test('should handle API errors gracefully', async () => {
      // Mock API failure
      mockRemixApi.fileManager.readFile.mockRejectedValue(new Error('API Error'));

      const call: MCPToolCall = {
        name: 'file_read',
        arguments: {
          path: 'test.sol'
        }
      };

      const context: ToolExecutionContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        permissions: ['*'],
        timestamp: new Date()
      };

      const result = await server.executeTool(call, context);
      expect(result.isError).toBe(true);
    });
  });

  describe('Performance and Caching', () => {
    test('should cache resource results', async () => {
      // First call
      const resources1 = await server.getResources();
      
      // Second call should use cache
      const resources2 = await server.getResources();

      expect(resources1).toEqual(resources2);
      // Verify that providers are not called again for cached results
    });

    test('should handle concurrent tool executions', async () => {
      const context: ToolExecutionContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        permissions: ['*'],
        timestamp: new Date()
      };

      const calls = Array(10).fill(0).map((_, i) => ({
        name: 'file_exists',
        arguments: { path: `file${i}.sol` }
      }));

      const promises = calls.map(call => server.executeTool(call, context));
      const results = await Promise.all(promises);

      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result.isError).toBe(false);
      });
    });
  });

  describe('Event System', () => {
    test('should emit events for tool execution', (done) => {
      const context: ToolExecutionContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        permissions: ['*'],
        timestamp: new Date()
      };

      server.on('tool-executed', (toolName, executionContext, result) => {
        expect(toolName).toBe('file_exists');
        expect(executionContext).toEqual(context);
        expect(result).toBeDefined();
        done();
      });

      const call: MCPToolCall = {
        name: 'file_exists',
        arguments: { path: 'test.sol' }
      };

      server.executeTool(call, context);
    });

    test('should emit events for errors', (done) => {
      const context: ToolExecutionContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        permissions: ['*'],
        timestamp: new Date()
      };

      server.on('tool-execution-error', (toolName, executionContext, error) => {
        expect(toolName).toBe('nonexistent_tool');
        expect(executionContext).toEqual(context);
        expect(error).toBeDefined();
        done();
      });

      const call: MCPToolCall = {
        name: 'nonexistent_tool',
        arguments: {}
      };

      server.executeTool(call, context).catch(() => {
        // Expected to throw
      });
    });
  });

  describe('Server Lifecycle', () => {
    test('should shutdown gracefully', async () => {
      expect(server.isRunning()).toBe(true);
      
      await server.shutdown();
      
      expect(server.isRunning()).toBe(false);
    });

    test('should reject operations after shutdown', async () => {
      await server.shutdown();

      const call: MCPToolCall = {
        name: 'file_exists',
        arguments: { path: 'test.sol' }
      };

      const context: ToolExecutionContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        permissions: ['*'],
        timestamp: new Date()
      };

      await expect(server.executeTool(call, context)).rejects.toThrow('Server is not running');
    });
  });
});

/**
 * Integration tests with mock Remix API
 */
describe('RemixMCPServer Integration', () => {
  test('should perform complete file workflow', async () => {
    const mockApi = new MockRemixAPIIntegration();
    const server = new RemixMCPServer(mockApi as any, {
      security: defaultSecurityConfig,
      validation: defaultValidationConfig
    });

    await server.initialize();

    const context: ToolExecutionContext = {
      userId: 'test-user',
      sessionId: 'test-session',
      permissions: ['*'],
      timestamp: new Date()
    };

    try {
      // Create a file
      const createResult = await server.executeTool({
        name: 'file_create',
        arguments: {
          path: 'contracts/TestToken.sol',
          content: '// Test contract content',
          type: 'file'
        }
      }, context);

      expect(createResult.isError).toBe(false);

      // Read the file
      const readResult = await server.executeTool({
        name: 'file_read',
        arguments: {
          path: 'contracts/TestToken.sol'
        }
      }, context);

      expect(readResult.isError).toBe(false);

      // Update the file
      const writeResult = await server.executeTool({
        name: 'file_write',
        arguments: {
          path: 'contracts/TestToken.sol',
          content: '// Updated test contract content'
        }
      }, context);

      expect(writeResult.isError).toBe(false);

      // Delete the file
      const deleteResult = await server.executeTool({
        name: 'file_delete',
        arguments: {
          path: 'contracts/TestToken.sol'
        }
      }, context);

      expect(deleteResult.isError).toBe(false);

    } finally {
      await server.shutdown();
    }
  });
});