import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

/**
 * Comprehensive test suite for all RemixMCPServer resource providers
 * Tests all three main resource providers: Project, Compilation, and Deployment
 */

module.exports = {
  '@disabled': false,
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done)
  },

  /**
   * Test: Verify all resource providers are registered
   */
  'Should have all resource providers registered': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="remix-ai-assistant"]')
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const server = aiPlugin.remixMCPServer;
          const providers = server.resources.list();

          const providerNames = providers.map((p: any) => p.name);
          const hasProject = providerNames.includes('project');
          const hasCompilation = providerNames.includes('compilation');
          const hasDeployment = providerNames.includes('deployment');

          return {
            totalProviders: providers.length,
            providerNames,
            hasProject,
            hasCompilation,
            hasDeployment,
            allProvidersRegistered: hasProject && hasCompilation && hasDeployment
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Resource providers error:', data.error);
          return;
        }
        browser.assert.ok(data.totalProviders >= 3, 'Should have at least 3 resource providers');
        browser.assert.ok(data.hasProject, 'Should have project resource provider');
        browser.assert.ok(data.hasCompilation, 'Should have compilation resource provider');
        browser.assert.ok(data.hasDeployment, 'Should have deployment resource provider');
        browser.assert.ok(data.allProvidersRegistered, 'All required providers should be registered');
      });
  },

  /**
   * PROJECT RESOURCE PROVIDER TESTS
   */
  'Should list all project resources': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const response = await aiPlugin.remixMCPServer.handleMessage({
            method: 'resources/list',
            id: 'test-1'
          });

          const resources = response.result.resources || [];
          const projectResources = resources.filter((r: any) => r.uri.startsWith('project://'));
          const fileResources = resources.filter((r: any) => r.uri.startsWith('file://'));

          const expectedProjectResources = [
            'project://structure',
            'project://config',
            'project://dependencies'
          ];

          const foundProjectResources = expectedProjectResources.filter(uri =>
            projectResources.some((r: any) => r.uri === uri)
          );

          return {
            totalResources: resources.length,
            projectResourceCount: projectResources.length,
            fileResourceCount: fileResources.length,
            expectedCount: expectedProjectResources.length,
            foundCount: foundProjectResources.length,
            foundResources: foundProjectResources,
            missingResources: expectedProjectResources.filter(uri =>
              !projectResources.some((r: any) => r.uri === uri)
            ),
            sampleProjectResource: projectResources[0] || null
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Project resources list error:', data.error);
          return;
        }
        browser.assert.ok(data.totalResources > 0, 'Should have resources');
        browser.assert.ok(data.projectResourceCount >= 3, 'Should have at least 3 project resources');
        browser.assert.equal(data.foundCount, data.expectedCount, 'Should have all expected project resources');
        browser.assert.equal(data.missingResources.length, 0, 'Should not have missing project resources');
      });
  },

  'Should read project structure resource': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const response = await aiPlugin.remixMCPServer.handleMessage({
            method: 'resources/read',
            params: { uri: 'project://structure' },
            id: 'test-2'
          });

          const content = response.result;
          let structureData = null;

          if (content.text) {
            try {
              structureData = JSON.parse(content.text);
            } catch (e) {
              return { error: 'Failed to parse structure JSON' };
            }
          }

          return {
            hasContent: !!content,
            uri: content.uri,
            mimeType: content.mimeType,
            hasText: !!content.text,
            hasStructure: !!structureData?.structure,
            hasRoot: !!structureData?.root,
            hasGeneratedAt: !!structureData?.generatedAt,
            isValidJSON: content.mimeType === 'application/json'
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Project structure read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have structure content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasStructure, 'Should have structure data');
        browser.assert.ok(data.hasGeneratedAt, 'Should have timestamp');
      });
  },

  'Should read project config resource': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const response = await aiPlugin.remixMCPServer.handleMessage({
            method: 'resources/read',
            params: { uri: 'project://config' },
            id: 'test-3'
          });

          const content = response.result;
          let configData = null;

          if (content.text) {
            configData = JSON.parse(content.text);
          }

          return {
            hasContent: !!content,
            mimeType: content.mimeType,
            hasConfigs: !!configData?.configs,
            hasGeneratedAt: !!configData?.generatedAt,
            configKeys: configData?.configs ? Object.keys(configData.configs) : []
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Project config read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have config content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasConfigs, 'Should have configs object');
        browser.assert.ok(data.hasGeneratedAt, 'Should have timestamp');
      });
  },

  'Should read project dependencies resource': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const response = await aiPlugin.remixMCPServer.handleMessage({
            method: 'resources/read',
            params: { uri: 'project://dependencies' },
            id: 'test-4'
          });

          const content = response.result;
          let depsData = null;

          if (content.text) {
            depsData = JSON.parse(content.text);
          }

          return {
            hasContent: !!content,
            mimeType: content.mimeType,
            hasNpm: !!depsData?.npm,
            hasImports: !!depsData?.imports,
            hasContracts: !!depsData?.contracts,
            hasGeneratedAt: !!depsData?.generatedAt,
            importsCount: depsData?.imports?.length || 0
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Project dependencies read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have dependencies content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasNpm, 'Should have npm section');
        browser.assert.ok(data.hasImports, 'Should have imports array');
        browser.assert.ok(data.hasContracts, 'Should have contracts array');
      });
  },

  /**
   * COMPILATION RESOURCE PROVIDER TESTS
   */
  'Should list all compilation resources': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const response = await aiPlugin.remixMCPServer.handleMessage({
            method: 'resources/list',
            id: 'test-5'
          });

          const resources = response.result.resources || [];
          const compilationResources = resources.filter((r: any) =>
            r.uri.startsWith('compilation://') || r.uri.startsWith('contract://')
          );

          const expectedCompilationResources = [
            'compilation://latest',
            'compilation://contracts',
            'compilation://errors',
            'compilation://artifacts',
            'compilation://dependencies',
            'compilation://config'
          ];

          const foundResources = expectedCompilationResources.filter(uri =>
            compilationResources.some((r: any) => r.uri === uri)
          );

          return {
            compilationResourceCount: compilationResources.length,
            expectedCount: expectedCompilationResources.length,
            foundCount: foundResources.length,
            foundResources,
            missingResources: expectedCompilationResources.filter(uri =>
              !compilationResources.some((r: any) => r.uri === uri)
            )
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Compilation resources list error:', data.error);
          return;
        }
        browser.assert.ok(data.compilationResourceCount >= 6, 'Should have at least 6 compilation resources');
        browser.assert.equal(data.foundCount, data.expectedCount, 'Should have all expected compilation resources');
        browser.assert.equal(data.missingResources.length, 0, 'Should not have missing compilation resources');
      });
  },

  'Should read compilation latest resource': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const response = await aiPlugin.remixMCPServer.handleMessage({
            method: 'resources/read',
            params: { uri: 'compilation://latest' },
            id: 'test-6'
          });

          const content = response.result;
          let compilationData = null;

          if (content.text) {
            compilationData = JSON.parse(content.text);
          }

          return {
            hasContent: !!content,
            mimeType: content.mimeType,
            hasSuccess: compilationData?.success !== undefined,
            hasTimestamp: !!compilationData?.timestamp,
            hasContracts: !!compilationData?.contracts,
            hasErrors: !!compilationData?.errors,
            hasSources: !!compilationData?.sources,
            contractCount: compilationData?.contracts ? Object.keys(compilationData.contracts).length : 0,
            errorCount: compilationData?.errors?.length || 0
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Compilation latest read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have latest compilation content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasSuccess !== undefined, 'Should have success flag');
        browser.assert.ok(data.hasContracts, 'Should have contracts object');
        browser.assert.ok(data.hasErrors, 'Should have errors array');
      });
  },

  'Should read compilation contracts resource': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const response = await aiPlugin.remixMCPServer.handleMessage({
            method: 'resources/read',
            params: { uri: 'compilation://contracts' },
            id: 'test-7'
          });

          const content = response.result;
          let contractsData = null;

          if (content.text) {
            contractsData = JSON.parse(content.text);
          }

          return {
            hasContent: !!content,
            mimeType: content.mimeType,
            hasCompiledContracts: !!contractsData?.compiledContracts,
            hasCount: contractsData?.count !== undefined,
            hasGeneratedAt: !!contractsData?.generatedAt,
            contractCount: contractsData?.count || 0
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Compilation contracts read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have contracts content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasCount !== undefined, 'Should have count');
        browser.assert.ok(data.hasGeneratedAt, 'Should have timestamp');
      });
  },

  'Should read compilation config resource': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const response = await aiPlugin.remixMCPServer.handleMessage({
            method: 'resources/read',
            params: { uri: 'compilation://config' },
            id: 'test-8'
          });

          const content = response.result;
          let configData = null;

          if (content.text) {
            configData = JSON.parse(content.text);
          }

          return {
            hasContent: !!content,
            mimeType: content.mimeType,
            hasVersion: !!configData?.version,
            hasOptimize: configData?.optimize !== undefined,
            hasRuns: configData?.runs !== undefined,
            hasEvmVersion: !!configData?.evmVersion,
            hasLanguage: !!configData?.language,
            config: configData
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Compilation config read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have config content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasVersion, 'Should have version');
        browser.assert.ok(data.hasOptimize !== undefined, 'Should have optimize flag');
      });
  },

  /**
   * DEPLOYMENT RESOURCE PROVIDER TESTS
   */
  'Should list all deployment resources': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const response = await aiPlugin.remixMCPServer.handleMessage({
            method: 'resources/list',
            id: 'test-9'
          });

          const resources = response.result.resources || [];
          const deploymentResources = resources.filter((r: any) =>
            r.uri.startsWith('deployment://') || r.uri.startsWith('instance://')
          );

          const expectedDeploymentResources = [
            'deployment://history',
            'deployment://active',
            'deployment://networks',
            'deployment://transactions',
            'deployment://config'
          ];

          const foundResources = expectedDeploymentResources.filter(uri =>
            deploymentResources.some((r: any) => r.uri === uri)
          );

          return {
            deploymentResourceCount: deploymentResources.length,
            expectedCount: expectedDeploymentResources.length,
            foundCount: foundResources.length,
            foundResources,
            missingResources: expectedDeploymentResources.filter(uri =>
              !deploymentResources.some((r: any) => r.uri === uri)
            ),
            instanceResources: deploymentResources.filter((r: any) =>
              r.uri.startsWith('instance://')
            ).length
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Deployment resources list error:', data.error);
          return;
        }
        browser.assert.ok(data.deploymentResourceCount >= 5, 'Should have at least 5 deployment resources');
        browser.assert.equal(data.foundCount, data.expectedCount, 'Should have all expected deployment resources');
        browser.assert.equal(data.missingResources.length, 0, 'Should not have missing deployment resources');
      });
  },

  'Should read deployment history resource': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const response = await aiPlugin.remixMCPServer.handleMessage({
            method: 'resources/read',
            params: { uri: 'deployment://history' },
            id: 'test-10'
          });

          const content = response.result;
          let historyData = null;

          if (content.text) {
            historyData = JSON.parse(content.text);
          }

          return {
            hasContent: !!content,
            mimeType: content.mimeType,
            hasDeployments: !!historyData?.deployments,
            hasSummary: !!historyData?.summary,
            hasGeneratedAt: !!historyData?.generatedAt,
            deploymentCount: historyData?.deployments?.length || 0,
            summary: historyData?.summary || null
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Deployment history read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have history content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasDeployments, 'Should have deployments array');
        browser.assert.ok(data.hasSummary, 'Should have summary');
      });
  },

  'Should read deployment networks resource': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const response = await aiPlugin.remixMCPServer.handleMessage({
            method: 'resources/read',
            params: { uri: 'deployment://networks' },
            id: 'test-11'
          });

          const content = response.result;
          let networksData = null;

          if (content.text) {
            networksData = JSON.parse(content.text);
          }

          return {
            hasContent: !!content,
            mimeType: content.mimeType,
            hasConfigured: !!networksData?.configured,
            hasCurrent: !!networksData?.current,
            hasEnvironment: !!networksData?.environment,
            hasStatistics: !!networksData?.statistics,
            networkCount: networksData?.configured?.length || 0,
            currentNetwork: networksData?.current || null
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Deployment networks read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have networks content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasConfigured, 'Should have configured networks');
        browser.assert.ok(data.hasCurrent, 'Should have current network');
        browser.assert.ok(data.hasStatistics, 'Should have statistics');
      });
  },

  'Should read deployment config resource': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const response = await aiPlugin.remixMCPServer.handleMessage({
            method: 'resources/read',
            params: { uri: 'deployment://config' },
            id: 'test-12'
          });

          const content = response.result;
          let configData = null;

          if (content.text) {
            configData = JSON.parse(content.text);
          }

          return {
            hasContent: !!content,
            mimeType: content.mimeType,
            hasEnvironment: !!configData?.environment,
            hasAccounts: !!configData?.accounts,
            hasGas: !!configData?.gas,
            hasCompiler: !!configData?.compiler,
            hasDeployment: !!configData?.deployment,
            hasCapabilities: !!configData?.capabilities,
            accountCount: configData?.accounts?.length || 0,
            selectedAccount: configData?.selectedAccount || null
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Deployment config read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have config content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasEnvironment, 'Should have environment config');
        browser.assert.ok(data.hasAccounts, 'Should have accounts');
        browser.assert.ok(data.hasGas, 'Should have gas config');
      });
  },

  /**
   * ERROR HANDLING TESTS
   */
  'Should handle invalid resource URIs gracefully': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const invalidURIs = [
            'invalid://resource',
            'project://nonexistent',
            'compilation://invalid',
            'deployment://missing',
            'file://../../etc/passwd', // Path traversal attempt
            'http://example.com' // External URI
          ];

          const results = [];

          for (const uri of invalidURIs) {
            try {
              const response = await aiPlugin.remixMCPServer.handleMessage({
                method: 'resources/read',
                params: { uri },
                id: `test-invalid-${uri}`
              });

              results.push({
                uri,
                hasError: !!response.error,
                errorCode: response.error?.code || null,
                handled: true
              });
            } catch (error) {
              results.push({
                uri,
                hasError: true,
                errorMessage: error.message,
                handled: true
              });
            }
          }

          return {
            totalTests: invalidURIs.length,
            allHandled: results.every(r => r.handled),
            allErrored: results.every(r => r.hasError),
            results,
            systemStable: true
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Invalid URI handling error:', data.error);
          return;
        }
        browser.assert.equal(data.totalTests, 6, 'Should test all invalid URIs');
        browser.assert.ok(data.allHandled, 'All invalid URIs should be handled');
        browser.assert.ok(data.systemStable, 'System should remain stable');
      });
  },

  /**
   * PERFORMANCE & CACHING TESTS
   */
  'Should test resource caching performance': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const server = aiPlugin.remixMCPServer;
          const testURI = 'deployment://history';

          // First read (uncached)
          const startTime1 = Date.now();
          await server.handleMessage({
            method: 'resources/read',
            params: { uri: testURI },
            id: 'test-cache-1'
          });
          const firstReadTime = Date.now() - startTime1;

          // Second read (should be cached)
          const startTime2 = Date.now();
          await server.handleMessage({
            method: 'resources/read',
            params: { uri: testURI },
            id: 'test-cache-2'
          });
          const secondReadTime = Date.now() - startTime2;

          // Get cache stats
          const cacheStats = server.getCacheStats();

          return {
            firstReadTime,
            secondReadTime,
            cachingWorking: secondReadTime <= firstReadTime,
            hasCacheStats: !!cacheStats,
            cacheSize: cacheStats?.size || 0,
            cacheHitRate: cacheStats?.hitRate || 0,
            performanceImprovement: firstReadTime > 0 ?
              ((firstReadTime - secondReadTime) / firstReadTime * 100).toFixed(2) : 0
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Resource caching error:', data.error);
          return;
        }
        browser.assert.ok(data.hasCacheStats, 'Should have cache statistics');
        browser.assert.ok(data.cacheSize >= 0, 'Should have cache size');
      });
  }
};
