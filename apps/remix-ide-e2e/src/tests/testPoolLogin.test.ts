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

}
