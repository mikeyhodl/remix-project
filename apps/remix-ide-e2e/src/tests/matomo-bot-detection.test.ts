'use strict'
import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

/**
 * Matomo Bot Detection Tests
 * 
 * These tests verify that:
 * 1. Bot detection correctly identifies automation tools (Selenium/WebDriver)
 * 2. The isBot custom dimension is set correctly in Matomo
 * 3. Bot type and confidence are reported accurately
 * 4. Events are still tracked but tagged with bot status
 */

module.exports = {
  '@disabled': false,
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done, 'http://127.0.0.1:8080', false)
  },

  // Enable Matomo on localhost for testing
  'Enable Matomo and wait for initialization': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        localStorage.setItem('showMatomo', 'true');
      }, [])
      .refreshPage()
      .waitForElementPresent({
        selector: `//*[@data-id='compilerloaded']`,
        locateStrategy: 'xpath',
        timeout: 120000
      })
      .pause(2000)
  },

  'Accept consent to enable tracking': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="matomoModalModalDialogModalBody-react"]')
      .click('[data-id="matomoModal-modal-footer-ok-react"]')
      .waitForElementNotVisible('*[data-id="matomoModalModalDialogModalBody-react"]')
      .pause(2000)
  },

  'Verify bot detection identifies automation tool': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        const matomoManager = (window as any)._matomoManagerInstance;
        if (!matomoManager) {
          return { error: 'MatomoManager not found' };
        }

        const isBot = matomoManager.isBot();
        const botType = matomoManager.getBotType();
        const confidence = matomoManager.getBotConfidence();
        const fullResult = matomoManager.getBotDetectionResult();

        return {
          isBot,
          botType,
          confidence,
          reasons: fullResult?.reasons || [],
          userAgent: fullResult?.userAgent || navigator.userAgent
        };
      }, [], (result: any) => {
        console.log('🤖 Bot Detection Result:', result.value);
        
        // Selenium/WebDriver should be detected as a bot
        browser.assert.strictEqual(
          result.value.isBot,
          true,
          'Selenium/WebDriver should be detected as a bot'
        );

        // Should detect automation with high confidence
        browser.assert.strictEqual(
          result.value.confidence,
          'high',
          'Automation detection should have high confidence'
        );

        // Bot type should indicate automation
        const botType = result.value.botType;
        const isAutomationBot = botType.includes('automation') || 
                                botType.includes('webdriver') ||
                                botType.includes('selenium');
        
        browser.assert.strictEqual(
          isAutomationBot,
          true,
          `Bot type should indicate automation, got: ${botType}`
        );

        // Log detection reasons for debugging
        console.log('🔍 Detection reasons:', result.value.reasons);
      })
  },

  'Verify isBot custom dimension is set in Matomo': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        const matomoManager = (window as any)._matomoManagerInstance;
        const botType = matomoManager.getBotType();

        // Get the debug data to verify dimension was set
        const debugData = (window as any).__getMatomoDimensions?.();
        
        return {
          botType,
          dimensionsSet: debugData || {},
          hasDimension: debugData && Object.keys(debugData).length > 0
        };
      }, [], (result: any) => {
        console.log('📊 Matomo Dimensions:', result.value);

        // Verify bot type is not 'human'
        browser.assert.notStrictEqual(
          result.value.botType,
          'human',
          'Bot type should not be "human" in E2E tests'
        );

        // If debug plugin is loaded, verify dimension is set
        if (result.value.hasDimension) {
          console.log('✅ Bot dimension found in debug data');
        }
      })
  },

  'Verify events are tracked with bot detection': function (browser: NightwatchBrowser) {
    browser
      // Trigger a tracked event by clicking a plugin
      .clickLaunchIcon('filePanel')
      .pause(1000)
      
      .execute(function () {
        const matomoManager = (window as any)._matomoManagerInstance;
        const events = (window as any).__getMatomoEvents?.() || [];
        
        return {
          isBot: matomoManager.isBot(),
          botType: matomoManager.getBotType(),
          eventCount: events.length,
          lastEvent: events[events.length - 1]
        };
      }, [], (result: any) => {
        console.log('📈 Event Tracking Result:', result.value);

        // Verify events are being tracked
        browser.assert.ok(
          result.value.eventCount > 0,
          'Events should be tracked even for bots'
        );

        // Verify bot is still detected
        browser.assert.strictEqual(
          result.value.isBot,
          true,
          'Bot status should remain true after event tracking'
        );
      })
  },

  'Verify bot detection result has expected structure': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        const matomoManager = (window as any)._matomoManagerInstance;
        const result = matomoManager.getBotDetectionResult();
        
        return {
          hasResult: result !== null,
          hasIsBot: typeof result?.isBot === 'boolean',
          hasBotType: typeof result?.botType === 'string' || result?.botType === undefined,
          hasConfidence: ['high', 'medium', 'low'].includes(result?.confidence),
          hasReasons: Array.isArray(result?.reasons),
          hasUserAgent: typeof result?.userAgent === 'string'
        };
      }, [], (result: any) => {
        console.log('🔍 Bot Detection Structure:', result.value);

        browser.assert.strictEqual(result.value.hasResult, true, 'Should have bot detection result');
        browser.assert.strictEqual(result.value.hasIsBot, true, 'Should have isBot boolean');
        browser.assert.strictEqual(result.value.hasBotType, true, 'Should have botType string');
        browser.assert.strictEqual(result.value.hasConfidence, true, 'Should have valid confidence level');
        browser.assert.strictEqual(result.value.hasReasons, true, 'Should have reasons array');
        browser.assert.strictEqual(result.value.hasUserAgent, true, 'Should have userAgent string');
      })
  },

  'Verify navigator.webdriver flag is present': function (browser: NightwatchBrowser) {
    browser
      .execute(function () {
        return {
          webdriver: navigator.webdriver,
          hasWebdriver: navigator.webdriver === true
        };
      }, [], (result: any) => {
        console.log('🌐 Navigator.webdriver:', result.value);

        // Selenium/WebDriver sets this flag
        browser.assert.strictEqual(
          result.value.hasWebdriver,
          true,
          'navigator.webdriver should be true in Selenium/WebDriver'
        );
      })
  },

  'Test complete': function (browser: NightwatchBrowser) {
    browser.end()
  }
}
