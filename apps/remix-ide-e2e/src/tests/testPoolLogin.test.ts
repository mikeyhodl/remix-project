'use strict'
import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'
import { releaseAccount } from '../helpers/pool'
import { waitAndVerifySync } from '../helpers/cloud-sync-verify'

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

  'Should create a cloud workspace #group2': function (browser: NightwatchBrowser) {
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
      // Wait for workspace to initialize and cloud sync engine to activate
      .currentWorkspaceIs('e2e-sync-test')
      .pause(15000)
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
    // Wait for the automatic sync timer (10s interval) to pick up changes
    browser.pause(15000)

    // Now verify the manifest matches S3 reality
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

    // Wait for auto-sync to push the edit
    browser.pause(15000)

    // Verify again — the updated ETag should match
    const result = await waitAndVerifySync(browser, 30_000)
    console.log(`[TestPoolLogin:SyncVerify] After edit: manifest=${result.manifestFileCount}, remote=${result.remoteFileCount}, ok=${result.ok}`)
  },

  'Should delete the file and verify sync reflects deletion #group2': async function (browser: NightwatchBrowser) {
    // Delete the file through the real UI: right-click → Delete → confirm modal
    browser
      .removeFile('test-sync.sol', 'e2e-sync-test')

    // Wait for auto-sync to propagate the deletion
    browser.pause(15000)

    // Verify — the deleted file should not appear as phantom or missing
    const result = await waitAndVerifySync(browser, 30_000)
    console.log(`[TestPoolLogin:SyncVerify] After delete: manifest=${result.manifestFileCount}, remote=${result.remoteFileCount}, ok=${result.ok}`)
  },

}
