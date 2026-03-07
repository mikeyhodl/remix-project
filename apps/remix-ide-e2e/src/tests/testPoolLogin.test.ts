'use strict'
import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'
import { releaseAccount } from '../helpers/pool'
import { waitAndVerifySync, waitForSyncIdle } from '../helpers/cloud-sync-verify'

require('dotenv').config()

const poolApiKey = process.env.E2E_POOL_API_KEY || ''

module.exports = {
  '@disabled': true,

  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    if (!poolApiKey) {
      console.error('[TestPoolLogin] E2E_POOL_API_KEY not set — cannot run pool test')
      return done()
    }

    // Pass the pool key + enableLogin in the hash so the auth plugin can use it.
    // No fake token injection — the real login flow will do the checkout.
    const url = `http://127.0.0.1:8080#e2e_pool_key=${poolApiKey}&activate=udapp`
    init(browser, done, url, true)
  },

  after: async function (browser: NightwatchBrowser, done: VoidFunction) {
    // Read the pool session that the auth plugin stored in sessionStorage
    try {
      const result: any = await new Promise((resolve) => {
        browser.execute(function () {
          return sessionStorage.getItem('remix_pool_session')
        }, [], (res: any) => resolve(res))
      })

      if (result && result.value) {
        const session = JSON.parse(result.value)
        console.log(`[TestPoolLogin] Releasing pool session: ${session.sessionId}`)
        await releaseAccount(session.sessionId)
      }
    } catch (err: any) {
      console.error(`[TestPoolLogin] Release failed: ${err.message}`)
    }
    browser.end()
    done()
  },

  'Should enable login and show sign-in button #group1': function (browser: NightwatchBrowser) {
    browser
      // enableLogin must be set for the Sign In button to appear
      .execute(function () {
        localStorage.setItem('enableLogin', 'true')
      })
      .refreshPage()
      .pause(5000)
      .waitForElementVisible('*[data-id="login-button"]', 15000)
      .assert.elementPresent('*[data-id="login-button"]')
  },

  'Should login via the test pool through the real UI flow #group1': function (browser: NightwatchBrowser) {
    browser
      // Open the login modal
      .click('*[data-id="login-button"]')
      .pause(3000)
      // The modal should detect the e2e_pool_key and show the "E2E Test Pool" button
      .waitForElementVisible({
        selector: '//button[contains(., "E2E Test Pool")]',
        locateStrategy: 'xpath',
        timeout: 15000
      })
      // Click the test pool login button — this triggers a real pool checkout
      .click({
        selector: '//button[contains(., "E2E Test Pool")]',
        locateStrategy: 'xpath'
      })
      // Wait for the login to complete (modal closes, tokens get stored)
      .pause(5000)
  },

  'Should have auth tokens in localStorage after pool login #group1': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        return {
          accessToken: localStorage.getItem('remix_access_token'),
          refreshToken: localStorage.getItem('remix_refresh_token'),
          user: localStorage.getItem('remix_user'),
          poolSession: sessionStorage.getItem('remix_pool_session'),
        }
      }, [], function (result: any) {
        const data = result.value
        browser
          .assert.ok(data.accessToken && data.accessToken.length > 0, 'Access token is set')
          .assert.ok(data.refreshToken && data.refreshToken.length > 0, 'Refresh token is set')
          .assert.ok(data.user && data.user.length > 0, 'User object is set')
          .assert.ok(data.poolSession && data.poolSession.length > 0, 'Pool session is tracked in sessionStorage')
      })
  },

  'Should show the user as logged in with test provider #group1': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        const user = localStorage.getItem('remix_user')
        if (user) {
          try {
            const parsed = JSON.parse(user)
            return { email: parsed.email, name: parsed.name, provider: parsed.provider }
          } catch (e) {
            return null
          }
        }
        return null
      }, [], function (result: any) {
        const user = result.value
        browser
          .assert.ok(user !== null, 'User data is parseable')
          .assert.ok(user.email && user.email.includes('@'), 'User has a valid email')
          .assert.equal(user.provider, 'test', 'Provider is "test"')
        console.log(`[TestPoolLogin] Logged in as: ${user.name} (${user.email})`)
      })
  },

  // ── Cloud workspace + sync verification ────────────────

  'Should create a cloud workspace #group2': async function (browser: NightwatchBrowser) {
    // group2 needs login first — repeat the login flow
    browser
      .execute(function () {
        localStorage.setItem('enableLogin', 'true')
      })
      .refreshPage()
      .pause(5000)
      .waitForElementVisible('*[data-id="login-button"]', 15000)
      .click('*[data-id="login-button"]')
      .pause(3000)
      .waitForElementVisible({
        selector: '//button[contains(., "E2E Test Pool")]',
        locateStrategy: 'xpath',
        timeout: 15000,
      })
      .click({
        selector: '//button[contains(., "E2E Test Pool")]',
        locateStrategy: 'xpath',
      })
      .pause(5000)
      // Open the workspace dropdown → template explorer → Blank template
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)
      .click('*[data-id="workspacecreate"]')
      .waitForElementVisible('*[data-id="template-explorer-modal-react"]', 10000)
      .waitForElementVisible('*[data-id="template-explorer-template-container"]', 10000)
      .click('*[data-id="template-explorer-template-container"]')
      .waitForElementVisible('*[data-id="template-card-blank-1"]', 10000)
      .click('*[data-id="template-card-blank-1"]')
      // The blank workspace section appears with a name input
      .waitForElementVisible('*[data-id="generic-template-section-blank"]', 10000)
      .waitForElementVisible('*[data-id="workspace-name-blank-input"]', 10000)
      .click('*[data-id="workspace-name-blank-input"]')
      .clearValue('*[data-id="workspace-name-blank-input"]')
      .setValue('*[data-id="workspace-name-blank-input"]', 'e2e-sync-test')
      .pause(500)
      .click('*[data-id="validate-blankworkspace-button"]')
      .currentWorkspaceIs('e2e-sync-test')

    // Wait for cloud sync engine to activate and complete initial sync
    await waitForSyncIdle(browser)
  },

  'Should create a test file in the cloud workspace #group2': function (browser: NightwatchBrowser) {
    browser
      // Use the real UI: right-click tree → New File → type name → set content
      .addFile('test-sync.sol', {
        content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract SyncTest {\n    uint256 public value;\n\n    function setValue(uint256 _value) public {\n        value = _value;\n    }\n}\n'
      }, 'remix.config.json')
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemtest-sync.sol"]', 10000)
  },

  'Should flush pending changes and verify sync integrity #group2': async function (browser: NightwatchBrowser) {
    // waitAndVerifySync polls until the engine is idle with 0 pending changes
    const result = await waitAndVerifySync(browser, 30_000, {
      allowPhantoms: 0,
      allowMissing: 0,
      allowMismatched: 0,
    })

    console.log(`[TestPoolLogin:SyncVerify] manifest=${result.manifestFileCount} files, remote=${result.remoteFileCount} files, ok=${result.ok}`)
  },

  'Should edit the file and re-verify sync #group2': async function (browser: NightwatchBrowser) {
    // Open the file and edit it through the editor UI
    browser
      .openFile('test-sync.sol')
      .setEditorValue('// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract SyncTest {\n    uint256 public value;\n    string public name;\n\n    function setValue(uint256 _value) public {\n        value = _value;\n    }\n\n    function setName(string memory _name) public {\n        name = _name;\n    }\n}\n')
      .pause(1000)
      .getEditorValue((content) => {
        browser.assert.ok(content.indexOf('setName') !== -1, 'Editor contains the new setName function')
      })

    // waitAndVerifySync polls until the engine is idle — no manual pause needed
    const result = await waitAndVerifySync(browser, 30_000)
    console.log(`[TestPoolLogin:SyncVerify] After edit: manifest=${result.manifestFileCount}, remote=${result.remoteFileCount}, ok=${result.ok}`)
  },

  'Should delete the file and verify sync reflects deletion #group2': async function (browser: NightwatchBrowser) {
    // Delete the file through the real UI: right-click → Delete → confirm modal
    browser
      .removeFile('test-sync.sol', 'e2e-sync-test')

    // waitAndVerifySync polls until the engine is idle — no manual pause needed
    const result = await waitAndVerifySync(browser, 30_000)
    console.log(`[TestPoolLogin:SyncVerify] After delete: manifest=${result.manifestFileCount}, remote=${result.remoteFileCount}, ok=${result.ok}`)
  },

  // ── S3 Restore: wipe local, reload, verify restore ────────

  'Should login and create first cloud workspace ws-alpha #group3': async function (browser: NightwatchBrowser) {
    // Login (each group is isolated)
    browser
      .execute(function () {
        localStorage.setItem('enableLogin', 'true')
      })
      .refreshPage()
      .pause(5000)
      .waitForElementVisible('*[data-id="login-button"]', 15000)
      .click('*[data-id="login-button"]')
      .pause(3000)
      .waitForElementVisible({
        selector: '//button[contains(., "E2E Test Pool")]',
        locateStrategy: 'xpath',
        timeout: 15000,
      })
      .click({
        selector: '//button[contains(., "E2E Test Pool")]',
        locateStrategy: 'xpath',
      })
      .pause(5000)
      // Create ws-alpha via template explorer
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)
      .click('*[data-id="workspacecreate"]')
      .waitForElementVisible('*[data-id="template-explorer-modal-react"]', 10000)
      .waitForElementVisible('*[data-id="template-explorer-template-container"]', 10000)
      .click('*[data-id="template-explorer-template-container"]')
      .waitForElementVisible('*[data-id="template-card-blank-1"]', 10000)
      .click('*[data-id="template-card-blank-1"]')
      .waitForElementVisible('*[data-id="generic-template-section-blank"]', 10000)
      .waitForElementVisible('*[data-id="workspace-name-blank-input"]', 10000)
      .click('*[data-id="workspace-name-blank-input"]')
      .clearValue('*[data-id="workspace-name-blank-input"]')
      .setValue('*[data-id="workspace-name-blank-input"]', 'ws-alpha')
      .pause(500)
      .click('*[data-id="validate-blankworkspace-button"]')
      .currentWorkspaceIs('ws-alpha')
      // Add a unique file
      .addFile('alpha-contract.sol', {
        content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract AlphaTest {\n    string public name = "alpha";\n\n    function greet() public pure returns (string memory) {\n        return "Hello from Alpha";\n    }\n}\n'
      }, 'remix.config.json')
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemalpha-contract.sol"]', 10000)

    // Wait for cloud sync engine to push all changes to S3
    await waitForSyncIdle(browser)
  },

  'Should create second cloud workspace ws-beta #group3': async function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)
      .click('*[data-id="workspacecreate"]')
      .waitForElementVisible('*[data-id="template-explorer-modal-react"]', 10000)
      .waitForElementVisible('*[data-id="template-explorer-template-container"]', 10000)
      .click('*[data-id="template-explorer-template-container"]')
      .waitForElementVisible('*[data-id="template-card-blank-1"]', 10000)
      .click('*[data-id="template-card-blank-1"]')
      .waitForElementVisible('*[data-id="generic-template-section-blank"]', 10000)
      .waitForElementVisible('*[data-id="workspace-name-blank-input"]', 10000)
      .click('*[data-id="workspace-name-blank-input"]')
      .clearValue('*[data-id="workspace-name-blank-input"]')
      .setValue('*[data-id="workspace-name-blank-input"]', 'ws-beta')
      .pause(500)
      .click('*[data-id="validate-blankworkspace-button"]')
      .currentWorkspaceIs('ws-beta')
      // Add unique files
      .addFile('beta-contract.sol', {
        content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract BetaTest {\n    uint256 public counter;\n\n    function increment() public {\n        counter += 1;\n    }\n\n    function getCounter() public view returns (uint256) {\n        return counter;\n    }\n}\n'
      }, 'remix.config.json')
      .waitForElementVisible('*[data-id="treeViewLitreeViewItembeta-contract.sol"]', 10000)
      .addFile('beta-lib.sol', {
        content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\nlibrary BetaLib {\n    function add(uint256 a, uint256 b) internal pure returns (uint256) {\n        return a + b;\n    }\n}\n'
      }, 'remix.config.json')
      .waitForElementVisible('*[data-id="treeViewLitreeViewItembeta-lib.sol"]', 10000)

    // Wait for cloud sync engine to push all changes to S3
    await waitForSyncIdle(browser)
  },

  'Should create third cloud workspace ws-gamma #group3': async function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)
      .click('*[data-id="workspacecreate"]')
      .waitForElementVisible('*[data-id="template-explorer-modal-react"]', 10000)
      .waitForElementVisible('*[data-id="template-explorer-template-container"]', 10000)
      .click('*[data-id="template-explorer-template-container"]')
      .waitForElementVisible('*[data-id="template-card-blank-1"]', 10000)
      .click('*[data-id="template-card-blank-1"]')
      .waitForElementVisible('*[data-id="generic-template-section-blank"]', 10000)
      .waitForElementVisible('*[data-id="workspace-name-blank-input"]', 10000)
      .click('*[data-id="workspace-name-blank-input"]')
      .clearValue('*[data-id="workspace-name-blank-input"]')
      .setValue('*[data-id="workspace-name-blank-input"]', 'ws-gamma')
      .pause(500)
      .click('*[data-id="validate-blankworkspace-button"]')
      .currentWorkspaceIs('ws-gamma')
      // Add a unique file
      .addFile('gamma-main.sol', {
        content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract GammaMain {\n    address public owner;\n\n    constructor() {\n        owner = msg.sender;\n    }\n\n    function getOwner() public view returns (address) {\n        return owner;\n    }\n}\n'
      }, 'remix.config.json')
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemgamma-main.sol"]', 10000)

    // Wait for cloud sync engine to push all changes to S3
    await waitForSyncIdle(browser)
  },

  'Should verify sync integrity for all three workspaces #group3': async function (browser: NightwatchBrowser) {
    // Currently on ws-gamma — verify it
    const gammaResult = await waitAndVerifySync(browser, 30_000)
    console.log(`[group3] ws-gamma: manifest=${gammaResult.manifestFileCount}, remote=${gammaResult.remoteFileCount}, ok=${gammaResult.ok}`)

    // Switch to ws-beta and verify
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)
      .waitForElementVisible('*[data-id="dropdown-item-ws-beta"]', 10000)
      .click('*[data-id="dropdown-item-ws-beta"]')

    // waitAndVerifySync polls until engine is idle — covers activate + pull
    const betaResult = await waitAndVerifySync(browser, 30_000)
    console.log(`[group3] ws-beta: manifest=${betaResult.manifestFileCount}, remote=${betaResult.remoteFileCount}, ok=${betaResult.ok}`)

    // Switch to ws-alpha and verify
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)
      .waitForElementVisible('*[data-id="dropdown-item-ws-alpha"]', 10000)
      .click('*[data-id="dropdown-item-ws-alpha"]')

    // waitAndVerifySync polls until engine is idle — covers activate + pull
    const alphaResult = await waitAndVerifySync(browser, 30_000)
    console.log(`[group3] ws-alpha: manifest=${alphaResult.manifestFileCount}, remote=${alphaResult.remoteFileCount}, ok=${alphaResult.ok}`)
  },

  'Should wipe local cloud data and reload the page #group3': async function (browser: NightwatchBrowser) {
    browser
      // Wipe the local .cloud-workspaces directory from IndexedDB
      .execute(function () {
        return (window as any).remixFileSystem.unlink('.cloud-workspaces')
      }, [], function (result: any) {
        console.log('[group3] Wiped .cloud-workspaces from local FS')
      })
      // Reload the page — tokens stay in localStorage, so user is still logged in
      .refresh()
      .waitForElementVisible('[data-id="workspacesSelect"]', 30000)

    // Wait for cloud system to discover workspaces and complete initial pull from S3
    await waitForSyncIdle(browser, 60_000)
  },

  'Should verify ws-alpha restored from S3 with correct files #group3': async function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)
      .waitForElementVisible('*[data-id="dropdown-item-ws-alpha"]', 20000)
      .click('*[data-id="dropdown-item-ws-alpha"]')

    // Wait for sync engine to activate and pull workspace from S3
    await waitForSyncIdle(browser)

    browser
      .currentWorkspaceIs('ws-alpha')
      // Verify the file exists in the tree
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemalpha-contract.sol"]', 20000)
      // Open and verify content
      .openFile('alpha-contract.sol')
      .pause(2000)
      .getEditorValue((content) => {
        browser.assert.ok(
          content.indexOf('contract AlphaTest') !== -1,
          'ws-alpha: alpha-contract.sol contains contract AlphaTest'
        )
        browser.assert.ok(
          content.indexOf('Hello from Alpha') !== -1,
          'ws-alpha: alpha-contract.sol contains "Hello from Alpha"'
        )
      })
  },

  'Should verify ws-beta restored from S3 with correct files #group3': async function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)
      .waitForElementVisible('*[data-id="dropdown-item-ws-beta"]', 20000)
      .click('*[data-id="dropdown-item-ws-beta"]')

    // Wait for sync engine to activate and pull workspace from S3
    await waitForSyncIdle(browser)

    browser
      .currentWorkspaceIs('ws-beta')
      // Verify both files exist
      .waitForElementVisible('*[data-id="treeViewLitreeViewItembeta-contract.sol"]', 20000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItembeta-lib.sol"]', 20000)
      // Check beta-contract.sol content
      .openFile('beta-contract.sol')
      .pause(2000)
      .getEditorValue((content) => {
        browser.assert.ok(
          content.indexOf('contract BetaTest') !== -1,
          'ws-beta: beta-contract.sol contains contract BetaTest'
        )
        browser.assert.ok(
          content.indexOf('function increment') !== -1,
          'ws-beta: beta-contract.sol contains increment function'
        )
      })
      // Check beta-lib.sol content
      .openFile('beta-lib.sol')
      .pause(2000)
      .getEditorValue((content) => {
        browser.assert.ok(
          content.indexOf('library BetaLib') !== -1,
          'ws-beta: beta-lib.sol contains library BetaLib'
        )
      })
  },

  'Should verify ws-gamma restored from S3 with correct files #group3': async function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)
      .waitForElementVisible('*[data-id="dropdown-item-ws-gamma"]', 20000)
      .click('*[data-id="dropdown-item-ws-gamma"]')

    // Wait for sync engine to activate and pull workspace from S3
    await waitForSyncIdle(browser)

    browser
      .currentWorkspaceIs('ws-gamma')
      // Verify the file exists
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemgamma-main.sol"]', 20000)
      // Open and verify content
      .openFile('gamma-main.sol')
      .pause(2000)
      .getEditorValue((content) => {
        browser.assert.ok(
          content.indexOf('contract GammaMain') !== -1,
          'ws-gamma: gamma-main.sol contains contract GammaMain'
        )
        browser.assert.ok(
          content.indexOf('function getOwner') !== -1,
          'ws-gamma: gamma-main.sol contains getOwner function'
        )
      })
  },

  // ── Git-clone workspace templates ──────────────────────

  'Should login for git clone tests #group4': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        localStorage.setItem('enableLogin', 'true')
      })
      .refreshPage()
      .pause(5000)
      .clickLaunchIcon('filePanel')
      .waitForElementVisible('*[data-id="login-button"]', 15000)
      .click('*[data-id="login-button"]')
      .pause(3000)
      .waitForElementVisible({
        selector: '//button[contains(., "E2E Test Pool")]',
        locateStrategy: 'xpath',
        timeout: 15000,
      })
      .click({
        selector: '//button[contains(., "E2E Test Pool")]',
        locateStrategy: 'xpath',
      })
      .pause(5000)
  },

  'Should clone Account Abstraction repo into a cloud workspace #group4': async function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)
      .click('*[data-id="workspacecreate"]')
      .waitForElementVisible('*[data-id="template-explorer-modal-react"]', 10000)
      .waitForElementVisible('*[data-id="template-explorer-template-container"]', 10000)
      // accountAbstraction is in the Generic category, index 3
      .click('*[data-id="template-card-accountAbstraction-3"]')
      .waitForElementVisible('*[data-id="generic-template-section-accountAbstraction"]', 10000)
      .waitForElementVisible('*[data-id="workspace-name-accountAbstraction-input"]', 10000)
      // Click Finish to start cloning
      .click('*[data-id="validate-accountAbstractionworkspace-button"]')
      // Wait for modal to disappear — clone is complete once modal closes
      .waitForElementNotPresent('*[data-id="template-explorer-modal-react"]', 120000)
      .pause(3000)

    // Wait for sync engine to activate and push to S3
    await waitForSyncIdle(browser, 120_000)

    // Verify key files from the account-abstraction repo exist
    browser
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemcontracts"]', 30000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemtest"]', 30000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItempackage.json"]', 10000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemREADME.md"]', 10000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemLICENSE"]', 10000)

    // Verify sync integrity
    const result = await waitAndVerifySync(browser, 60_000)
    console.log(`[group4] accountAbstraction: manifest=${result.manifestFileCount}, remote=${result.remoteFileCount}, ok=${result.ok}`)
  },

  'Should clone Uniswap v4 Template repo into a cloud workspace #group4': async function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)
      .click('*[data-id="workspacecreate"]')
      .waitForElementVisible('*[data-id="template-explorer-modal-react"]', 10000)
      .waitForElementVisible('*[data-id="template-explorer-template-container"]', 10000)
      // uniswapV4Template is in the Uniswap V4 category, index 0
      .click('*[data-id="template-card-uniswapV4Template-0"]')
      .waitForElementVisible('*[data-id="generic-template-section-uniswapV4Template"]', 10000)
      .waitForElementVisible('*[data-id="workspace-name-uniswapV4Template-input"]', 10000)
      // Click Finish to start cloning
      .click('*[data-id="validate-uniswapV4Templateworkspace-button"]')
      // Wait for modal to disappear — clone completes when modal closes
      .waitForElementNotPresent('*[data-id="template-explorer-modal-react"]', 120000)
      .pause(3000)

    // Wait for sync engine to activate and push to S3
    await waitForSyncIdle(browser, 120_000)

    // Verify key files from the v4-template repo exist
    browser
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemsrc"]', 30000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemlib"]', 30000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemscript"]', 30000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemtest"]', 30000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemfoundry.toml"]', 10000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemREADME.md"]', 10000)

    // Verify sync integrity
    const result = await waitAndVerifySync(browser, 60_000)
    console.log(`[group4] uniswapV4Template: manifest=${result.manifestFileCount}, remote=${result.remoteFileCount}, ok=${result.ok}`)
  },

  'Should clone Breakthrough-Labs Hooks repo into a cloud workspace #group4': async function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)
      .click('*[data-id="workspacecreate"]')
      .waitForElementVisible('*[data-id="template-explorer-modal-react"]', 10000)
      .waitForElementVisible('*[data-id="template-explorer-template-container"]', 10000)
      // breakthroughLabsUniswapv4Hooks is in the Uniswap V4 category, index 1
      .click('*[data-id="template-card-breakthroughLabsUniswapv4Hooks-1"]')
      .waitForElementVisible('*[data-id="generic-template-section-breakthroughLabsUniswapv4Hooks"]', 10000)
      .waitForElementVisible('*[data-id="workspace-name-breakthroughLabsUniswapv4Hooks-input"]', 10000)
      // Click Finish to start cloning
      .click('*[data-id="validate-breakthroughLabsUniswapv4Hooksworkspace-button"]')
      // Wait for modal to disappear — clone completes when modal closes
      .waitForElementNotPresent('*[data-id="template-explorer-modal-react"]', 120000)
      .pause(3000)

    // Wait for sync engine to activate and push to S3
    await waitForSyncIdle(browser, 120_000)

    // Verify key files from the Uniswapv4Hooks repo exist
    browser
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemsrc"]', 30000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemlib"]', 30000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemtest"]', 30000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemfoundry.toml"]', 10000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItem.gitmodules"]', 10000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemREADME.md"]', 10000)

    // Verify sync integrity
    const result = await waitAndVerifySync(browser, 60_000)
    console.log(`[group4] breakthroughLabsUniswapv4Hooks: manifest=${result.manifestFileCount}, remote=${result.remoteFileCount}, ok=${result.ok}`)
  },

  'Should verify all cloned workspaces are listed and switchable #group4': async function (browser: NightwatchBrowser) {
    // Open workspace dropdown and verify all three cloned workspaces are listed
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)

    // Verify the workspace items exist in the dropdown (names may have suffix like "- 1")
    browser
      .waitForElementVisible({
        selector: '//*[contains(@data-id, "dropdown-item-") and contains(., "Account Abstraction")]',
        locateStrategy: 'xpath',
        timeout: 10000,
      })
      .waitForElementVisible({
        selector: '//*[contains(@data-id, "dropdown-item-") and contains(., "Uniswap v4 Template")]',
        locateStrategy: 'xpath',
        timeout: 10000,
      })
      .waitForElementVisible({
        selector: '//*[contains(@data-id, "dropdown-item-") and contains(., "Breakthrough-Labs Hooks")]',
        locateStrategy: 'xpath',
        timeout: 10000,
      })

    // Switch to Account Abstraction and verify it loads
    browser
      .click({
        selector: '//*[contains(@data-id, "dropdown-item-") and contains(., "Account Abstraction")]',
        locateStrategy: 'xpath',
      })

    await waitForSyncIdle(browser, 60_000)

    browser
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemcontracts"]', 30000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItempackage.json"]', 10000)

    // Switch to Uniswap v4 Template
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)
      .click({
        selector: '//*[contains(@data-id, "dropdown-item-") and contains(., "Uniswap v4 Template")]',
        locateStrategy: 'xpath',
      })

    await waitForSyncIdle(browser, 60_000)

    browser
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemsrc"]', 30000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemfoundry.toml"]', 10000)
      .pause()
  },

  // ── Git-init workspace + .git cloud sync + S3 restore ──

  'Should login for git-init sync tests #group5': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        localStorage.setItem('enableLogin', 'true')
      })
      .refreshPage()
      .pause(5000)
      .clickLaunchIcon('filePanel')
      .waitForElementVisible('*[data-id="login-button"]', 15000)
      .click('*[data-id="login-button"]')
      .pause(3000)
      .waitForElementVisible({
        selector: '//button[contains(., "E2E Test Pool")]',
        locateStrategy: 'xpath',
        timeout: 15000,
      })
      .click({
        selector: '//button[contains(., "E2E Test Pool")]',
        locateStrategy: 'xpath',
      })
      .pause(5000)
      // Dismiss "Git History Updated" modal if present from a previous session
      .element('css selector', '*[data-id="cloud-git-conflictModalDialogContainer-react"]', function (result) {
        if ((result as any).status !== -1 && (result as any).value) {
          browser
            .click({
              selector: '//*[@data-id="cloud-git-conflictModalDialogContainer-react"]//button[contains(., "Keep Local")]',
              locateStrategy: 'xpath',
            })
            .pause(1000)
        }
      })
      .pause(2000)
  },

  'Should create a Basic workspace with git init checked #group5': async function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)
      .click('*[data-id="workspacecreate"]')
      .waitForElementVisible('*[data-id="template-explorer-modal-react"]', 10000)
      .waitForElementVisible('*[data-id="template-explorer-template-container"]', 10000)
      // Basic (remixDefault) is in the Generic category, index 0
      .click('*[data-id="template-card-remixDefault-0"]')
      .waitForElementVisible('*[data-id="workspace-details-section"]', 10000)
      // Check "Initialize as a Git repository"
      .click('*[data-id="initGitRepositoryLabel"]')
      .pause(500)
      // Click "Create a new workspace"
      .click('*[data-id="validateWorkspaceButton"]')
      .waitForElementNotPresent('*[data-id="template-explorer-modal-react"]', 30000)
      .pause(3000)

    // Wait for file sync to complete
    await waitForSyncIdle(browser)

    // Confirm we're in the new workspace
    browser
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemcontracts"]', 10000)
  },

  'Should add a file, commit, and verify .git sync to S3 #group5': async function (browser: NightwatchBrowser) {
    // Add a custom test file
    browser
      .addFile('git-test.sol', {
        content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract GitTest {\n    string public message = "git sync test";\n}\n'
      }, 'README.txt')
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemgit-test.sol"]', 10000)

    // Wait for file sync to push to S3
    await waitForSyncIdle(browser)

    // Trigger forceGitSnapshot fire-and-forget (async not supported in execute)
    await new Promise<void>((resolve) => {
      browser.execute(
        function () {
          var engine = (window as any).cloudSyncEngine
          if (engine && engine.isActive && engine.forceGitSnapshot) {
            engine.forceGitSnapshot()
          }
        },
        [],
        () => resolve(),
      )
    })

    // Poll until lastGitZipEtag is set (confirms _git.zip pushed to S3)
    const start = Date.now()
    let gitEtag: string | null = null
    while (Date.now() - start < 90_000 && !gitEtag) {
      gitEtag = await new Promise<string | null>((resolve) => {
        browser.execute(
          function () {
            var engine = (window as any).cloudSyncEngine
            return engine && engine.lastGitZipEtag ? engine.lastGitZipEtag : null
          },
          [],
          (result: any) => resolve(result?.value || null),
        )
      })
      if (!gitEtag) {
        await new Promise((r) => setTimeout(r, 2000))
      }
    }

    console.log(`[group5] lastGitZipEtag after push: ${gitEtag}`)
    browser.assert.ok(!!gitEtag, '.git snapshot was pushed to S3 (ETag is set)')

    // Verify file sync integrity too
    const result = await waitAndVerifySync(browser, 30_000)
    console.log(`[group5] After git push: manifest=${result.manifestFileCount}, remote=${result.remoteFileCount}, ok=${result.ok}`)
  },

  'Should wipe local data and reload — workspace + .git must restore from S3 #group5': async function (browser: NightwatchBrowser) {
    // Save current workspace name for later verification
    const wsName = await new Promise<string>((resolve) => {
      browser.execute(
        function () {
          const engine = (window as any).cloudSyncEngine
          return engine?.getWorkspaceUuid() || ''
        },
        [],
        (result: any) => resolve(result?.value || ''),
      )
    })
    console.log(`[group5] Workspace UUID before wipe: ${wsName}`)

    // Wipe local IndexedDB data
    browser
      .execute(function () {
        return (window as any).remixFileSystem.unlink('.cloud-workspaces')
      }, [], function () {
        console.log('[group5] Wiped .cloud-workspaces from local FS')
      })
      .refresh()
      .waitForElementVisible('[data-id="workspacesSelect"]', 30000)

    // Wait for cloud system to restore workspaces from S3
    await waitForSyncIdle(browser, 120_000)
  },

  'Should verify workspace files restored from S3 after wipe #group5': async function (browser: NightwatchBrowser) {
    // The restored workspace should be listed — switch to it
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(2000)
      .waitForElementVisible({
        selector: '//*[contains(@data-id, "dropdown-item-") and contains(., "Basic")]',
        locateStrategy: 'xpath',
        timeout: 20000,
      })
      .click({
        selector: '//*[contains(@data-id, "dropdown-item-") and contains(., "Basic")]',
        locateStrategy: 'xpath',
      })

    await waitForSyncIdle(browser, 60_000)

    // Verify the workspace files are restored
    browser
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemcontracts"]', 20000)
      .waitForElementVisible('*[data-id="treeViewLitreeViewItemgit-test.sol"]', 20000)

    // Open the test file and verify content
    browser
      .openFile('git-test.sol')
      .pause(2000)
      .getEditorValue((content) => {
        browser.assert.ok(
          content.indexOf('contract GitTest') !== -1,
          'Restored git-test.sol contains contract GitTest'
        )
        browser.assert.ok(
          content.indexOf('git sync test') !== -1,
          'Restored git-test.sol contains "git sync test"'
        )
      })
  },

  'Should verify .git directory was restored from S3 #group5': async function (browser: NightwatchBrowser) {
    // .git is hidden in file explorer — verify via engine state and filesystem
    // Poll for lastGitZipEtag (set when _git.zip is pulled from S3 during activate)
    let restoredEtag: string | null = null
    const start = Date.now()
    while (Date.now() - start < 60000 && !restoredEtag) {
      restoredEtag = await new Promise<string | null>((resolve) => {
        browser.execute(
          function () {
            var engine = (window as any).cloudSyncEngine
            if (!engine) return JSON.stringify({ error: 'no engine' })
            return JSON.stringify({
              isActive: engine.isActive,
              wsPath: engine.localWorkspacePath,
              etag: engine.lastGitZipEtag || null,
            })
          },
          [],
          (result: any) => {
            try {
              var info = JSON.parse(result?.value || '{}')
              console.log('[group5] .git poll:', JSON.stringify(info))
              resolve(info.etag || null)
            } catch (e) {
              resolve(null)
            }
          },
        )
      })
      if (!restoredEtag) await new Promise((r) => setTimeout(r, 2000))
    }
    console.log(`[group5] lastGitZipEtag after restore: ${restoredEtag}`)
    browser.assert.ok(!!restoredEtag, '.git snapshot ETag is set — _git.zip was pulled from S3')

    // Verify .git/HEAD exists using executeAsyncScript (remixFileSystem is async-only)
    const hasGitHead = await new Promise<boolean>((resolve) => {
      browser.executeAsyncScript(
        function (done: (result: boolean) => void) {
          var engine = (window as any).cloudSyncEngine
          var fs = (window as any).remixFileSystem
          var wsPath = engine && engine.localWorkspacePath
          if (!wsPath || !fs) { done(false); return }
          fs.stat(wsPath + '/.git/HEAD')
            .then(function () { done(true) })
            .catch(function () { done(false) })
        },
        [],
        (result: any) => resolve(result?.value === true),
      )
    })
    browser.assert.ok(hasGitHead, '.git/HEAD exists in filesystem — git repository structure restored')
  },

}
