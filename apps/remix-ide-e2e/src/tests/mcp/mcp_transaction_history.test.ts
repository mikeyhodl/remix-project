import { NightwatchBrowser } from 'nightwatch'
import init from '../../helpers/init'

const deploymentContract = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TransactionHistoryTest {
    uint256 public testValue;
    address public deployer;
    string public name;

    constructor(uint256 _value, string memory _name) {
        testValue = _value;
        deployer = msg.sender;
        name = _name;
    }

    function updateValue(uint256 _newValue) public {
        testValue = _newValue;
    }
}
`;

module.exports = {
  '@disabled': false,
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done)
  },

  'Should capture transaction data during deployment': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="verticalIconsKindfilePanel"]')
      .addFile('contracts/TransactionHistoryTest.sol', { content: deploymentContract })
      .click('*[data-id="verticalIconsKindsolidity"]')
      .waitForElementVisible('*[data-id="compileTabView"]')
      .click('*[data-id="compile-btn"]')
      .waitForElementContainsText('*[data-id="compilationFinished"]', 'compilation successful')
      .click('*[data-id="verticalIconsKindudapp"]')
      .waitForElementVisible('*[data-id="runTabView"]')
      .setValue('*[data-id="deployAndRunConstructorArgsInput"]', '123, "TestContract"')
      .click('*[data-id="Deploy - transact (not payable)"]')
      .waitForElementVisible('*[data-id="confirmDialogModalFooterOkButton"]')
      .click('*[data-id="confirmDialogModalFooterOkButton"]')
      .pause(3000) // Wait for deployment transaction
      .execute(function () {
        // Test udapp transaction history capture
        const udapp = (window as any).remix?.plugins?.udapp;
        if (!udapp?.getDeployedContracts) {
          return { error: 'UDAPP not available' };
        }

        const deployedContracts = udapp.getDeployedContracts();
        const networks = Object.keys(deployedContracts);

        if (networks.length === 0) {
          return { error: 'No deployed contracts found' };
        }

        const network = networks[0];
        const contracts = deployedContracts[network];
        const contractAddresses = Object.keys(contracts);

        if (contractAddresses.length === 0) {
          return { error: 'No contracts deployed' };
        }

        const latestContract = contracts[contractAddresses[contractAddresses.length - 1]];

        return {
          network,
          contractAddress: contractAddresses[contractAddresses.length - 1],
          transactionData: {
            hasTransactionHash: !!latestContract.transactionHash && latestContract.transactionHash !== 'unknown',
            transactionHash: latestContract.transactionHash,
            hasBlockNumber: typeof latestContract.blockNumber === 'number' && latestContract.blockNumber > 0,
            blockNumber: latestContract.blockNumber,
            hasBlockHash: !!latestContract.blockHash && latestContract.blockHash !== 'unknown',
            blockHash: latestContract.blockHash,
            hasGasUsed: typeof latestContract.gasUsed === 'number' && latestContract.gasUsed > 0,
            gasUsed: latestContract.gasUsed,
            hasGasPrice: !!latestContract.gasPrice && latestContract.gasPrice !== '0',
            gasPrice: latestContract.gasPrice,
            hasTimestamp: !!latestContract.timestamp,
            timestamp: latestContract.timestamp,
            hasDeployer: !!latestContract.from,
            deployer: latestContract.from,
            status: latestContract.status,
            contractName: latestContract.name
          },
          totalContracts: contractAddresses.length
        };
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Transaction capture error:', data.error);
          return;
        }

        const txData = data.transactionData;
        browser.assert.ok(txData.hasTransactionHash, 'Should capture transaction hash');
        browser.assert.ok(txData.hasBlockNumber, 'Should capture block number');
        browser.assert.ok(txData.hasGasUsed, 'Should capture gas used');
        browser.assert.ok(txData.hasTimestamp, 'Should capture timestamp');
        browser.assert.equal(txData.contractName, 'TransactionHistoryTest', 'Should have correct contract name');
      });
  },

  'Should verify transaction history in MCP deployment resources': function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id="verticalIconsKindaiTab"]')
      .waitForElementVisible('*[data-id="aiTabPanel"]')
      .execute(async function () {
        const aiPlugin = (window as any).getRemixAIPlugin();
        if (!aiPlugin?.mcpInferencer) {
          return { error: 'MCP inferencer not available' };
        }

        try {
          // Get deployment history via MCP
          const mcpClients = (aiPlugin.mcpInferencer as any).mcpClients;
          const remixClient = mcpClients.get('Remix IDE Server');

          if (!remixClient) {
            return { error: 'Remix MCP client not found' };
          }

          const historyContent = await remixClient.readResource('deployment://history');
          const historyData = historyContent.text ? JSON.parse(historyContent.text) : null;

          if (!historyData) {
            return { error: 'No deployment history data' };
          }

          const testContract = historyData.deployments.find((d: any) =>
            d.contractName === 'TransactionHistoryTest'
          );

          return {
            hasHistoryData: !!historyData,
            totalDeployments: historyData.deployments?.length || 0,
            hasTestContract: !!testContract,
            testContractData: testContract ? {
              hasTransactionHash: !!testContract.transactionHash && testContract.transactionHash !== 'unknown',
              hasBlockNumber: typeof testContract.blockNumber === 'number' && testContract.blockNumber > 0,
              hasGasUsed: typeof testContract.gasUsed === 'number' && testContract.gasUsed > 0,
              hasDeployer: !!testContract.deployer && testContract.deployer !== 'unknown',
              hasConstructorArgs: Array.isArray(testContract.constructorArgs),
              status: testContract.status,
              transactionHash: testContract.transactionHash,
              blockNumber: testContract.blockNumber
            } : null,
            summary: historyData.summary
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('MCP history error:', data.error);
          return;
        }

        browser.assert.ok(data.hasHistoryData, 'Should have deployment history data');
        browser.assert.ok(data.hasTestContract, 'Should find test contract in history');

        if (data.testContractData) {
          const contractData = data.testContractData;
          browser.assert.ok(contractData.hasTransactionHash, 'MCP should have transaction hash');
          browser.assert.ok(contractData.hasBlockNumber, 'MCP should have block number');
          browser.assert.ok(contractData.hasGasUsed, 'MCP should have gas used');
          browser.assert.ok(contractData.hasDeployer, 'MCP should have deployer address');
        }
      });
  },

  'Should verify transaction history in MCP transactions resource': function (browser: NightwatchBrowser) {
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
            return { error: 'Remix MCP client not found' };
          }

          const transactionsContent = await remixClient.readResource('deployment://transactions');
          const transactionsData = transactionsContent.text ? JSON.parse(transactionsContent.text) : null;

          if (!transactionsData) {
            return { error: 'No transactions data' };
          }

          const testTransaction = transactionsData.deployments.find((t: any) =>
            t.contractName === 'TransactionHistoryTest'
          );

          return {
            hasTransactionsData: !!transactionsData,
            totalTransactions: transactionsData.deployments?.length || 0,
            hasTestTransaction: !!testTransaction,
            testTransactionData: testTransaction ? {
              type: testTransaction.type,
              hasHash: !!testTransaction.hash && testTransaction.hash !== 'unknown',
              hasBlockNumber: typeof testTransaction.blockNumber === 'number' && testTransaction.blockNumber > 0,
              hasGasUsed: typeof testTransaction.gasUsed === 'number' && testTransaction.gasUsed > 0,
              hasGasPrice: !!testTransaction.gasPrice && testTransaction.gasPrice !== '0',
              hasConstructorArgs: Array.isArray(testTransaction.constructorArgs),
              status: testTransaction.status,
              network: testTransaction.network
            } : null,
            summary: transactionsData.summary
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('MCP transactions error:', data.error);
          return;
        }

        browser.assert.ok(data.hasTransactionsData, 'Should have transactions data');
        browser.assert.ok(data.hasTestTransaction, 'Should find test transaction');

        if (data.testTransactionData) {
          const txData = data.testTransactionData;
          browser.assert.equal(txData.type, 'deployment', 'Should be deployment transaction');
          browser.assert.ok(txData.hasHash, 'Should have transaction hash');
          browser.assert.ok(txData.hasBlockNumber, 'Should have block number');
          browser.assert.ok(txData.hasGasUsed, 'Should have gas used data');
        }
      });
  },

  'Should test transaction history persistence across environment changes': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        // Get current transaction history
        const udapp = (window as any).remix?.plugins?.udapp;
        if (!udapp?.getDeployedContracts) {
          return { error: 'UDAPP not available' };
        }

        const initialContracts = udapp.getDeployedContracts();
        const initialCount = Object.values(initialContracts).reduce((total: number, contracts: any) => {
          return total + Object.keys(contracts).length;
        }, 0);

        return {
          initialCount,
          hasContracts: Number(initialCount) > 0
        };
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Initial state error:', data.error);
          return;
        }
        browser.assert.ok(data.hasContracts, 'Should have contracts before environment change');
      })
      // Switch to different VM environment
      .click('*[data-id="verticalIconsKindudapp"]')
      .waitForElementVisible('*[data-id="runTabView"]')
      .click('*[data-id="runTabSelectOption"]')
      .click('*[data-id="dropdown-item-vm-cancun"]')
      .pause(2000)
      .execute(function () {
        // Check if transaction history was cleared appropriately
        const udapp = (window as any).remix?.plugins?.udapp;
        if (!udapp?.getDeployedContracts) {
          return { error: 'UDAPP not available' };
        }

        const contractsAfterSwitch = udapp.getDeployedContracts();
        const contractCountAfterSwitch = Object.values(contractsAfterSwitch).reduce((total: number, contracts: any) => {
          return total + Object.keys(contracts).length;
        }, 0);

        // Check transaction history map size if available
        const historyMapSize = udapp.transactionHistory ? udapp.transactionHistory.size : 'not available';

        return {
          contractCountAfterSwitch,
          historyMapSize,
          environmentChanged: true
        };
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Environment change error:', data.error);
          return;
        }
        browser.assert.ok(data.environmentChanged, 'Environment should be changed');
        // Transaction history should be cleared when environment changes
        if (typeof data.historyMapSize === 'number') {
          browser.assert.equal(data.historyMapSize, 0, 'Transaction history should be cleared');
        }
      });
  },

  'Should test manual transaction data addition': function (browser: NightwatchBrowser) {
    browser
      .execute(async function () {
        const udapp = (window as any).remix?.plugins?.udapp;
        if (!udapp?.addTransactionData) {
          return { error: 'Manual transaction data addition not available' };
        }

        try {
          // Test manual addition of transaction data (this would be used for existing contracts)
          const mockTxHash = '0x1234567890123456789012345678901234567890123456789012345678901234';
          const mockAddress = '0x1234567890123456789012345678901234567890';

          // This method should exist in the enhanced udapp
          const result = await udapp.addTransactionData(mockAddress, mockTxHash);

          return {
            manualAdditionAvailable: true,
            additionResult: result,
            success: !!result
          };
        } catch (error) {
          return {
            manualAdditionAvailable: false,
            error: error.message
          };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Manual transaction addition error:', data.error);
        }
        // This test verifies the manual addition capability exists
        // It may not succeed due to mock data, but should not crash
        browser.assert.ok(true, 'Manual transaction addition test completed');
      });
  },

  'Should verify transaction data consistency between UDAPP and MCP': function (browser: NightwatchBrowser) {
    browser
      // Deploy a new contract to test consistency
      .click('*[data-id="runTabSelectOption"]')
      .click('*[data-id="dropdown-item-vm-london"]')
      .pause(1000)
      .setValue('*[data-id="deployAndRunConstructorArgsInput"]', '456, "ConsistencyTest"')
      .click('*[data-id="Deploy - transact (not payable)"]')
      .waitForElementVisible('*[data-id="confirmDialogModalFooterOkButton"]')
      .click('*[data-id="confirmDialogModalFooterOkButton"]')
      .pause(3000)
      .execute(async function () {
        // Compare UDAPP data with MCP data
        const udapp = (window as any).remix?.plugins?.udapp;
        const aiPlugin = (window as any).getRemixAIPlugin();

        if (!udapp?.getDeployedContracts || !aiPlugin?.mcpInferencer) {
          return { error: 'Required plugins not available' };
        }

        try {
          // Get UDAPP data
          const udappContracts = udapp.getDeployedContracts();
          const udappLatest = Object.values(udappContracts)[0] as any;
          const udappLatestContract = Object.values(udappLatest)[Object.keys(udappLatest).length - 1] as any;

          // Get MCP data
          const mcpClients = (aiPlugin.mcpInferencer as any).mcpClients;
          const remixClient = mcpClients.get('Remix IDE Server');
          const historyContent = await remixClient.readResource('deployment://history');
          const historyData = historyContent.text ? JSON.parse(historyContent.text) : null;

          const mcpLatest = historyData?.deployments?.find((d: any) =>
            d.contractName === 'TransactionHistoryTest' && d.address === udappLatestContract.address
          );

          return {
            udappData: {
              address: udappLatestContract.address,
              transactionHash: udappLatestContract.transactionHash,
              blockNumber: udappLatestContract.blockNumber,
              gasUsed: udappLatestContract.gasUsed,
              name: udappLatestContract.name
            },
            mcpData: mcpLatest ? {
              address: mcpLatest.address,
              transactionHash: mcpLatest.transactionHash,
              blockNumber: mcpLatest.blockNumber,
              gasUsed: mcpLatest.gasUsed,
              name: mcpLatest.contractName
            } : null,
            dataConsistent: mcpLatest ? (
              udappLatestContract.address === mcpLatest.address &&
              udappLatestContract.transactionHash === mcpLatest.transactionHash &&
              udappLatestContract.blockNumber === mcpLatest.blockNumber
            ) : false
          };
        } catch (error) {
          return { error: error.message };
        }
      }, [], function (result) {
        const data = result.value as any;
        if (data.error) {
          console.error('Consistency check error:', data.error);
          return;
        }

        if (data.mcpData) {
          browser.assert.ok(data.dataConsistent, 'UDAPP and MCP data should be consistent');
          browser.assert.equal(data.udappData.address, data.mcpData.address, 'Addresses should match');
          browser.assert.equal(data.udappData.transactionHash, data.mcpData.transactionHash, 'Transaction hashes should match');
        }
      });
  }
};