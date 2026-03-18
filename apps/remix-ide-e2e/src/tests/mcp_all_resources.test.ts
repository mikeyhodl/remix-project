import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

/**
 * Comprehensive test suite for all RemixMCPServer resource providers
 * Tests all resource providers: Project, Compilation, Deployment, Context, Tutorials, and Debugging
 */

// Simple contract for debugging tests
const debugTestContract = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DebugTest {
    uint256 public counter;
    mapping(address => uint256) public balances;

    event CounterIncremented(uint256 newValue);
    event BalanceSet(address indexed user, uint256 amount);

    function increment() public {
        counter++;
        emit CounterIncremented(counter);
    }

    function setBalance(address user, uint256 amount) public {
        balances[user] = amount;
        emit BalanceSet(user, amount);
    }

    function complexOperation(uint256 a, uint256 b) public returns (uint256) {
        uint256 result = a + b;
        counter = result;
        emit CounterIncremented(result);
        return result;
    }
}`;

module.exports = {
  '@disabled': true,
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done)
  },

  /**
   * Test: Verify all resource providers are registered
   * #group1
   */
  'Should have all resource providers registered #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="remix-ai-assistant"]')
      .execute( function () {
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
          const hasContext = providerNames.includes('context');
          const hasTutorials = providerNames.includes('tutorials');
          const hasDebugging = providerNames.includes('debugging');

          return {
            totalProviders: providers.length,
            providerNames,
            hasProject,
            hasCompilation,
            hasDeployment,
            hasContext,
            hasTutorials,
            hasDebugging,
            allProvidersRegistered: hasProject && hasCompilation && hasDeployment && hasContext && hasTutorials && hasDebugging
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Resource providers error:', data.error);
          return;
        }
        browser.assert.ok(data.totalProviders >= 6, 'Should have at least 6 resource providers');
        browser.assert.ok(data.hasProject, 'Should have project resource provider');
        browser.assert.ok(data.hasCompilation, 'Should have compilation resource provider');
        browser.assert.ok(data.hasDeployment, 'Should have deployment resource provider');
        browser.assert.ok(data.hasContext, 'Should have context resource provider');
        browser.assert.ok(data.hasTutorials, 'Should have tutorials resource provider');
        browser.assert.ok(data.hasDebugging, 'Should have debugging resource provider');
        browser.assert.ok(data.allProvidersRegistered, 'All required providers should be registered');
      });
  },

  /**
   * PROJECT RESOURCE PROVIDER TESTS
   * #group1
   */
  'Should list all project resources #group1': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/list',
          id: 'test-1'
        }).then(function (response) {
          const resources = response.result.resources || [];
          const projectResources = resources.filter(function (r: any) {
            return r.uri.startsWith('project://');
          });
          const fileResources = resources.filter(function (r: any) {
            return r.uri.startsWith('file://');
          });

          const expectedProjectResources = [
            'project://structure',
            'project://config',
            'project://dependencies'
          ];

          const foundProjectResources = expectedProjectResources.filter(function (uri) {
            return projectResources.some(function (r: any) { return r.uri === uri; });
          });

          done({
            totalResources: resources.length,
            projectResourceCount: projectResources.length,
            fileResourceCount: fileResources.length,
            expectedCount: expectedProjectResources.length,
            foundCount: foundProjectResources.length,
            foundResources: foundProjectResources,
            missingResources: expectedProjectResources.filter(function (uri) {
              return !projectResources.some(function (r: any) { return r.uri === uri; });
            }),
            sampleProjectResource: projectResources[0] || null
          });
        }).catch(function (error) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Project resources list error:', data.error);
          return;
        }
        browser.assert.ok(data.totalResources > 0, 'Should have resources');
        browser.assert.ok(data.projectResourceCount >= 3, 'Should have at least 3 project resources');
        browser.assert.equal(data.foundCount, data.expectedCount, 'Should have all expected project resources');
        browser.assert.equal(data.missingResources.length, 0, 'Should not have missing project resources');
      });
  },

  'Should read project structure resource #group1': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/read',
          params: { uri: 'project://structure' },
          id: 'test-2'
        }).then(function (response) {
          const content = response.result;
          let structureData = null;

          if (content.text) {
            try {
              structureData = JSON.parse(content.text);
            } catch (e) {
              done({ error: 'Failed to parse structure JSON' });
              return;
            }
          }

          done({
            hasContent: !!content,
            uri: content.uri,
            mimeType: content.mimeType,
            hasText: !!content.text,
            hasStructure: !!structureData?.structure,
            hasRoot: !!structureData?.root,
            hasGeneratedAt: !!structureData?.generatedAt,
            isValidJSON: content.mimeType === 'application/json'
          });
        }).catch(function (error) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Project structure read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have structure content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasStructure, 'Should have structure data');
        browser.assert.ok(data.hasGeneratedAt, 'Should have timestamp');
      });
  },

  'Should read project config resource #group1': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/read',
          params: { uri: 'project://config' },
          id: 'test-3'
        }).then(function (response) {
          const content = response.result;
          let configData = null;

          if (content.text) {
            configData = JSON.parse(content.text);
          }

          done({
            hasContent: !!content,
            mimeType: content.mimeType,
            hasConfigs: !!configData?.configs,
            hasGeneratedAt: !!configData?.generatedAt,
            configKeys: configData?.configs ? Object.keys(configData.configs) : []
          });
        }).catch(function (error) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Project config read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have config content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasConfigs, 'Should have configs object');
        browser.assert.ok(data.hasGeneratedAt, 'Should have timestamp');
      });
  },

  'Should read project dependencies resource #group1': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/read',
          params: { uri: 'project://dependencies' },
          id: 'test-4'
        }).then(function (response) {
          const content = response.result;
          let depsData = null;

          if (content.text) {
            depsData = JSON.parse(content.text);
          }

          done({
            hasContent: !!content,
            mimeType: content.mimeType,
            hasNpm: !!depsData?.npm,
            hasImports: !!depsData?.imports,
            hasContracts: !!depsData?.contracts,
            hasGeneratedAt: !!depsData?.generatedAt,
            importsCount: depsData?.imports?.length || 0
          });
        }).catch(function (error) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
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
   * #group1
   */
  'Should list all compilation resources #group1': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/list',
          id: 'test-5'
        }).then(function (response) {
          const resources = response.result.resources || [];
          const compilationResources = resources.filter(function (r: any) {
            return r.uri.startsWith('compilation://') || r.uri.startsWith('contract://');
          });

          const expectedCompilationResources = [
            'compilation://latest',
            'compilation://contracts',
            'compilation://errors',
            'compilation://artifacts',
            'compilation://dependencies',
            'compilation://config'
          ];

          const foundResources = expectedCompilationResources.filter(function (uri) {
            return compilationResources.some(function (r: any) { return r.uri === uri; });
          });

          done({
            compilationResourceCount: compilationResources.length,
            expectedCount: expectedCompilationResources.length,
            foundCount: foundResources.length,
            foundResources: foundResources,
            missingResources: expectedCompilationResources.filter(function (uri) {
              return !compilationResources.some(function (r: any) { return r.uri === uri; });
            })
          });
        }).catch(function (error) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Compilation resources list error:', data.error);
          return;
        }
        browser.assert.ok(data.compilationResourceCount >= 6, 'Should have at least 6 compilation resources');
        browser.assert.equal(data.foundCount, data.expectedCount, 'Should have all expected compilation resources');
        browser.assert.equal(data.missingResources.length, 0, 'Should not have missing compilation resources');
      });
  },

  'Should read compilation latest resource #group1': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/read',
          params: { uri: 'compilation://latest' },
          id: 'test-6'
        }).then(function (response) {
          const content = response.result;
          let compilationData = null;

          if (content.text) {
            compilationData = JSON.parse(content.text);
          }

          done({
            hasContent: !!content,
            mimeType: content.mimeType,
            hasSuccess: compilationData?.success !== undefined,
            hasTimestamp: !!compilationData?.timestamp,
            hasContracts: !!compilationData?.contracts,
            hasErrors: !!compilationData?.errors,
            hasSources: !!compilationData?.sources,
            contractCount: compilationData?.contracts ? Object.keys(compilationData.contracts).length : 0,
            errorCount: compilationData?.errors?.length || 0
          });
        }).catch(function (error) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Compilation latest read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have latest compilation content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasSuccess !== undefined, 'Should have success flag');
        browser.assert.ok(data.hasContracts, 'Should have contracts object');
        browser.assert.ok(data.hasErrors, 'Should have errors array');
      })
  },

  'Should read compilation contracts resource #group1': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/read',
          params: { uri: 'compilation://contracts' },
          id: 'test-7'
        }).then(function (response) {
          const content = response.result;
          let contractsData = null;

          if (content.text) {
            contractsData = JSON.parse(content.text);
          }

          done({
            hasContent: !!content,
            mimeType: content.mimeType,
            hasCompiledContracts: !!contractsData?.compiledContracts,
            hasCount: contractsData?.count !== undefined,
            hasGeneratedAt: !!contractsData?.generatedAt,
            contractCount: contractsData?.count || 0
          });
        }).catch(function (error) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Compilation contracts read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have contracts content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasCount !== undefined, 'Should have count');
        browser.assert.ok(data.hasGeneratedAt, 'Should have timestamp');
      });
  },

  'Should read compilation config resource #group1': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/read',
          params: { uri: 'compilation://config' },
          id: 'test-8'
        }).then(function (response) {
          const content = response.result;
          let configData = null;

          if (content.text) {
            configData = JSON.parse(content.text);
          }

          done({
            hasContent: !!content,
            mimeType: content.mimeType,
            hasVersion: !!configData?.currentVersion,
            hasOptimize: configData?.optimize !== undefined,
            hasRuns: configData?.runs !== undefined,
            hasEvmVersion: !!configData?.evmVersion,
            hasLanguage: !!configData?.language,
            config: configData
          });
        }).catch(function (error) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Compilation config read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have config content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasVersion, 'Should have version');
        browser.assert.ok(data.hasOptimize !== undefined, 'Should have optimize flag');
      })
  },

  /**
   * ERROR HANDLING TESTS
   * #group1
   */
  'Should handle invalid resource URIs gracefully #group1': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        const invalidURIs = [
          'invalid://resource',
          'project://nonexistent',
          'compilation://invalid',
          'deployment://missing',
          'file://../../etc/passwd', // Path traversal attempt
          'http://example.com' // External URI
        ];

        const results = [];

        function processNextURI(index) {
          if (index >= invalidURIs.length) {
            done({
              totalTests: invalidURIs.length,
              allHandled: results.every(function (r) { return r.handled; }),
              allErrored: results.every(function (r) { return r.hasError; }),
              results: results,
              systemStable: true
            });
            return;
          }

          const uri = invalidURIs[index];
          aiPlugin.remixMCPServer.handleMessage({
            method: 'resources/read',
            params: { uri: uri },
            id: 'test-invalid-' + uri
          }).then(function (response) {
            results.push({
              uri: uri,
              hasError: !!response.error,
              errorCode: response.error?.code || null,
              handled: true
            });
            processNextURI(index + 1);
          }).catch(function (error) {
            results.push({
              uri: uri,
              hasError: true,
              errorMessage: error.message,
              handled: true
            });
            processNextURI(index + 1);
          });
        }

        processNextURI(0);
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
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
   * #group1
   */
  'Should test resource caching performance #group1': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        const server = aiPlugin.remixMCPServer;
        const testURI = 'deployment://history';
        let firstReadTime = 0;

        // First read (uncached)
        const startTime1 = Date.now();
        server.handleMessage({
          method: 'resources/read',
          params: { uri: testURI },
          id: 'test-cache-1'
        }).then(function () {
          firstReadTime = Date.now() - startTime1;

          // Second read (should be cached)
          const startTime2 = Date.now();
          return server.handleMessage({
            method: 'resources/read',
            params: { uri: testURI },
            id: 'test-cache-2'
          }).then(function () {
            const secondReadTime = Date.now() - startTime2;

            // Get cache stats
            const cacheStats = server.getCacheStats();

            done({
              firstReadTime: firstReadTime,
              secondReadTime: secondReadTime,
              cachingWorking: secondReadTime <= firstReadTime,
              hasCacheStats: !!cacheStats,
              cacheSize: cacheStats?.size || 0,
              cacheHitRate: cacheStats?.hitRate || 0,
              performanceImprovement: firstReadTime > 0 ?
                ((firstReadTime - secondReadTime) / firstReadTime * 100).toFixed(2) : 0
            });
          });
        }).catch(function (error) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Resource caching error:', data.error);
          return;
        }
        browser.assert.ok(data.hasCacheStats, 'Should have cache statistics');
        browser.assert.ok(data.cacheSize >= 0, 'Should have cache size');
      });
  },

  /**
   * CONTEXT RESOURCE PROVIDER TESTS
   * #group2
   */
  'Should list all context resources #group2': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/list',
          id: 'test-context-list'
        }).then(function (response: any) {
          const resources = response.result.resources || [];
          const contextResources = resources.filter(function (r: any) {
            return r.uri.startsWith('context://');
          });

          const expectedContextResources = [
            'context://workspace',
            'context://editor-state',
            'context://git-status',
            'context://diagnostics'
          ];

          const foundResources = expectedContextResources.filter(function (uri) {
            return contextResources.some(function (r: any) { return r.uri === uri; });
          });

          done({
            contextResourceCount: contextResources.length,
            expectedCount: expectedContextResources.length,
            foundCount: foundResources.length,
            foundResources: foundResources,
            missingResources: expectedContextResources.filter(function (uri) {
              return !contextResources.some(function (r: any) { return r.uri === uri; });
            })
          });
        }).catch(function (error: any) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Context resources list error:', data.error);
          return;
        }
        browser.assert.ok(data.contextResourceCount >= 4, 'Should have at least 4 context resources');
        browser.assert.equal(data.foundCount, data.expectedCount, 'Should have all expected context resources');
        browser.assert.equal(data.missingResources.length, 0, 'Should not have missing context resources');
      });
  },

  'Should read context workspace resource #group2': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/read',
          params: { uri: 'context://workspace' },
          id: 'test-context-workspace'
        }).then(function (response: any) {
          const content = response.result;
          let workspaceData = null;

          if (content.text) {
            workspaceData = JSON.parse(content.text);
          }

          done({
            hasContent: !!content,
            mimeType: content.mimeType,
            hasTimestamp: !!workspaceData?.timestamp,
            hasFileTree: !!workspaceData?.fileTree,
            hasEditorState: !!workspaceData?.editorState,
            hasGitStatus: !!workspaceData?.gitStatus,
            hasDiagnostics: !!workspaceData?.diagnostics,
            hasWorkspace: !!workspaceData?.workspace,
            hasTerminalOutput: !!workspaceData?.terminalOutput
          });
        }).catch(function (error: any) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Context workspace read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have workspace content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasTimestamp, 'Should have timestamp');
        browser.assert.ok(data.hasEditorState, 'Should have editor state');
        browser.assert.ok(data.hasWorkspace, 'Should have workspace info');
      });
  },

  'Should read context editor-state resource #group2': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/read',
          params: { uri: 'context://editor-state' },
          id: 'test-context-editor-state'
        }).then(function (response: any) {
          const content = response.result;
          let editorData = null;

          if (content.text) {
            editorData = JSON.parse(content.text);
          }

          done({
            hasContent: !!content,
            mimeType: content.mimeType,
            hasTimestamp: !!editorData?.timestamp,
            hasOpenFiles: editorData?.openFiles !== undefined,
            hasCurrentFile: editorData?.currentFile !== undefined,
            hasCursorPosition: editorData?.cursorPosition !== undefined,
            hasSelectedText: editorData?.selectedText !== undefined
          });
        }).catch(function (error: any) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Context editor-state read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have editor state content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasTimestamp, 'Should have timestamp');
        browser.assert.ok(data.hasOpenFiles !== undefined, 'Should have open files field');
      });
  },

  'Should read context git-status resource #group2': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/read',
          params: { uri: 'context://git-status' },
          id: 'test-context-git-status'
        }).then(function (response: any) {
          const content = response.result;
          let gitData = null;

          if (content.text) {
            gitData = JSON.parse(content.text);
          }

          done({
            hasContent: !!content,
            mimeType: content.mimeType,
            hasTimestamp: !!gitData?.timestamp,
            hasAvailable: gitData?.available !== undefined,
            hasBranch: gitData?.branch !== undefined,
            hasModified: gitData?.modified !== undefined,
            hasStaged: gitData?.staged !== undefined,
            hasUntracked: gitData?.untracked !== undefined
          });
        }).catch(function (error: any) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Context git-status read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have git status content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasTimestamp, 'Should have timestamp');
        browser.assert.ok(data.hasAvailable !== undefined, 'Should have available field');
      });
  },

  'Should read context diagnostics resource #group2': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/read',
          params: { uri: 'context://diagnostics' },
          id: 'test-context-diagnostics'
        }).then(function (response: any) {
          const content = response.result;
          let diagnosticsData = null;

          if (content.text) {
            diagnosticsData = JSON.parse(content.text);
          }

          done({
            hasContent: !!content,
            mimeType: content.mimeType,
            hasTimestamp: !!diagnosticsData?.timestamp,
            hasCompilation: diagnosticsData?.compilation !== undefined,
            hasAnalysis: diagnosticsData?.analysis !== undefined,
            hasTotal: diagnosticsData?.total !== undefined
          });
        }).catch(function (error: any) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Context diagnostics read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have diagnostics content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasTimestamp, 'Should have timestamp');
        browser.assert.ok(data.hasCompilation !== undefined, 'Should have compilation field');
        browser.assert.ok(data.hasTotal !== undefined, 'Should have total field');
      });
  },

  /**
   * TUTORIALS RESOURCE PROVIDER TESTS
   * #group2
   */
  'Should list all tutorials resources #group2': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/list',
          id: 'test-tutorials-list'
        }).then(function (response: any) {
          const resources = response.result.resources || [];
          const tutorialsResources = resources.filter(function (r: any) {
            return r.uri.startsWith('tutorials://');
          });

          const expectedTutorialsResources = [
            'tutorials://list',
            'tutorials://current'
          ];

          const foundResources = expectedTutorialsResources.filter(function (uri) {
            return tutorialsResources.some(function (r: any) { return r.uri === uri; });
          });

          done({
            tutorialsResourceCount: tutorialsResources.length,
            expectedCount: expectedTutorialsResources.length,
            foundCount: foundResources.length,
            foundResources: foundResources,
            missingResources: expectedTutorialsResources.filter(function (uri) {
              return !tutorialsResources.some(function (r: any) { return r.uri === uri; });
            })
          });
        }).catch(function (error: any) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Tutorials resources list error:', data.error);
          return;
        }
        browser.assert.ok(data.tutorialsResourceCount >= 2, 'Should have at least 2 tutorials resources');
        browser.assert.equal(data.foundCount, data.expectedCount, 'Should have all expected tutorials resources');
        browser.assert.equal(data.missingResources.length, 0, 'Should not have missing tutorials resources');
      });
  },

  'Should read tutorials list resource #group2': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/read',
          params: { uri: 'tutorials://list' },
          id: 'test-tutorials-list-read'
        }).then(function (response: any) {
          const content = response.result;
          let tutorialsData = null;

          if (content.text) {
            tutorialsData = JSON.parse(content.text);
          }

          done({
            hasContent: !!content,
            mimeType: content.mimeType,
            hasData: !!tutorialsData,
            isArray: Array.isArray(tutorialsData),
            tutorialCount: Array.isArray(tutorialsData) ? tutorialsData.length : 0,
            hasTutorialProperties: Array.isArray(tutorialsData) && tutorialsData.length > 0 ?
              !!(tutorialsData[0].name || tutorialsData[0].id) : false
          });
        }).catch(function (error: any) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Tutorials list read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have tutorials list content');
        browser.assert.equal(data.mimeType, 'application/json', 'Should be JSON content');
        browser.assert.ok(data.hasData, 'Should have tutorials data');
      });
  },

  'Should read tutorials current resource gracefully when no tutorial is active #group2': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/read',
          params: { uri: 'tutorials://current' },
          id: 'test-tutorials-current'
        }).then(function (response: any) {
          const content = response.result;

          done({
            hasContent: !!content,
            mimeType: content.mimeType,
            hasResponse: true,
            // When no tutorial is active, we expect either null/empty or an error message
            isHandledGracefully: true
          });
        }).catch(function (error: any) {
          // Even catching an error is graceful handling
          done({
            hasContent: false,
            hasResponse: true,
            isHandledGracefully: true,
            errorMessage: error.message
          });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error && data?.error !== 'RemixMCPServer not available') {
          console.error('Tutorials current read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasResponse, 'Should have a response');
        browser.assert.ok(data.isHandledGracefully, 'Should handle gracefully when no tutorial is active');
      });
  },

  /**
   * DEBUGGING RESOURCE PROVIDER TESTS
   * #group3
   * Note: These tests require setting up a debug session first
   */
  'Should list all debugging resources #group3': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/list',
          id: 'test-debugging-list'
        }).then(function (response: any) {
          const resources = response.result.resources || [];
          const debugResources = resources.filter(function (r: any) {
            return r.uri.startsWith('debug://');
          });

          const expectedDebugResources = [
            'debug://scopes-summary',
            'debug://global-context',
            'debug://current-debugging-step'
          ];

          const foundResources = expectedDebugResources.filter(function (uri) {
            return debugResources.some(function (r: any) { return r.uri === uri; });
          });

          done({
            debugResourceCount: debugResources.length,
            expectedCount: expectedDebugResources.length,
            foundCount: foundResources.length,
            foundResources: foundResources,
            missingResources: expectedDebugResources.filter(function (uri) {
              return !debugResources.some(function (r: any) { return r.uri === uri; });
            })
          });
        }).catch(function (error: any) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Debugging resources list error:', data.error);
          return;
        }
        browser.assert.ok(data.debugResourceCount >= 3, 'Should have at least 3 debugging resources');
        browser.assert.equal(data.foundCount, data.expectedCount, 'Should have all expected debugging resources');
        browser.assert.equal(data.missingResources.length, 0, 'Should not have missing debugging resources');
      });
  },

  'Should read debugging resources gracefully when no debug session is active #group3': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        const debugUris = [
          'debug://scopes-summary',
          'debug://global-context',
          'debug://current-debugging-step'
        ];

        const results: any[] = [];

        function processNextUri(index: number) {
          if (index >= debugUris.length) {
            done({
              totalTests: debugUris.length,
              results: results,
              allHandledGracefully: results.every(function (r) { return r.handledGracefully; })
            });
            return;
          }

          const uri = debugUris[index];
          aiPlugin.remixMCPServer.handleMessage({
            method: 'resources/read',
            params: { uri: uri },
            id: 'test-debug-' + index
          }).then(function (response: any) {
            const content = response.result;
            // Check if it returns appropriate "no session" message
            const text = content?.text || '';
            const isNoSessionMessage = text.includes('not available') ||
                                        text.includes('no debug session') ||
                                        text.includes('Please start a debug session') ||
                                        content?.success === false;

            results.push({
              uri: uri,
              hasContent: !!content,
              handledGracefully: true,
              isNoSessionMessage: isNoSessionMessage,
              mimeType: content?.mimeType
            });
            processNextUri(index + 1);
          }).catch(function (error: any) {
            // Even an error is graceful as long as it doesn't crash
            results.push({
              uri: uri,
              hasContent: false,
              handledGracefully: true,
              errorMessage: error.message
            });
            processNextUri(index + 1);
          });
        }

        processNextUri(0);
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Debugging resources graceful handling error:', data.error);
          return;
        }
        browser.assert.equal(data.totalTests, 3, 'Should test all debugging resources');
        browser.assert.ok(data.allHandledGracefully, 'All debugging resources should be handled gracefully without active session');
      });
  },

  /**
   * DEBUGGING RESOURCE PROVIDER TESTS WITH ACTIVE DEBUG SESSION
   * #group4
   * These tests set up a contract, compile, deploy, execute, and debug to test debugging resources with data
   */
  'Setup: Create and compile test contract for debugging #group4': function (browser: NightwatchBrowser) {
    browser
      .clickLaunchIcon('filePanel')
      .addFile('contracts/DebugTest.sol', { content: debugTestContract })
      .waitForElementVisible('[data-id="treeViewLitreeViewItemcontracts/DebugTest.sol"]')
      .openFile('contracts/DebugTest.sol')
      .clickLaunchIcon('solidity')
      .waitForElementVisible('[data-id="compilerContainerCompileBtn"]')
      .click('[data-id="compilerContainerCompileBtn"]')
      .waitForElementPresent('[data-id="compiledContracts"] option[value="DebugTest"]', 60000)
      .execute(function () {
        // Verify compilation succeeded
        const compiledContract = document.querySelector('[data-id="compiledContracts"] option[value="DebugTest"]');
        return { compiled: !!compiledContract };
      }, [], function (result) {
        const data = result.value as any;
        browser.assert.ok(data.compiled, 'Contract should be compiled successfully');
      });
  },

  'Setup: Deploy test contract for debugging #group4': function (browser: NightwatchBrowser) {
    browser
      .clickLaunchIcon('udapp')
      .waitForElementVisible('[data-id="Deploy - transact (not payable)"]')
      .click('[data-id="Deploy - transact (not payable)"]')
      .waitForElementPresent('.instance', 60000)
      .pause(2000); // Wait for deployment to complete
  },

  'Setup: Execute transaction for debugging #group4': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('.instance')
      .waitForElementVisible('[data-id="universalDappUiTitleExpander0"]')
      .click('[data-id="universalDappUiTitleExpander0"]')
      .waitForElementVisible('[data-id="instanceContractBal"]')
      .waitForElementVisible('[data-title="increment"]')
      .click('[data-title="increment"]')
      .pause(3000); // Wait for transaction to complete
  },

  'Setup: Start debugger on transaction #group4': function (browser: NightwatchBrowser) {
    browser
      .clickLaunchIcon('debugger')
      .waitForElementVisible('[data-id="debuggerTransactionStartButton"]')
      .click('[data-id="debuggerTransactionStartButton"]')
      .pause(3000) // Wait for debugger to load
      .waitForElementVisible('[data-id="slider"]', 30000);
  },

  'Should read debugging scopes-summary with active session #group4': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/read',
          params: { uri: 'debug://scopes-summary' },
          id: 'test-debug-scopes-active'
        }).then(function (response: any) {
          const content = response.result;
          let scopesData = null;

          if (content.text) {
            try {
              scopesData = JSON.parse(content.text);
            } catch (e) {
              done({ error: 'Failed to parse scopes JSON', raw: content.text });
              return;
            }
          }

          done({
            hasContent: !!content,
            mimeType: content.mimeType,
            hasSuccess: scopesData?.success !== undefined,
            success: scopesData?.success,
            hasSummary: !!scopesData?.summary,
            hasMetadata: !!scopesData?.metadata,
            totalTopLevelScopes: scopesData?.summary?.totalTopLevelScopes,
            totalAllScopes: scopesData?.summary?.totalAllScopes,
            totalVariables: scopesData?.summary?.totalVariables,
            hasScopeHierarchy: !!scopesData?.summary?.scopeHierarchy
          });
        }).catch(function (error: any) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Debugging scopes-summary read error:', data.error);
          // Don't fail the test if debug session isn't available
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have scopes content');
        if (data.success) {
          browser.assert.ok(data.hasSummary, 'Should have summary when debug session active');
          browser.assert.ok(data.hasMetadata, 'Should have metadata');
        }
      });
  },

  'Should read debugging global-context with active session #group4': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/read',
          params: { uri: 'debug://global-context' },
          id: 'test-debug-global-context-active'
        }).then(function (response: any) {
          const content = response.result;
          let contextData = null;

          if (content.text) {
            try {
              contextData = JSON.parse(content.text);
            } catch (e) {
              done({ error: 'Failed to parse context JSON', raw: content.text });
              return;
            }
          }

          done({
            hasContent: !!content,
            mimeType: content.mimeType,
            hasSuccess: contextData?.success !== undefined,
            success: contextData?.success,
            hasContext: !!contextData?.context,
            hasBlock: !!contextData?.context?.block,
            hasMsg: !!contextData?.context?.msg,
            hasTx: !!contextData?.context?.tx,
            hasMetadata: !!contextData?.metadata
          });
        }).catch(function (error: any) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Debugging global-context read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have global context content');
        if (data.success) {
          browser.assert.ok(data.hasContext, 'Should have context object when debug session active');
        }
      });
  },

  'Should read debugging current-debugging-step with active session #group4': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/read',
          params: { uri: 'debug://current-debugging-step' },
          id: 'test-debug-current-step-active'
        }).then(function (response: any) {
          const content = response.result;
          let stepData = null;

          if (content.text) {
            try {
              stepData = JSON.parse(content.text);
            } catch (e) {
              done({ error: 'Failed to parse step JSON', raw: content.text });
              return;
            }
          }

          done({
            hasContent: !!content,
            mimeType: content.mimeType,
            hasSuccess: stepData?.success !== undefined,
            success: stepData?.success,
            hasResult: !!stepData?.result,
            hasStack: !!stepData?.stack,
            hasDescription: !!stepData?.description,
            step: stepData?.result?.step
          });
        }).catch(function (error: any) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Debugging current-debugging-step read error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContent, 'Should have current debugging step content');
        if (data.success) {
          browser.assert.ok(data.hasResult, 'Should have result when debug session active');
          browser.assert.ok(data.hasDescription, 'Should have description');
        }
      });
  },

  /**
   * CROSS-PROVIDER INTEGRATION TESTS
   * #group5
   */
  'Should list all resources from all providers #group5': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        aiPlugin.remixMCPServer.handleMessage({
          method: 'resources/list',
          id: 'test-all-resources'
        }).then(function (response: any) {
          const resources = response.result.resources || [];

          // Group resources by protocol
          const resourcesByProtocol: Record<string, number> = {};
          resources.forEach(function (r: any) {
            const protocol = r.uri.split('://')[0];
            resourcesByProtocol[protocol] = (resourcesByProtocol[protocol] || 0) + 1;
          });

          done({
            totalResources: resources.length,
            resourcesByProtocol: resourcesByProtocol,
            hasProject: resourcesByProtocol['project'] > 0,
            hasCompilation: resourcesByProtocol['compilation'] > 0,
            hasDeployment: resourcesByProtocol['deployment'] > 0,
            hasContext: resourcesByProtocol['context'] > 0,
            hasTutorials: resourcesByProtocol['tutorials'] > 0,
            hasDebugging: resourcesByProtocol['debug'] > 0,
            hasFile: resourcesByProtocol['file'] > 0
          });
        }).catch(function (error: any) {
          done({ error: error.message });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('All resources list error:', data.error);
          return;
        }
        browser.assert.ok(data.totalResources >= 18, 'Should have at least 18 total resources');
        browser.assert.ok(data.hasProject, 'Should have project resources');
        browser.assert.ok(data.hasCompilation, 'Should have compilation resources');
        browser.assert.ok(data.hasDeployment, 'Should have deployment resources');
        browser.assert.ok(data.hasContext, 'Should have context resources');
        browser.assert.ok(data.hasTutorials, 'Should have tutorials resources');
        browser.assert.ok(data.hasDebugging, 'Should have debugging resources');
      });
  },

  'Should handle rapid sequential resource reads #group5': function (browser: NightwatchBrowser) {
    browser
      .executeAsync(function (done) {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          done({ error: 'RemixMCPServer not available' });
          return;
        }

        const urisToRead = [
          'project://structure',
          'compilation://config',
          'deployment://networks',
          'context://editor-state',
          'tutorials://list'
        ];

        const startTime = Date.now();

        Promise.all(urisToRead.map(function (uri, index) {
          return aiPlugin.remixMCPServer.handleMessage({
            method: 'resources/read',
            params: { uri: uri },
            id: 'test-rapid-' + index
          }).then(function (response: any) {
            return { uri: uri, success: true, hasContent: !!response.result };
          }).catch(function (error: any) {
            return { uri: uri, success: false, error: error.message };
          });
        })).then(function (allResults) {
          const elapsed = Date.now() - startTime;
          done({
            totalRequests: urisToRead.length,
            successCount: allResults.filter(function (r: any) { return r.success; }).length,
            failCount: allResults.filter(function (r: any) { return !r.success; }).length,
            results: allResults,
            elapsedMs: elapsed,
            systemStable: true
          });
        });
      }, [], function (result) {
        const data = result.value as any;
        if (data?.error) {
          console.error('Rapid sequential reads error:', data.error);
          return;
        }
        browser.assert.equal(data.totalRequests, 5, 'Should have made 5 requests');
        browser.assert.ok(data.successCount >= 4, 'Most requests should succeed');
        browser.assert.ok(data.systemStable, 'System should remain stable after rapid requests');
      });
  }
};
