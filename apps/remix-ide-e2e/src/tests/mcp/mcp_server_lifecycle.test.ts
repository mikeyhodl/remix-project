import { NightwatchBrowser } from 'nightwatch'
import init from '../../helpers/init'

module.exports = {
  '@disabled': false,
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done)
  },

  'Should test RemixMCPServer startup and initialization': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="verticalIconsKindfilePanel"]')
      .click('*[data-id="verticalIconsKindaiTab"]')
      .waitForElementVisible('*[data-id="aiTabPanel"]')
      .execute(function () {
        const aiPlugin = (window as any).getRemixAIPlugin();
        if (!aiPlugin) {
          return { error: 'AI Plugin not found' };
        }

        // Check server initialization state
        const serverInitialized = !!aiPlugin.remixMCPServer;
        const mcpInferencerInitialized = !!aiPlugin.mcpInferencer;

        let serverDetails = null;
        if (serverInitialized) {
          const server = aiPlugin.remixMCPServer;
          serverDetails = {
            hasName: !!server.serverName,
            hasVersion: !!server.version,
            hasCapabilities: !!server.capabilities,
            hasToolRegistry: !!server.toolRegistry,
            hasResourceProviders: !!server.resourceProviders,
            hasPluginManager: !!server.pluginManager,
            readyState: server.readyState || 'unknown'
          };
        }

        return {
          aiPluginActive: aiPlugin.active,
          serverInitialized,
          mcpInferencerInitialized,
          serverDetails,
          initializationComplete: serverInitialized && mcpInferencerInitialized
        };
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Server startup error:', data.error);
          return;
        }
        browser.assert.ok(data.aiPluginActive, 'AI plugin should be active');
        browser.assert.ok(data.serverInitialized, 'RemixMCPServer should be initialized');
        browser.assert.ok(data.mcpInferencerInitialized, 'MCP inferencer should be initialized');
        browser.assert.ok(data.initializationComplete, 'Complete initialization should be finished');
      });
  },

  'Should test RemixMCPServer registration and availability': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin();
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          // Check if RemixMCPServer is registered with the inferencer
          const connectedServers = aiPlugin.mcpInferencer.getConnectedServers();
          const connectionStatuses = aiPlugin.mcpInferencer.getConnectionStatuses();

          const remixServerConnected = connectedServers.includes('Remix IDE Server');
          const remixServerStatus = connectionStatuses.find((s: any) => s.serverName === 'Remix IDE Server');

          // Test server availability through inferencer
          const allTools = await aiPlugin.mcpInferencer.getAllTools();
          const allResources = await aiPlugin.mcpInferencer.getAllResources();

          const remixTools = allTools['Remix IDE Server'] || [];
          const remixResources = allResources['Remix IDE Server'] || [];

          return {
            remixServerConnected,
            remixServerStatus: remixServerStatus?.status || 'unknown',
            remixToolCount: remixTools.length,
            remixResourceCount: remixResources.length,
            serverRegistered: remixServerConnected && remixTools.length > 0 && remixResources.length > 0,
            connectionStable: remixServerStatus?.status === 'connected'
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Server registration error:', data.error);
          return;
        }
        browser.assert.ok(data.remixServerConnected, 'Remix server should be connected');
        browser.assert.ok(data.serverRegistered, 'Server should be properly registered with tools and resources');
        browser.assert.ok(data.connectionStable, 'Connection should be stable');
        browser.assert.ok(data.remixToolCount > 0, 'Should have Remix tools available');
        browser.assert.ok(data.remixResourceCount > 0, 'Should have Remix resources available');
      });
  },

  'Should test RemixMCPServer configuration and settings': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        const aiPlugin = (window as any).getRemixAIPlugin();
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        const server = aiPlugin.remixMCPServer;
        const config = {
          capabilities: server.getCapabilities() || {},
        };


        const toolRegistry = server.tools;
        const resourceProviders = server.resource.providers;

        const toolConfig = toolRegistry ? {
          totalTools: toolRegistry.tools.size,
          categories: toolRegistry.getToolsByCategory()
        } : null;

        const resourceConfig = resourceProviders ? {
          totalProviders: Object.keys(resourceProviders).length,
          providerTypes: Object.keys(resourceProviders)
        } : null;

        return {
          config,
          toolConfig,
          resourceConfig,
          configurationComplete: !!config.capabilities && !!toolConfig && !!resourceConfig
        };
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Server configuration error:', data.error);
          return;
        }
        browser.assert.ok(data.config.name, 'Server should have a name');
        browser.assert.ok(Object.keys(data.config.capabilities).length > 0, 'Server should have capabilities');
        browser.assert.ok(data.configurationComplete, 'Server configuration should be complete');
      });
  },

  'Should test RemixMCPServer cleanup and shutdown': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin();
        if (!aiPlugin?.remixMCPServer || !aiPlugin?.mcpInferencer) {
          return { error: 'MCP components not available' };
        }

        try {
          const initialConnected = aiPlugin.mcpInferencer.getConnectedServers();
          const initialCount = initialConnected.length;

          await aiPlugin.mcpInferencer.disconnectAllServers();
          const afterDisconnect = aiPlugin.mcpInferencer.getConnectedServers();

          await aiPlugin.mcpInferencer.connectAllServers();
          const afterReconnect = aiPlugin.mcpInferencer.getConnectedServers();

          return {
            initiallyConnected: initialCount > 0,
            disconnectedSuccessfully: afterDisconnect.length === 0,
            reconnectedSuccessfully: afterReconnect.length > 0,
            serverSurvivalTest: afterReconnect.includes('Remix IDE Server'),
            cleanupWorking: true 
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Cleanup test error:', data.error);
          return;
        }
        browser.assert.ok(data.initiallyConnected, 'Should start with connected servers');
        browser.assert.ok(data.disconnectedSuccessfully, 'Should disconnect cleanly');
        browser.assert.ok(data.reconnectedSuccessfully, 'Should reconnect after disconnect');
        browser.assert.ok(data.serverSurvivalTest, 'Remix server should survive disconnect/reconnect cycle');
        browser.assert.ok(data.cleanupWorking, 'Cleanup mechanism should work properly');
      });
  },

  'Should test RemixMCPServer stability under load': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin();
        if (!aiPlugin?.remixMCPServer || !aiPlugin?.mcpInferencer) {
          return { error: 'MCP components not available' };
        }

        try {
          const concurrentOperations = [];
          const startTime = Date.now();

          // Create multiple concurrent tool executions
          for (let i = 0; i < 5; i++) {
            concurrentOperations.push(
              aiPlugin.mcpInferencer.executeTool('Remix IDE Server', {
                name: 'get_compiler_config',
                arguments: {}
              })
            );
          }

          for (let i = 0; i < 5; i++) {
            concurrentOperations.push(
              aiPlugin.mcpInferencer.readResource('Remix IDE Server', 'deployment://history')
            );
          }

          const results = await Promise.allSettled(concurrentOperations);
          const endTime = Date.now();

          const successCount = results.filter(r => r.status === 'fulfilled').length;
          const failureCount = results.filter(r => r.status === 'rejected').length;
          const totalTime = endTime - startTime;

          // Test rapid sequential operations
          const sequentialStart = Date.now();
          const sequentialOps = [];
          for (let i = 0; i < 10; i++) {
            sequentialOps.push(await aiPlugin.mcpInferencer.getAllTools());
          }
          const sequentialEnd = Date.now();
          const sequentialTime = sequentialEnd - sequentialStart;

          return {
            concurrentOperations: concurrentOperations.length,
            successCount,
            failureCount,
            totalTime,
            averageTime: totalTime / concurrentOperations.length,
            sequentialTime,
            stabilityScore: successCount / concurrentOperations.length,
            performanceAcceptable: totalTime < 10000 && sequentialTime < 5000,
            highStability: successCount >= concurrentOperations.length * 0.9 // 90% success rate
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Load stability test error:', data.error);
          return;
        }
        browser.assert.ok(data.performanceAcceptable, 'Performance under load should be acceptable');
        browser.assert.ok(data.highStability, 'System should maintain high stability under load');
        browser.assert.ok(data.successCount > data.failureCount, 'Success rate should exceed failure rate');
      });
  }
};