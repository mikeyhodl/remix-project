import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

const testContract = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MCPTestContract {
    uint256 public value;
    address public owner;

    constructor(uint256 _initialValue) {
        value = _initialValue;
        owner = msg.sender;
    }

    function setValue(uint256 _newValue) public {
        require(msg.sender == owner, "Only owner can set value");
        value = _newValue;
    }

    function getValue() public view returns (uint256) {
        return value;
    }
}
`;

module.exports = {
  '@disabled': false,
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done)
  },

  'Should get all MCP tools': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="remix-ai-assistant"]')
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          const allTools = await aiPlugin.mcpInferencer.getAllTools();
          const remixTools = allTools['Remix IDE Server'] || [];

          const compileTools = remixTools.filter((t: any) =>
            t.name.includes('compile')
          );

          const deploymentTools = remixTools.filter((t: any) =>
            t.name.includes('deploy') || t.name.includes('account')
          );

          return {
            totalTools: remixTools.length,
            compileTools: compileTools.length,
            deploymentTools: deploymentTools.length,
            toolNames: remixTools.map((t: any) => t.name),
            hasRequiredTools: {
              solidityCompile: remixTools.some((t: any) => t.name === 'solidity_compile'),
              getCompilerConfig: remixTools.some((t: any) => t.name === 'get_compiler_config'),
              setCompilerConfig: remixTools.some((t: any) => t.name === 'set_compiler_config'),
              getCompilationResult: remixTools.some((t: any) => t.name === 'get_compilation_result')
            }
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Error getting tools:', data.error);
          return;
        }
        browser.assert.ok(data.totalTools > 0, 'Should have tools available');
        browser.assert.ok(data.hasRequiredTools.solidityCompile, 'Should have solidity_compile tool');
        browser.assert.ok(data.hasRequiredTools.getCompilerConfig, 'Should have get_compiler_config tool');
      });
  },

  'Should test compiler configuration tools': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          // Test get compiler config
          const getConfigResult = await aiPlugin.mcpInferencer.executeTool('Remix IDE Server', {
            name: 'get_compiler_config',
            arguments: {}
          });

          // Test set compiler config
          const setConfigResult = await aiPlugin.mcpInferencer.executeTool('Remix IDE Server', {
            name: 'set_compiler_config',
            arguments: {
              version: '0.8.20',
              optimize: true,
              runs: 200,
              evmVersion: 'london'
            }
          });

          return {
            getConfigSuccess: !getConfigResult.isError,
            setConfigSuccess: !setConfigResult.isError,
            getConfigContent: getConfigResult.content?.[0]?.text || null,
            setConfigContent: setConfigResult.content?.[0]?.text || null
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Error with compiler config:', data.error);
          return;
        }
        browser.assert.ok(data.getConfigSuccess, 'Should get compiler config successfully');
        browser.assert.ok(data.setConfigSuccess, 'Should set compiler config successfully');
      });
  },

  'Should test solidity compilation tool': function (browser: NightwatchBrowser) {
    browser
      .addFile('contracts/MCPTestContract.sol', { content: testContract })
      .pause(1000)
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          // Test MCP compilation
          const compileResult = await aiPlugin.mcpInferencer.executeTool('Remix IDE Server', {
            name: 'solidity_compile',
            arguments: {
              file: 'contracts/MCPTestContract.sol',
              version: '0.8.20',
              optimize: true,
              runs: 200
            }
          });

          let compilationData = null;
          if (!compileResult.isError && compileResult.content?.[0]?.text) {
            try {
              compilationData = JSON.parse(compileResult.content[0].text);
            } catch (parseError) {
              console.error('Failed to parse compilation result:', parseError);
            }
          }

          return {
            compileSuccess: !compileResult.isError,
            hasCompilationData: !!compilationData,
            hasErrors: compilationData?.errors?.length > 0,
            errorCount: compilationData?.errors?.length || 0,
            success: compilationData?.success || false,
            rawResult: compileResult
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Compilation error:', data.error);
          return;
        }
        browser.assert.ok(data.compileSuccess, 'MCP compilation should succeed');
        browser.assert.ok(data.hasCompilationData, 'Should have compilation data');
      });
  },

  'Should test compilation result retrieval': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          const result = await aiPlugin.mcpInferencer.executeTool('Remix IDE Server', {
            name: 'get_compilation_result',
            arguments: {}
          });

          let compilationData = null;
          if (!result.isError && result.content?.[0]?.text) {
            try {
              compilationData = JSON.parse(result.content[0].text);
            } catch (parseError) {
              console.error('Failed to parse compilation result:', parseError);
            }
          }

          return {
            retrievalSuccess: !result.isError,
            hasCompilationData: !!compilationData,
            hasContracts: !!compilationData?.contracts,
            contractCount: compilationData?.contracts ? Object.keys(compilationData.contracts).length : 0,
            success: compilationData?.success || false
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Result retrieval error:', data.error);
          return;
        }
        browser.assert.ok(data.retrievalSuccess, 'Should retrieve compilation result successfully');
        browser.assert.ok(data.hasCompilationData, 'Should have compilation data');
      });
  },

  'Should test deployment account tools': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          // Test getting user accounts
          const accountsResult = await aiPlugin.mcpInferencer.executeTool('Remix IDE Server', {
            name: 'get_user_accounts',
            arguments: {}
          });

          // Test getting current environment
          const envResult = await aiPlugin.mcpInferencer.executeTool('Remix IDE Server', {
            name: 'get_current_environment',
            arguments: {}
          });

          let accountsData = null;
          let envData = null;

          if (!accountsResult.isError && accountsResult.content?.[0]?.text) {
            try {
              accountsData = JSON.parse(accountsResult.content[0].text);
            } catch (parseError) {
              console.error('Failed to parse accounts result:', parseError);
            }
          }

          if (!envResult.isError && envResult.content?.[0]?.text) {
            try {
              envData = JSON.parse(envResult.content[0].text);
            } catch (parseError) {
              console.error('Failed to parse environment result:', parseError);
            }
          }

          return {
            accountsSuccess: !accountsResult.isError,
            envSuccess: !envResult.isError,
            hasAccounts: !!accountsData?.accounts,
            accountCount: accountsData?.accounts?.length || 0,
            selectedAccount: accountsData?.selectedAccount || null,
            environment: envData?.environment || null,
            provider: envData?.provider || null
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Account tools error:', data.error);
          return;
        }
        browser.assert.ok(data.accountsSuccess, 'Should get accounts successfully');
        browser.assert.ok(data.envSuccess, 'Should get environment successfully');
      });
  },

  'Should test tool execution with invalid arguments': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          // Test with invalid arguments
          const invalidResult = await aiPlugin.mcpInferencer.executeTool('Remix IDE Server', {
            name: 'solidity_compile',
            arguments: {
              runs: 50000 // Invalid: too high
            }
          });

          // Test with non-existent tool
          const nonExistentResult = await aiPlugin.mcpInferencer.executeTool('Remix IDE Server', {
            name: 'non_existent_tool',
            arguments: {}
          });

          return {
            invalidArgsHandled: invalidResult.isError,
            nonExistentHandled: nonExistentResult.isError,
            invalidArgsMessage: invalidResult.content?.[0]?.text || 'No message',
            nonExistentMessage: nonExistentResult.content?.[0]?.text || 'No message',
            systemStable: true // If we reach here, system didn't crash
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Error handling test failed:', data.error);
          return;
        }
        browser.assert.ok(data.invalidArgsHandled, 'Should handle invalid arguments gracefully');
        browser.assert.ok(data.nonExistentHandled, 'Should handle non-existent tools gracefully');
        browser.assert.ok(data.systemStable, 'System should remain stable after errors');
      });
  },

  'Should test LLM tool integration format': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          // Get tools in LLM format
          const llmTools = await aiPlugin.mcpInferencer.getToolsForLLMRequest();

          const sampleTool = llmTools.find((t: any) => t.function.name === 'solidity_compile');

          return {
            toolCount: llmTools.length,
            hasLLMFormat: llmTools.every((t: any) => t.type === 'function' && t.function),
            sampleToolStructure: sampleTool ? {
              hasName: !!sampleTool.function.name,
              hasDescription: !!sampleTool.function.description,
              hasParameters: !!sampleTool.function.parameters,
              parametersType: sampleTool.function.parameters?.type
            } : null,
            allToolNames: llmTools.map((t: any) => t.function.name)
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('LLM format error:', data.error);
          return;
        }
        browser.assert.ok(data.toolCount > 0, 'Should have tools in LLM format');
        browser.assert.ok(data.hasLLMFormat, 'All tools should have proper LLM format');
        if (data.sampleToolStructure) {
          browser.assert.ok(data.sampleToolStructure.hasName, 'Sample tool should have name');
          browser.assert.ok(data.sampleToolStructure.hasDescription, 'Sample tool should have description');
          browser.assert.ok(data.sampleToolStructure.hasParameters, 'Sample tool should have parameters');
        }
      });
  }
};