'use strict'
import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'
import { releaseAccount } from '../helpers/pool'

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

}
