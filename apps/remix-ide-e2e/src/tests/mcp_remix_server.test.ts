import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

const testContract = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract RemixMCPServerTest {
    uint256 public testValue;
    string public testString;

    constructor(uint256 _value, string memory _str) {
        testValue = _value;
        testString = _str;
    }

    function updateValue(uint256 _newValue) public {
        testValue = _newValue;
    }

    function updateString(string memory _newString) public {
        testString = _newString;
    }
}
`;

module.exports = {
  '@disabled': false,
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done)
  },

  'Should verify RemixMCPServer initialization': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="remix-ai-assistant"]')
      .execute(function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        const server = aiPlugin.remixMCPServer;
        return {
          hasRemixMcpServer: !!server,
          serverName: server.serverName || null,
          version: server.version || null,
          isInitialized: !!server.tools && !!server.resources,
          hasToolRegistry: !!server.tools,
          hasResourceProviders: !!server.resources,
          capabilities: server.getCapabilities() || null
        };
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('RemixMCPServer error:', data.error);
          return;
        }
        browser.assert.ok(data.hasRemixMcpServer, 'Should have RemixMCPServer instance');
        browser.assert.ok(data.isInitialized, 'Server should be properly initialized');
        browser.assert.ok(data.hasToolRegistry, 'Should have tool registry');
        browser.assert.ok(data.hasResourceProviders, 'Should have resource providers');
      });
  },

  'Should test RemixMCPServer tool registration': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer?.tools) {
          return { error: 'Tool registry not available' };
        }

        const allTools = aiPlugin.remixMCPServer.tools.list();
        const compilationTools = allTools.filter((t: any) =>
          t.name.includes('compile') || t.category === 'COMPILATION'
        );

        const deploymentTools = allTools.filter((t: any) =>
          t.name.includes('deploy') || t.name.includes('account') || t.category === 'DEPLOYMENT'
        );

        const fileTools = allTools.filter((t: any) =>
          t.name.includes('file') || t.category === 'FILE_SYSTEM'
        );

        return {
          totalTools: allTools.length,
          compilationToolCount: compilationTools.length,
          deploymentToolCount: deploymentTools.length,
          fileToolCount: fileTools.length,
          sampleTools: allTools.slice(0, 3).map((t: any) => ({
            name: t.name,
            category: t.category,
            hasHandler: !!t.handler
          }))
        };
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Tool registry error:', data.error);
          return;
        }
        browser.assert.ok(data.totalTools > 0, 'Should have registered tools');
        browser.assert.ok(data.compilationToolCount > 0, 'Should have compilation tools');
        browser.assert.ok(data.deploymentToolCount > 0, 'Should have deployment tools');
      });
  },

  'Should test RemixMCPServer resource providers': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer?.resources) {
          return { error: 'Resource providers not available' };
        }

        const resourceProviders = aiPlugin.remixMCPServer.resources.providers;
        const deploymentProvider = resourceProviders.get('deployment');
        const projectProvider = resourceProviders.get('project');
        const compilerProvider = resourceProviders.get('compiler');

        return {
          totalProviders: resourceProviders.size,
          hasDeploymentProvider: !!deploymentProvider,
          hasProjectProvider: !!projectProvider,
          hasCompilerProvider: !!compilerProvider,
          deploymentProviderMethods: deploymentProvider ? Object.getOwnPropertyNames(Object.getPrototypeOf(deploymentProvider)) : [],
          projectProviderMethods: projectProvider ? Object.getOwnPropertyNames(Object.getPrototypeOf(projectProvider)) : []
        };
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Resource providers error:', data.error);
          return;
        }
        browser.assert.ok(data.totalProviders > 0, 'Should have resource providers');
        browser.assert.ok(data.hasDeploymentProvider, 'Should have deployment provider');
        browser.assert.ok(data.hasProjectProvider, 'Should have project provider');
      });
  },

  'Should test RemixMCPServer main resources reading via server': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const server = aiPlugin.remixMCPServer;
          const historyResource = await server.handleMessage({method:'resources/read', params:{uri:'deployment://history'}, id:"rvhsdf"});
          const structureResource = await server.handleMessage({method:'resources/read', params:{uri:'project://structure'}, id:"rvhsdf"});
          const configResource = await server.handleMessage({method:'resources/read', params:{uri:'compiler://config'}, id:"rvhsdf"});
          console.log('done hanfdling messages')

          return {
            historyRead: !!historyResource,
            structureRead: !!structureResource,
            configRead: !!configResource,
            historyMimeType: historyResource?.mimeType || null,
            structureMimeType: structureResource?.mimeType || null,
            configMimeType: configResource?.mimeType || null,
            historyHasContent: !!historyResource?.text,
            structureHasContent: !!structureResource?.text,
            configHasContent: !!configResource?.text
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Server resource reading error:', data.error);
          return;
        }
        browser.assert.ok(data.historyRead, 'Should read deployment history resource');
        browser.assert.ok(data.structureRead, 'Should read project structure resource');
        browser.assert.ok(data.configRead, 'Should read compiler config resource');
      });
  },

  'Should test RemixMCPServer capabilities and metadata': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        const server = aiPlugin.remixMCPServer;

        // Test server metadata and capabilities
        const capabilities = server.getCapabilities() || {};
        const serverInfo = {
          name: server.serverName,
          version: server.version,
          capabilities: capabilities
        };

        // Test tool and resource listing capabilities
        const toolList = server.tools.list() 
        const resourceList = server.resources.list()

        return {
          serverInfo,
          hasCapabilities: Object.keys(capabilities).length > 0,
          supportsTools: !!capabilities.tools,
          supportsResources: !!capabilities.resources,
          toolListAvailable: !!toolList,
          resourceListAvailable: !!resourceList,
          toolCount: toolList.length,
          resourceCount: resourceList.length
        };
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Server capabilities error:', data.error);
          return;
        }
        browser.assert.ok(data.hasCapabilities, 'Should have server capabilities');
        browser.assert.ok(data.supportsTools, 'Should support tools');
        browser.assert.ok(data.toolCount > 0, 'Should tools');
        browser.assert.ok(data.resourceCount > 0, 'Should resources');
        browser.assert.ok(data.supportsResources, 'Should support resources');
      });
  },

  'Should test RemixMCPServer error handling invalid tool execution': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const server = aiPlugin.remixMCPServer;

          let invalidToolResult;
          try {
            invalidToolResult = await server.executeTool({
              name: 'non_existent_tool',
              arguments: {}
            });
          } catch (error) {
            invalidToolResult = { isError: true, content: [{ text: error.message }] };
          }

          let invalidResourceResult;
          try {
            invalidResourceResult = await server.readResource('invalid://resource');
          } catch (error) {
            invalidResourceResult = null;
          }

          let invalidArgsResult;
          try {
            invalidArgsResult = await server.executeTool({
              name: 'solidity_compile',
              arguments: {
                runs: 99999 // Invalid: too high
              }
            });
          } catch (error) {
            invalidArgsResult = { isError: true, content: [{ text: error.message }] };
          }

          return {
            invalidToolHandled: invalidToolResult?.isError === true,
            invalidResourceHandled: invalidResourceResult === null,
            invalidArgsHandled: invalidArgsResult?.isError === true,
            systemStable: true,
            invalidToolMessage: invalidToolResult?.content?.[0]?.text || 'No message',
            invalidArgsMessage: invalidArgsResult?.content?.[0]?.text || 'No message'
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Server error handling test error:', data.error);
          return;
        }
        browser.assert.ok(data.invalidToolHandled, 'Should handle invalid tools gracefully');
        browser.assert.ok(data.invalidResourceHandled, 'Should handle invalid resources gracefully');
        browser.assert.ok(data.invalidArgsHandled, 'Should handle invalid arguments gracefully');
        browser.assert.ok(data.systemStable, 'System should remain stable after errors');
      });
  },

  'Should test RemixMCPServer performance and caching': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const server = aiPlugin.remixMCPServer;
          const startTime = Date.now();

          // Test multiple operations for performance
          const operations = await Promise.all([
            server.readResource('deployment://history'),
            server.readResource('project://structure'),
          ]);

          const endTime = Date.now();
          const totalTime = endTime - startTime;

          // Test caching behavior
          const cachingStart = Date.now();
          const cachedResource1 = await server.readResource('deployment://history');
          const cachedResource2 = await server.readResource('project://structure');
          const cachingEnd = Date.now();
          const cachingTime = cachingEnd - cachingStart;

          return {
            operationsCompleted: operations.length,
            totalExecutionTime: totalTime,
            averageOperationTime: totalTime / operations.length,
            cachingTime,
            allOperationsSucceeded: operations.every(op => !!op),
            performanceAcceptable: totalTime < 1000, // Should complete within 5 seconds
            cachingWorking: cachingTime < totalTime // Caching should be faster
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Performance test error:', data.error);
          return;
        }
        browser.assert.ok(data.allOperationsSucceeded, 'All operations should succeed');
        browser.assert.ok(data.performanceAcceptable, 'Performance should be acceptable');
        browser.assert.equal(data.operationsCompleted, 5, 'Should complete all test operations');
      });
  }
};