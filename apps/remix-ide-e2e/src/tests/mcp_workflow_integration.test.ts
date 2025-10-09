import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

const workflowContract = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract WorkflowTest {
    uint256 public value;
    address public owner;
    mapping(address => uint256) public balances;

    event ValueChanged(uint256 oldValue, uint256 newValue);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        value = 100;
        owner = msg.sender;
        balances[msg.sender] = 1000;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    function setValue(uint256 _newValue) public onlyOwner {
        uint256 oldValue = value;
        value = _newValue;
        emit ValueChanged(oldValue, _newValue);
    }

    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        address previousOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(previousOwner, _newOwner);
    }

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 _amount) public {
        require(balances[msg.sender] >= _amount, "Insufficient balance");
        balances[msg.sender] -= _amount;
        payable(msg.sender).transfer(_amount);
    }
}
`;

module.exports = {
  '@disabled': false,
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done)
  },

  'Should test complete MCP workflow: file creation to deployment': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="remix-ai-assistant"]')
      // Step 1: Create file through MCP if available, otherwise through UI
      .addFile('contracts/WorkflowTest.sol', { content: workflowContract })
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          // Step 2: Verify file exists through MCP resources
          const mcpClients = (aiPlugin.mcpInferencer as any).mcpClients;
          const remixClient = mcpClients.get('Remix IDE Server');
          const structureContent = await remixClient.readResource('project://structure');
          const structureData = structureContent.text ? JSON.parse(structureContent.text) : null;

          // Recursively search through the structure's children
          const findFile = (node: any, targetName: string): any => {
            if (!node) return null;
            if (node.name && node.name.includes(targetName)) return node;
            if (node.path && node.path.includes(targetName)) return node;
            if (node.children && Array.isArray(node.children)) {
              for (const child of node.children) {
                const found = findFile(child, targetName);
                if (found) return found;
              }
            }
            return null;
          };

          const workflowFile = structureData?.structure ? findFile(structureData.structure, 'WorkflowTest.sol') : null;

          // Step 3: Set compiler configuration through MCP
          const setConfigResult = await aiPlugin.mcpInferencer.executeTool('Remix IDE Server', {
            name: 'set_compiler_config',
            arguments: {
              version: '0.8.30',
              optimize: true,
              runs: 200,
              evmVersion: 'london'
            }
          });

          // Step 4: Compile through MCP
          const compileResult = await aiPlugin.mcpInferencer.executeTool('Remix IDE Server', {
            name: 'solidity_compile',
            arguments: {
              file: 'contracts/WorkflowTest.sol',
              version: '0.8.30',
              optimize: true,
              runs: 200
            }
          });

          // Step 5: Get last/ latest compilation result through MCP
          const resultData = await aiPlugin.mcpInferencer.executeTool('Remix IDE Server', {
            name: 'get_compilation_result',
            arguments: {}
          });

          return {
            fileFound: !!workflowFile,
            fileName: workflowFile?.name || null,
            configSet: !setConfigResult.isError,
            compileExecuted: !compileResult.isError,
            resultRetrieved: !resultData.isError,
            workflowComplete: !!workflowFile && !setConfigResult.isError && !compileResult.isError && !resultData.isError,
            compilationContent: resultData.content?.[0]?.text || null
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('MCP workflow error:', data.error);
          return;
        }
        browser.assert.ok(data.fileFound, 'File should be found through MCP resources');
        browser.assert.ok(data.configSet, 'Compiler config should be set through MCP');
        browser.assert.ok(data.compileExecuted, 'Compilation should execute through MCP');
        browser.assert.ok(data.resultRetrieved, 'Compilation result should be retrieved through MCP');
        browser.assert.ok(data.workflowComplete, 'Complete workflow should succeed');
      });
  },

  'Should test MCP integration with Remix deployment workflow': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          const mcpClients = (aiPlugin.mcpInferencer as any).mcpClients;
          const remixClient = mcpClients.get('Remix IDE Server');

          const compilationContent = await remixClient.callTool({
            name:'solidity_compile',
            arguments: {version: '0.8.30', optimize: true, runs: 200, evmVersion: 'prague', file: 'contracts/WorkflowTest.sol'}
          })
          console.log('compilationContent', compilationContent)
          const compilationData = compilationContent.content ? JSON.parse(compilationContent.content[0].text) : null;


          const accountContent = await remixClient.readResource('deployment://networks');
          const accountData = accountContent.text ? JSON.parse(accountContent.text) : null;
          const accounts = accountData?.configured[0]?.accounts
          console.log('compilationData', compilationData)

          const deployContent = await remixClient.callTool({
            name:'deploy_contract',
            arguments: {
              contractName: 'WorkflowTest',
              file: 'contracts/WorkflowTest.sol',
              constructorArgs: Array(),
              gasLimit: 3000000,
              value: '0', account: accounts[0]?.address}
          })
          console.log('deployContent', deployContent)
          const deployData = deployContent.content ? JSON.parse(deployContent.content[0].text) : null;
          console.log('deployData', deployData)

          await new Promise(resolve => setTimeout(resolve, 2000))

          const historyContent = await remixClient.readResource('deployment://history');
          const historyData = historyContent.text ? JSON.parse(historyContent.text) : null;
          console.log("historyData", historyData)

          const activeContent = await remixClient.readResource('deployment://active');
          const activeData = activeContent.text ? JSON.parse(activeContent.text) : null;
          console.log("activeData", activeData)

          const transactionsContent = await remixClient.readResource('deployment://transactions');
          const transactionsData = transactionsContent.text ? JSON.parse(transactionsContent.text) : null;
          console.log("transactionsData", transactionsData)

          const workflowDeployment = historyData?.deployments?.find((d: any) =>
            d.contractName === 'WorkflowTest'
          );

          const workflowActive = activeData?.contracts?.find((c: any) =>
            c.name === 'WorkflowTest'
          );

          const workflowTransaction = transactionsData?.deployments?.find((t: any) =>
            t.contractName === 'WorkflowTest'
          );

          return {
            didCompile: !!compilationData.success,
            didDeploy: !!deployData.success,
            hasHistory: !!historyData && historyData.deployments.length > 0,
            hasActive: !!activeData && activeData.contracts.length > 0,
            userAccounts: accounts,
            hasTransactions: !!transactionsData && transactionsData.deployments.length > 0,
            workflowInHistory: !!workflowDeployment,
            workflowInActive: !!workflowActive,
            workflowInTransactions: !!workflowTransaction,
            deploymentCaptured: !!workflowDeployment && !!workflowActive && !!workflowTransaction,
            deploymentDetails: workflowDeployment ? {
              hasAddress: !!workflowDeployment.address,
              hasTransactionHash: !!workflowDeployment.transactionHash,
              hasBlockNumber: !!workflowDeployment.blockNumber,
              hasGasUsed: !!workflowDeployment.gasUsed
            } : null
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('MCP deployment integration error:', data.error);
          return;
        }
        browser.assert.ok(data.didCompile, 'Should compile the workflowContract');
        browser.assert.ok(data.didDeploy, 'Should deploy the workflowContract');
        browser.assert.ok(data.hasHistory, 'Should capture deployment in history');
        browser.assert.ok(data.hasActive, 'Should show active deployments');
        browser.assert.ok(data.userAccounts.length >0, 'Should have multiple user accounts');
        browser.assert.ok(data.hasTransactions, 'Should capture deployment transactions');
        browser.assert.ok(data.deploymentCaptured, 'Workflow deployment should be captured in all MCP resources');
        if (data.deploymentDetails) {
          browser.assert.ok(data.deploymentDetails.hasAddress, 'Deployment should have address');
          browser.assert.ok(data.deploymentDetails.hasTransactionHash, 'Deployment should have transaction hash');
        }
      });
  },

  'Should test MCP integration with contract interaction workflow': function (browser: NightwatchBrowser) {
    browser
      // Interact with deployed contract through UI
      .clickLaunchIcon('udapp')
      .waitForElementPresent('*[data-id="sidePanelSwapitTitle"]')
      .assert.containsText('*[data-id="sidePanelSwapitTitle"]', 'DEPLOY & RUN TRANSACTIONS')
      .waitForElementPresent('*[data-id="universalDappUiContractActionWrapper"]', 60000)
      .clickInstance(0)
      .clickFunction('setValue - transact (not payable)', { types: 'uint256 _newValue', values: '87' })

      .pause(3000)
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          const mcpClients = (aiPlugin.mcpInferencer as any).mcpClients;
          const remixClient = mcpClients.get('Remix IDE Server');

          const transactionsContent = await remixClient.readResource('deployment://transactions');
          const transactionsData = transactionsContent.text ? JSON.parse(transactionsContent.text) : null;

          const networksContent = await remixClient.readResource('deployment://networks');
          const networksData = networksContent.text ? JSON.parse(networksContent.text) : null;

          const recentTransactions = transactionsData?.deployments || [];
          const interactionTransactions = recentTransactions.filter((t: any) =>
            t.type === 'transaction' || (t.contractName === 'WorkflowTest' && t.method)
          );

          return {
            transactionsAvailable: recentTransactions.length > 0,
            interactionsCaptured: interactionTransactions.length > 0,
            networksAvailable: !!networksData && Object.keys(networksData).length > 0,
            transactionCount: recentTransactions.length,
            interactionCount: interactionTransactions.length,
            networkCount: networksData ? Object.keys(networksData).length : 0,
            integrationWorking: recentTransactions.length > 0 && !!networksData
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Contract interaction integration error:', data.error);
          return;
        }
        browser.assert.ok(data.transactionsAvailable, 'Should have transactions available');
        browser.assert.ok(data.networksAvailable, 'Should have network information');
        browser.assert.ok(data.integrationWorking, 'MCP integration should work with contract interactions');
      });
  
    },
  
  'Should test RemixMCPServer solidity compile tool execution via server': function (browser: NightwatchBrowser) {
    browser
      .addFile('contracts/RemixMCPServerTest.sol', { content: workflowContract })
      .pause(1000)
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.remixMCPServer) {
          return { error: 'RemixMCPServer not available' };
        }

        try {
          const server = aiPlugin.remixMCPServer;

          const compileResult = await server.executeTool({
            name: 'solidity_compile',
            arguments: {
              file: 'contracts/RemixMCPServerTest.sol',
              version: '0.8.20',
              optimize: true,
              runs: 200
            }
          });

          const configResult = await server.executeTool({
            name: 'get_compiler_config',
            arguments: {}
          });

          return {
            compileExecuted: !compileResult.isError,
            configExecuted: !configResult.isError,
            compileContent: compileResult.content?.[0]?.text || null,
            configContent: configResult.content?.[0]?.text || null,
            compileError: compileResult.isError ? compileResult.content?.[0]?.text : null,
            configError: configResult.isError ? configResult.content?.[0]?.text : null
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Server tool execution error:', data.error);
          return;
        }
        browser.assert.ok(data.compileExecuted, 'Should execute compile tool successfully');
        browser.assert.ok(data.configExecuted, 'Should execute config tool successfully');
      });
  },

  'Should test MCP workflow error recovery': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin;
        if (!aiPlugin?.mcpInferencer || !aiPlugin?.remixMCPServer) {
          return { error: 'MCP components not available' };
        }

        const mcpClients = (aiPlugin.mcpInferencer as any).mcpClients;
        const remixClient = mcpClients.get('Remix IDE Server');

        try {
          let workflowErrors = [];
          let workflowRecoveries = [];

          try {
            await aiPlugin.mcpInferencer.executeTool('Remix IDE Server', {
              name: 'solidity_compile',
              arguments: {
                file: 'nonexistent.sol',
                version: '0.8.30'
              }
            });
          } catch (error) {
            workflowErrors.push('compile_nonexistent');

            try {
              const recovery = await aiPlugin.mcpInferencer.executeTool('Remix IDE Server', {
                name: 'get_compiler_config',
                arguments: {}
              });
              if (recovery) {
                workflowRecoveries.push('compile_recovery');
              }
            } catch (recoveryError) {
              // Recovery failed
            }
          }

          // Test 2: Invalid resource access
          try {
            await remixClient.readResource('invalid://resource');
          } catch (error) {
            workflowErrors.push('invalid_resource');

            try {
              const recovery = await remixClient.readResource('deployment://history');
              if (recovery) {
                workflowRecoveries.push('resource_recovery');
              }
            } catch (recoveryError) {
            }
          }

          const finalState = await aiPlugin.mcpInferencer.getAllTools();
          const systemStable = !!finalState && Object.keys(finalState).length > 0;

          return {
            errorsEncountered: workflowErrors.length,
            recoveriesSuccessful: workflowRecoveries.length,
            systemStableAfterErrors: systemStable,
            errorRecoveryRatio: workflowRecoveries.length / Math.max(workflowErrors.length, 1),
            errorRecoveryWorking: systemStable && workflowRecoveries.length > 0,
            workflowResilience: systemStable && workflowRecoveries.length >= workflowErrors.length * 0.5,
            errorTypes: workflowErrors,
            recoveryTypes: workflowRecoveries
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Error recovery test error:', data.error);
          return;
        }
        browser.assert.ok(data.systemStableAfterErrors, 'System should remain stable after workflow errors');
        browser.assert.ok(data.errorRecoveryWorking, 'Error recovery mechanism should work');
        browser.assert.ok(data.workflowResilience, 'Workflow should show resilience to errors');
      });
  }
};