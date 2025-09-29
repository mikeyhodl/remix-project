'use strict'
import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

module.exports = {
  '@disabled': true, // Enable when ready to test
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done, 'http://127.0.0.1:8080', false)
  },

  'test cookie mode tracking setup #group1': function (browser: NightwatchBrowser) {
    browser.perform((done) => {
      browser
        .execute(function () {
          // Clear state and set up cookie mode
          localStorage.removeItem('config-v0.8:.remix.config')
          localStorage.removeItem('matomo-analytics-consent')
          // Enable localhost testing and debug mode
          localStorage.setItem('matomo-localhost-enabled', 'true')
          localStorage.setItem('showMatomo', 'true')
          localStorage.setItem('matomo-debug', 'true')
        }, [])
        .refreshPage()
        .perform(done())
    })
      .waitForElementPresent({
        selector: `//*[@data-id='compilerloaded']`,
        locateStrategy: 'xpath',
        timeout: 120000
      })
      .waitForElementVisible('*[data-id="matomoModalModalDialogModalBody-react"]')
      .click('[data-id="matomoModal-modal-footer-ok-react"]') // Accept all (cookie mode)
      .waitForElementNotVisible('*[data-id="matomoModalModalDialogModalBody-react"]')
      .execute(function () {
        // Verify cookie mode is active
        const _paq = (window as any)._paq || [];
        return {
          hasCookieConsent: _paq.some(item => 
            Array.isArray(item) && item[0] === 'setConsentGiven'
          ),
          hasTrackingMode: _paq.some(item => 
            Array.isArray(item) && item[0] === 'setCustomDimension' && 
            item[1] === 1 && item[2] === 'cookie'
          ),
          hasDisableCookies: _paq.some(item => 
            Array.isArray(item) && item[0] === 'disableCookies'
          )
        };
      }, [], (result) => {
        browser.assert.ok((result as any).value.hasCookieConsent, 'Cookie consent should be granted in cookie mode')
        browser.assert.ok((result as any).value.hasTrackingMode, 'Tracking mode dimension should be set to cookie')
        browser.assert.ok(!(result as any).value.hasDisableCookies, 'Cookies should NOT be disabled in cookie mode')
      })
  },

  'test anon mode tracking setup #group1': function (browser: NightwatchBrowser) {
    browser.perform((done) => {
      browser
        .execute(function () {
          // Clear state
          localStorage.removeItem('config-v0.8:.remix.config')
          localStorage.removeItem('matomo-analytics-consent')
          // Enable localhost testing and debug mode
          localStorage.setItem('matomo-localhost-enabled', 'true')
          localStorage.setItem('showMatomo', 'true')
          localStorage.setItem('matomo-debug', 'true')
        }, [])
        .refreshPage()
        .perform(done())
    })
      .waitForElementPresent({
        selector: `//*[@data-id='compilerloaded']`,
        locateStrategy: 'xpath',
        timeout: 120000
      })
      .waitForElementVisible('*[data-id="matomoModalModalDialogModalBody-react"]')
      .waitForElementVisible('*[data-id="matomoModal-modal-footer-cancel-react"]')
      .click('[data-id="matomoModal-modal-footer-cancel-react"]') // Manage Preferences
      .waitForElementVisible('*[data-id="managePreferencesModalModalDialogModalBody-react"]')
      .waitForElementVisible('*[data-id="matomoPerfAnalyticsToggleSwitch"]')
      .click('*[data-id="matomoPerfAnalyticsToggleSwitch"]') // Disable perf analytics (anon mode)
      .click('[data-id="managePreferencesModal-modal-footer-ok-react"]') // Save
      .waitForElementNotVisible('*[data-id="managePreferencesModalModalDialogModalBody-react"]')
      .execute(function () {
        // Verify anon mode is active
        const _paq = (window as any)._paq || [];
        return {
          hasDisableCookies: _paq.some(item => 
            Array.isArray(item) && item[0] === 'disableCookies'
          ),
          hasTrackingMode: _paq.some(item => 
            Array.isArray(item) && item[0] === 'setCustomDimension' && 
            item[1] === 1 && item[2] === 'anon'
          ),
          hasConsentGiven: _paq.some(item => 
            Array.isArray(item) && item[0] === 'setConsentGiven'
          )
        };
      }, [], (result) => {
        browser.assert.ok((result as any).value.hasDisableCookies, 'Cookies should be disabled in anon mode')
        browser.assert.ok((result as any).value.hasTrackingMode, 'Tracking mode dimension should be set to anon')
        // In anon mode, we might still have setConsentGiven but cookies are disabled
      })
  },

  'test mode switching cookie to anon #group2': function (browser: NightwatchBrowser) {
    browser.perform((done) => {
      browser
        .execute(function () {
          // Start in cookie mode
          const config = {
            'settings/matomo-perf-analytics': true
          };
          localStorage.setItem('config-v0.8:.remix.config', JSON.stringify(config));
          localStorage.setItem('matomo-analytics-consent', Date.now().toString());
          // Enable localhost testing and debug mode
          localStorage.setItem('matomo-localhost-enabled', 'true');
          localStorage.setItem('showMatomo', 'true');
          localStorage.setItem('matomo-debug', 'true');
        }, [])
        .refreshPage()
        .perform(done())
    })
      .waitForElementPresent({
        selector: `//*[@data-id='compilerloaded']`,
        locateStrategy: 'xpath',
        timeout: 120000
      })
      .waitForElementVisible('*[data-id="topbar-settingsIcon"]')
      .click('*[data-id="topbar-settingsIcon"]')
      .waitForElementVisible('*[data-id="settings-sidebar-analytics"]')
      .click('*[data-id="settings-sidebar-analytics"]')
      .waitForElementVisible('*[data-id="matomo-perf-analyticsSwitch"]')
      .verify.elementPresent('[data-id="matomo-perf-analyticsSwitch"] .fa-toggle-on') // Verify cookie mode
      .click('*[data-id="matomo-perf-analyticsSwitch"]') // Switch to anon mode
      .pause(2000)
      .execute(function () {
        // Verify mode switch events
        const _paq = (window as any)._paq || [];
        return {
          hasDeleteCookies: _paq.some(item => 
            Array.isArray(item) && item[0] === 'deleteCookies'
          ),
          hasModeChangeEvent: _paq.some(item => 
            Array.isArray(item) && item[0] === 'trackEvent' && 
            item[1] === 'tracking_mode_change' && item[2] === 'anon'
          ),
          hasAnonDimension: _paq.some(item => 
            Array.isArray(item) && item[0] === 'setCustomDimension' && 
            item[1] === 1 && item[2] === 'anon'
          )
        };
      }, [], (result) => {
        browser.assert.ok((result as any).value.hasDeleteCookies, 'Cookies should be deleted when switching to anon mode')
        browser.assert.ok((result as any).value.hasModeChangeEvent, 'Mode change event should be tracked')
        browser.assert.ok((result as any).value.hasAnonDimension, 'Tracking mode should be updated to anon')
      })
  },

  'test mode switching anon to cookie #group2': function (browser: NightwatchBrowser) {
    browser.perform((done) => {
      browser
        .execute(function () {
          // Start in anon mode
          const config = {
            'settings/matomo-perf-analytics': false
          };
          localStorage.setItem('config-v0.8:.remix.config', JSON.stringify(config));
          localStorage.setItem('matomo-analytics-consent', Date.now().toString());
          // Enable localhost testing and debug mode
          localStorage.setItem('matomo-localhost-enabled', 'true');
          localStorage.setItem('showMatomo', 'true');
          localStorage.setItem('matomo-debug', 'true');
        }, [])
        .refreshPage()
        .perform(done())
    })
      .waitForElementPresent({
        selector: `//*[@data-id='compilerloaded']`,
        locateStrategy: 'xpath',
        timeout: 120000
      })
      .waitForElementVisible('*[data-id="topbar-settingsIcon"]')
      .click('*[data-id="topbar-settingsIcon"]')
      .waitForElementVisible('*[data-id="settings-sidebar-analytics"]')
      .click('*[data-id="settings-sidebar-analytics"]')
      .waitForElementVisible('*[data-id="matomo-perf-analyticsSwitch"]')
      .verify.elementPresent('[data-id="matomo-perf-analyticsSwitch"] .fa-toggle-off') // Verify anon mode
      .click('*[data-id="matomo-perf-analyticsSwitch"]') // Switch to cookie mode
      .pause(2000)
      .execute(function () {
        // Verify mode switch events
        const _paq = (window as any)._paq || [];
        return {
          hasConsentGiven: _paq.some(item => 
            Array.isArray(item) && item[0] === 'setConsentGiven'
          ),
          hasModeChangeEvent: _paq.some(item => 
            Array.isArray(item) && item[0] === 'trackEvent' && 
            item[1] === 'tracking_mode_change' && item[2] === 'cookie'
          ),
          hasCookieDimension: _paq.some(item => 
            Array.isArray(item) && item[0] === 'setCustomDimension' && 
            item[1] === 1 && item[2] === 'cookie'
          )
        };
      }, [], (result) => {
        browser.assert.ok((result as any).value.hasConsentGiven, 'Cookie consent should be granted when switching to cookie mode')
        browser.assert.ok((result as any).value.hasModeChangeEvent, 'Mode change event should be tracked')
        browser.assert.ok((result as any).value.hasCookieDimension, 'Tracking mode should be updated to cookie')
      })
  },

  'test tracking events in cookie mode #group3': function (browser: NightwatchBrowser) {
    browser.perform((done) => {
      browser
        .execute(function () {
          // Set up cookie mode
          const config = {
            'settings/matomo-perf-analytics': true
          };
          localStorage.setItem('config-v0.8:.remix.config', JSON.stringify(config));
          localStorage.setItem('matomo-analytics-consent', Date.now().toString());
          // Enable localhost testing and debug mode
          localStorage.setItem('matomo-localhost-enabled', 'true');
          localStorage.setItem('showMatomo', 'true');
          localStorage.setItem('matomo-debug', 'true');
        }, [])
        .refreshPage()
        .perform(done())
    })
      .waitForElementPresent({
        selector: `//*[@data-id='compilerloaded']`,
        locateStrategy: 'xpath',
        timeout: 120000
      })
      .pause(2000) // Let tracking initialize
      .execute(function () {
        // Trigger a trackable action (e.g., compile)
        // This should generate events that are tracked with cookie mode dimension
        return (window as any)._paq || [];
      }, [], (result) => {
        const _paq = (result as any).value;
        // Verify that events include the cookie mode dimension
        const hasPageView = _paq.some(item => 
          Array.isArray(item) && item[0] === 'trackPageView'
        );
        const hasCookieMode = _paq.some(item => 
          Array.isArray(item) && item[0] === 'setCustomDimension' && 
          item[1] === 1 && item[2] === 'cookie'
        );
        
        browser.assert.ok(hasPageView, 'Page view should be tracked in cookie mode')
        browser.assert.ok(hasCookieMode, 'Cookie mode dimension should be set')
      })
  },

  'test tracking events in anon mode #group3': function (browser: NightwatchBrowser) {
    browser.perform((done) => {
      browser
        .execute(function () {
          // Set up anon mode
          const config = {
            'settings/matomo-perf-analytics': false
          };
          localStorage.setItem('config-v0.8:.remix.config', JSON.stringify(config));
          localStorage.setItem('matomo-analytics-consent', Date.now().toString());
          // Enable localhost testing and debug mode
          localStorage.setItem('matomo-localhost-enabled', 'true');
          localStorage.setItem('showMatomo', 'true');
          localStorage.setItem('matomo-debug', 'true');
        }, [])
        .refreshPage()
        .perform(done())
    })
      .waitForElementPresent({
        selector: `//*[@data-id='compilerloaded']`,
        locateStrategy: 'xpath',
        timeout: 120000
      })
      .pause(2000) // Let tracking initialize
      .execute(function () {
        // Check that anon mode is properly configured
        return (window as any)._paq || [];
      }, [], (result) => {
        const _paq = (result as any).value;
        // Verify anon mode setup
        const hasPageView = _paq.some(item => 
          Array.isArray(item) && item[0] === 'trackPageView'
        );
        const hasAnonMode = _paq.some(item => 
          Array.isArray(item) && item[0] === 'setCustomDimension' && 
          item[1] === 1 && item[2] === 'anon'
        );
        const hasCookiesDisabled = _paq.some(item => 
          Array.isArray(item) && item[0] === 'disableCookies'
        );
        
        browser.assert.ok(hasPageView, 'Page view should be tracked in anon mode')
        browser.assert.ok(hasAnonMode, 'Anon mode dimension should be set')
        browser.assert.ok(hasCookiesDisabled, 'Cookies should be disabled in anon mode')
      })
  },

  'test localhost debug mode activation #group4': function (browser: NightwatchBrowser) {
    browser.perform((done) => {
      browser
        .execute(function () {
          // Enable localhost testing and debug mode (redundant but explicit for this test)
          localStorage.setItem('matomo-localhost-enabled', 'true');
          localStorage.setItem('showMatomo', 'true');
          localStorage.setItem('matomo-debug', 'true');
        }, [])
        .refreshPage()
        .perform(done())
    })
      .waitForElementPresent({
        selector: `//*[@data-id='compilerloaded']`,
        locateStrategy: 'xpath',
        timeout: 120000
      })
      .execute(function () {
        // Check if localhost tracking is active with debug
        const _paq = (window as any)._paq || [];
        return {
          hasDebugEvent: _paq.some(item => 
            Array.isArray(item) && item[0] === 'trackEvent' && 
            item[1] === 'debug'
          ),
          siteId: _paq.find(item => 
            Array.isArray(item) && item[0] === 'setSiteId'
          )?.[1],
          trackerUrl: _paq.find(item => 
            Array.isArray(item) && item[0] === 'setTrackerUrl'
          )?.[1]
        };
      }, [], (result) => {
        const data = (result as any).value;
        browser.assert.ok(data.siteId === 5, 'Should use localhost web dev site ID (5)')
        browser.assert.ok(data.trackerUrl && data.trackerUrl.includes('matomo.remix.live'), 'Should use correct tracker URL')
      })
  },

  'test persistence across page reloads #group4': function (browser: NightwatchBrowser) {
    browser.perform((done) => {
      browser
        .execute(function () {
          // Set cookie mode preference
          const config = {
            'settings/matomo-perf-analytics': true
          };
          localStorage.setItem('config-v0.8:.remix.config', JSON.stringify(config));
          localStorage.setItem('matomo-analytics-consent', Date.now().toString());
          // Enable localhost testing and debug mode
          localStorage.setItem('matomo-localhost-enabled', 'true');
          localStorage.setItem('showMatomo', 'true');
          localStorage.setItem('matomo-debug', 'true');
        }, [])
        .refreshPage()
        .perform(done())
    })
      .waitForElementPresent({
        selector: `//*[@data-id='compilerloaded']`,
        locateStrategy: 'xpath',
        timeout: 120000
      })
      .pause(1000)
      .refreshPage() // Second reload to test persistence
      .waitForElementPresent({
        selector: `//*[@data-id='compilerloaded']`,
        locateStrategy: 'xpath',
        timeout: 120000
      })
      .execute(function () {
        // Verify mode persisted across reloads
        const config = JSON.parse(localStorage.getItem('config-v0.8:.remix.config') || '{}');
        const _paq = (window as any)._paq || [];
        
        return {
          perfAnalytics: config['settings/matomo-perf-analytics'],
          hasCookieMode: _paq.some(item => 
            Array.isArray(item) && item[0] === 'setCustomDimension' && 
            item[1] === 1 && item[2] === 'cookie'
          )
        };
      }, [], (result) => {
        const data = (result as any).value;
        browser.assert.ok(data.perfAnalytics === true, 'Performance analytics setting should persist')
        browser.assert.ok(data.hasCookieMode, 'Cookie mode should be restored after reload')
      })
  }
}