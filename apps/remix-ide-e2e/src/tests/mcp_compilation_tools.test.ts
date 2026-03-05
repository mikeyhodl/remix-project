import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

/**
 * E2E Tests for MCP Compilation Tools via Chat Interface
 *
 * Tests compilation tools when triggered through AI chat prompts,
 * verifying that the AI can successfully compile contracts, manage compiler
 * configuration, and handle different compilation frameworks.
 *
 * Unlike mcp_compilation_tools (direct plugin), this test simulates
 * real user interaction through the chat interface.
 */

const testContract = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CompilationTest {
    uint256 public value;
    address public owner;

    event ValueChanged(uint256 newValue);

    constructor() {
        owner = msg.sender;
        value = 0;
    }

    function setValue(uint256 _newValue) public {
        require(msg.sender == owner, "Only owner can set value");
        value = _newValue;
        emit ValueChanged(_newValue);
    }

    function getValue() public view returns (uint256) {
        return value;
    }
}
`;

const tests = {
  '@disabled': true,
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done, 'http://127.0.0.1:8080/#experimental=true', true, undefined, true, true)
  },

  'Setup: Enable MCP and allow file permissions #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="remixIdeSidePanel"]', 10000)
      .clickLaunchIcon('filePanel')
      .removeFile('remix.config.json', '/')
      .removeFile('remix.config1.json', '/')
      .clickLaunchIcon('remixaiassistant')
      .waitForElementPresent('*[data-id="remix-ai-assistant-ready"]', 60000)
      .pause(1000)
      // Enable MCP Enhancement
      .waitForElementVisible('*[data-assist-btn="assistant-selector-btn"]', 5000)
      .click('*[data-assist-btn="assistant-selector-btn"]')
      .pause(500)
      .waitForElementVisible('#mcpEnhancementToggle', 5000)
      .execute(function () {
        const checkbox = document.getElementById('mcpEnhancementToggle') as HTMLInputElement;
        if (checkbox && !checkbox.checked) {
          checkbox.click();
        }
      })
      .pause(1000)
      // Verify MCP is enabled
      .execute(function () {
        const checkbox = document.getElementById('mcpEnhancementToggle') as HTMLInputElement;
        return { mcpEnabled: checkbox?.checked || false };
      }, [], function (result) {
        const data = result.value as any;
        browser.assert.ok(data.mcpEnabled, 'MCP Enhancement should be enabled');
      })
  },

  /**
   * Test 1: Request compiler versions via chat
   * Verifies that AI can retrieve and display available compiler versions
   */
  'Should get compiler versions via chat #group1': function (browser: NightwatchBrowser) {
    browser
      .refresh()
      .waitForElementVisible('*[data-id="remixIdeSidePanel"]', 10000)
      .clickLaunchIcon('remixaiassistant')
      .waitForElementPresent('*[data-id="remix-ai-assistant-ready"]', 60000)
      .waitForElementVisible('*[data-id=remix-ai-prompt-input]', 5000)
      .clearValue('*[data-id=remix-ai-prompt-input]')
      .setValue('*[data-id=remix-ai-prompt-input]', 'What Solidity compiler versions are available?')
      .sendKeys('*[data-id=remix-ai-prompt-input]', browser.Keys.ENTER)
      .pause(2000)
      .waitForElementPresent({
        locateStrategy: 'xpath',
        selector: "//*[@data-id='remix-ai-streaming' and @data-streaming='true']",
        timeout: 30000
      })
      .waitForElementPresent({
        locateStrategy: 'xpath',
        selector: "//*[@data-id='remix-ai-streaming' and @data-streaming='false']",
        timeout: 60000
      })
  },

  /**
   * Test 2: Get current compiler configuration via chat
   */
  'Should get compiler config via chat #group1': function (browser: NightwatchBrowser) {
    browser
      .refresh()
      .waitForElementVisible('*[data-id="remixIdeSidePanel"]', 10000)
      .clickLaunchIcon('remixaiassistant')
      .waitForElementPresent('*[data-id="remix-ai-assistant-ready"]', 60000)
      .pause(1000)
      .waitForElementVisible('*[data-id=remix-ai-prompt-input]', 5000)
      .clearValue('*[data-id=remix-ai-prompt-input]')
      .setValue('*[data-id=remix-ai-prompt-input]', 'Show me the current compiler configuration')
      .sendKeys('*[data-id=remix-ai-prompt-input]', browser.Keys.ENTER)
      .pause(2000)
      .waitForElementPresent({
        locateStrategy: 'xpath',
        selector: "//*[@data-id='remix-ai-streaming' and @data-streaming='true']",
        timeout: 30000
      })
      .waitForElementPresent({
        locateStrategy: 'xpath',
        selector: "//*[@data-id='remix-ai-streaming' and @data-streaming='false']",
        timeout: 60000
      })
  },

  /**
   * Test 3: Set compiler configuration via chat
   */
  'Should set compiler config via chat #group2': function (browser: NightwatchBrowser) {
    browser
      .refresh()
      .waitForElementVisible('*[data-id="remixIdeSidePanel"]', 10000)
      .clickLaunchIcon('remixaiassistant')
      .waitForElementPresent('*[data-id="remix-ai-assistant-ready"]', 60000)
      .waitForElementVisible('*[data-id=remix-ai-prompt-input]', 5000)
      .clearValue('*[data-id=remix-ai-prompt-input]')
      .setValue('*[data-id=remix-ai-prompt-input]', 'Set the compiler to version 0.8.20 with optimization enabled and 200 runs using paris EVM version')
      .sendKeys('*[data-id=remix-ai-prompt-input]', browser.Keys.ENTER)
      .pause(2000)
      .waitForElementPresent({
        locateStrategy: 'xpath',
        selector: "//*[@data-id='remix-ai-streaming' and @data-streaming='true']",
        timeout: 30000
      })
      .waitForElementPresent({
        locateStrategy: 'xpath',
        selector: "//*[@data-id='remix-ai-streaming' and @data-streaming='false']",
        timeout: 60000
      })
      .pause(2000)
  },

  /**
   * Test 4: Create and compile a contract via chat
   * This test handles file write permissions and compilation
   */
  'Should create and compile contract via chat #group2': function (browser: NightwatchBrowser) {
    browser
      .refresh()
      .waitForElementVisible('*[data-id="remixIdeSidePanel"]', 10000)
      .clickLaunchIcon('remixaiassistant')
      .waitForElementPresent('*[data-id="remix-ai-assistant-ready"]', 60000)
      .waitForElementVisible('*[data-id=remix-ai-prompt-input]', 5000)
      .clearValue('*[data-id=remix-ai-prompt-input]')
      .setValue('*[data-id=remix-ai-prompt-input]', 'Create a contract file at contracts/CompilationTest.sol with a simple storage contract that has a uint256 value and a setter function, then compile it')
      .sendKeys('*[data-id=remix-ai-prompt-input]', browser.Keys.ENTER)
      .pause(2000)
      .waitForElementVisible('*[data-id="mcp_file_write_permission_initialModalDialogContainer-react"]', 60000)
      .modalFooterOKClick("mcp_file_write_permission_initial") // Click "Allow"
      .pause(500)
      .waitForElementVisible('*[data-id="mcp_file_write_permission_scopeModalDialogContainer-react"]', 30000)
      .modalFooterCancelClick("mcp_file_write_permission_scope") // Click "All Files in Project"
      .useXpath()
      .waitForElementVisible('//button[contains(text(), "Accept All")]', 10000)
      .click('//button[contains(text(), "Accept All")]')
      .useCss()
      .pause(2000)
      .waitForElementPresent({
        locateStrategy: 'xpath',
        selector: "//*[@data-id='remix-ai-streaming' and @data-streaming='false']",
        timeout: 60000
      })
      .pause(2000)
      .clickLaunchIcon('filePanel')
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemcontracts"]', 10000)
  },

  /**
   * Test 5: Get compilation results via chat
   */
  'Should get compilation results via chat #group2': function (browser: NightwatchBrowser) {
    browser
      .refresh()
      .waitForElementVisible('*[data-id="remixIdeSidePanel"]', 10000)
      .pause(500)
      .clickLaunchIcon('remixaiassistant')
      .waitForElementPresent('*[data-id="remix-ai-assistant-ready"]', 60000)
      .waitForElementVisible('*[data-id=remix-ai-prompt-input]', 5000)
      .clearValue('*[data-id=remix-ai-prompt-input]')
      .setValue('*[data-id=remix-ai-prompt-input]', 'Compile the contracts/CompilationTest.sol file')
      .sendKeys('*[data-id=remix-ai-prompt-input]', browser.Keys.ENTER)
      .pause(2000)
      .waitForElementPresent({
        locateStrategy: 'xpath',
        selector: "//*[@data-id='remix-ai-streaming' and @data-streaming='true']",
        timeout: 30000
      })
      .waitForElementPresent({
        locateStrategy: 'xpath',
        selector: "//*[@data-id='remix-ai-streaming' and @data-streaming='false']",
        timeout: 60000
      })
      .pause(2000)
      .clearValue('*[data-id=remix-ai-prompt-input]')
      .setValue('*[data-id=remix-ai-prompt-input]', 'Show me the last compilation result')
      .sendKeys('*[data-id=remix-ai-prompt-input]', browser.Keys.ENTER)
      .pause(2000)
      .waitForElementPresent({
        locateStrategy: 'xpath',
        selector: "//*[@data-id='remix-ai-streaming' and @data-streaming='true']",
        timeout: 30000
      })
      .waitForElementPresent({
        locateStrategy: 'xpath',
        selector: "//*[@data-id='remix-ai-streaming' and @data-streaming='false']",
        timeout: 60000
      })
  },

  /**
   * Test 6: Compile contract with errors via chat
   */
  'Should handle compilation errors via chat #group3': function (browser: NightwatchBrowser) {
    browser
      .refresh()
      .waitForElementVisible('*[data-id="remixIdeSidePanel"]', 10000)
      .clickLaunchIcon('remixaiassistant')
      .waitForElementPresent('*[data-id="remix-ai-assistant-ready"]', 60000)
      .waitForElementVisible('*[data-id=remix-ai-prompt-input]', 5000)
      .clearValue('*[data-id=remix-ai-prompt-input]')
      .setValue('*[data-id=remix-ai-prompt-input]', 'Create contracts/InvalidContract.sol with this code: pragma solidity ^0.8.0; contract Invalid { uint256 public value function test() public {} } and then compile it')
      .sendKeys('*[data-id=remix-ai-prompt-input]', browser.Keys.ENTER)
      .pause(2000)
      // Handle file permission if needed (may already be set from previous test)
      .elements('css selector', '*[data-id="mcp_file_write_permission_initialModalDialogContainer-react"]', function (result) {
        const elements = Array.isArray(result.value) ? result.value : [];
        if (elements.length > 0) {
          browser
            .modalFooterOKClick("mcp_file_write_permission_initial")
            .pause(500)
            .waitForElementVisible('*[data-id="mcp_file_write_permission_scopeModalDialogContainer-react"]', 10000)
            .modalFooterCancelClick("mcp_file_write_permission_scope")
            .useXpath()
            .waitForElementVisible('//button[contains(text(), "Accept All")]', 10000)
            .click('//button[contains(text(), "Accept All")]')
            .useCss()
            .pause(1000);
        }
      })
      .waitForElementPresent({
        locateStrategy: 'xpath',
        selector: "//*[@data-id='remix-ai-streaming' and @data-streaming='false']",
        timeout: 60000
      })
  },

}

const branch = process.env.CIRCLE_BRANCH || 'ai_reale2e_test'
const runTestsConditions = branch && (branch === 'master' || branch === 'ai_reale2e_test')

const checkBrowserIsChrome = function (browser: NightwatchBrowser) {
  return browser.browserName.indexOf('chrome') > -1
}

if (!checkBrowserIsChrome(browser)) {
  module.exports = {}
} else {
  module.exports = {
    ...(branch ? (runTestsConditions ? tests : {}) : tests)
  };
}
