import { NightwatchBrowser } from 'nightwatch'
import init from '../../helpers/init'

module.exports = {
  '@disabled': false,
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done)
  },

  'Should get all MCP resources': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="verticalIconsKindfilePanel"]')
      .click('*[data-id="verticalIconsKindaiTab"]')
      .waitForElementVisible('*[data-id="aiTabPanel"]')
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin();
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          const allResources = await aiPlugin.mcpInferencer.getAllResources();
          const remixServerResources = allResources['Remix IDE Server'] || [];

          const deploymentResources = remixServerResources.filter((r: any) =>
            r.uri.startsWith('deployment://')
          );

          const projectResources = remixServerResources.filter((r: any) =>
            r.uri.startsWith('project://')
          );

          const compilerResources = remixServerResources.filter((r: any) =>
            r.uri.startsWith('compiler://')
          );

          const fileResources = remixServerResources.filter((r: any) =>
            r.uri.startsWith('file://')
          );

          return {
            totalResources: remixServerResources.length,
            deploymentResources: deploymentResources.length,
            projectResources: projectResources.length,
            compilerResources: compilerResources.length,
            fileResources: fileResources.length,
            resourceTypes: remixServerResources.map((r: any) => r.uri)
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('MCP resources error:', data.error);
          return;
        }
        browser.assert.ok(data.totalResources > 0, 'Should have resources available');
        browser.assert.ok(data.deploymentResources > 0, 'Should have deployment resources');
        browser.assert.ok(data.projectResources > 0, 'Should have project resources');
        browser.assert.ok(data.fileResources > 0, 'Should have file resources');
      });
  },

  'Should test deployment resource provider': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin();
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          const allResources = await aiPlugin.mcpInferencer.getAllResources();
          const remixServerResources = allResources['Remix IDE Server'] || [];

          const deploymentResources = remixServerResources.filter((r: any) =>
            r.uri.startsWith('deployment://')
          );

          const expectedResources = [
            'deployment://history',
            'deployment://active',
            'deployment://networks',
            'deployment://transactions',
            'deployment://config'
          ];

          const foundResources = expectedResources.filter(expected =>
            deploymentResources.some((r: any) => r.uri === expected)
          );

          return {
            expectedCount: expectedResources.length,
            foundCount: foundResources.length,
            foundResources,
            missingResources: expectedResources.filter(expected =>
              !deploymentResources.some((r: any) => r.uri === expected)
            )
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Deployment resources error:', data.error);
          return;
        }
        browser.assert.equal(data.foundCount, data.expectedCount, 'Should have all deployment resources');
        browser.assert.equal(data.missingResources.length, 0, 'Should not have missing resources');
      });
  },

  'Should read deployment history resource': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin();
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          // Get the MCP client for Remix IDE Server
          const mcpClients = (aiPlugin.mcpInferencer as any).mcpClients;
          const remixClient = mcpClients.get('Remix IDE Server');

          if (!remixClient) {
            return { error: 'Remix IDE Server client not found' };
          }

          const historyContent = await remixClient.readResource('deployment://history');
          const historyData = historyContent.text ? JSON.parse(historyContent.text) : null;

          return {
            hasContent: !!historyContent,
            mimeType: historyContent.mimeType,
            hasDeployments: historyData?.deployments?.length > 0,
            hasSummary: !!historyData?.summary,
            deploymentCount: historyData?.deployments?.length || 0,
            summary: historyData?.summary || null
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Deployment history error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have deployment history content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasSummary, 'Should have summary information');
      });
  },

  'Should read project structure resource': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin();
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          const mcpClients = (aiPlugin.mcpInferencer as any).mcpClients;
          const remixClient = mcpClients.get('Remix IDE Server');

          if (!remixClient) {
            return { error: 'Remix IDE Server client not found' };
          }

          const structureContent = await remixClient.readResource('project://structure');
          const structureData = structureContent.text ? JSON.parse(structureContent.text) : null;

          return {
            hasContent: !!structureContent,
            mimeType: structureContent.mimeType,
            hasFiles: structureData?.files?.length > 0,
            hasDirectories: structureData?.directories?.length > 0,
            totalFiles: structureData?.files?.length || 0,
            totalDirectories: structureData?.directories?.length || 0
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Project structure error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have project structure content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
      });
  },

  'Should handle invalid resource URIs gracefully': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin();
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          const mcpClients = (aiPlugin.mcpInferencer as any).mcpClients;
          const remixClient = mcpClients.get('Remix IDE Server');

          let errorOccurred = false;
          let errorMessage = '';

          try {
            await remixClient.readResource('invalid://resource');
          } catch (error) {
            errorOccurred = true;
            errorMessage = error.message;
          }

          return {
            errorHandled: errorOccurred,
            errorMessage,
            systemStillWorking: true
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Error handling test error:', data.error);
          return;
        }
        browser.assert.ok(data.errorHandled, 'Should handle invalid URIs with errors');
        browser.assert.ok(data.systemStillWorking, 'System should continue working after errors');
      });
  }
};