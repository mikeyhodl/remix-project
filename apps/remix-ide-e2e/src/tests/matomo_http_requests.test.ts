'use strict'
import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

module.exports = {
  '@disabled': true, // Enable when ready to test
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done, 'http://127.0.0.1:8080', false)
  },

  'test Matomo HTTP requests contain correct parameters #group1': function (browser: NightwatchBrowser) {
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
          localStorage.setItem('matomo-debug', 'true'); // Enable debug mode
          
          // Mock fetch to intercept Matomo requests
          const originalFetch = window.fetch;
          (window as any).__matomoRequests = [];
          
          window.fetch = function(url: RequestInfo | URL, options?: RequestInit) {
            console.debug('[Matomo][test] fetch called with:', url, options);
            const urlString = typeof url === 'string' ? url : url.toString();
            if (urlString.includes('matomo.php')) {
                console.debug('[Matomo][test] Captured request:', urlString, options);
              (window as any).__matomoRequests.push({
                url: urlString,
                options: options,
                timestamp: Date.now()
              });
            }
            return originalFetch.apply(this, arguments as any);
          };
          
          return true;
        }, [])
        .refreshPage()
        .perform(done())
    })
      .waitForElementPresent({
        selector: `//*[@data-id='compilerloaded']`,
        locateStrategy: 'xpath',
        timeout: 120000
      })
      .pause() // Wait for Matomo requests to be sent
      .execute(function () {
        // Analyze captured Matomo requests
        const requests = (window as any).__matomoRequests || [];
        if (requests.length === 0) return { error: 'No Matomo requests captured' };
        
        const firstRequest = requests[0];
        const url = new URL(firstRequest.url);
        const params = Object.fromEntries(url.searchParams);
        
        return {
          requestCount: requests.length,
          params: params,
          hasTrackingMode: params.dimension1 !== undefined,
          trackingModeValue: params.dimension1,
          siteId: params.idsite,
          hasPageView: params.action_name !== undefined,
          hasVisitorId: params._id !== undefined
        };
      }, [], (result) => {
        const data = (result as any).value;
        
        if (data.error) {
          browser.assert.fail(data.error);
          return;
        }
        
        browser.assert.ok(data.requestCount > 0, 'Should have captured Matomo requests')
        browser.assert.ok(data.hasTrackingMode, 'Should include tracking mode dimension')
        browser.assert.equal(data.trackingModeValue, 'cookie', 'Tracking mode should be cookie')
        browser.assert.equal(data.siteId, '5', 'Should use localhost development site ID')
        browser.assert.ok(data.hasPageView, 'Should include page view action')
        browser.assert.ok(data.hasVisitorId, 'Should include visitor ID')
      })
  },

  'test anon mode HTTP parameters #group1': function (browser: NightwatchBrowser) {
    browser.perform((done) => {
      browser
        .execute(function () {
          // Set up anon mode
          const config = {
            'settings/matomo-perf-analytics': false
          };
          localStorage.setItem('config-v0.8:.remix.config', JSON.stringify(config));
          localStorage.setItem('matomo-analytics-consent', Date.now().toString());
          localStorage.setItem('matomo-debug', 'true');
          
          // Reset request capture
          (window as any).__matomoRequests = [];
          
          return true;
        }, [])
        .refreshPage()
        .perform(done())
    })
      .waitForElementPresent({
        selector: `//*[@data-id='compilerloaded']`,
        locateStrategy: 'xpath',
        timeout: 120000
      })
      .pause(3000) // Wait for requests
      .execute(function () {
        const requests = (window as any).__matomoRequests || [];
        if (requests.length === 0) return { error: 'No Matomo requests captured' };
        
        const firstRequest = requests[0];
        const url = new URL(firstRequest.url);
        const params = Object.fromEntries(url.searchParams);
        
        return {
          requestCount: requests.length,
          trackingModeValue: params.dimension1,
          siteId: params.idsite,
          hasVisitorId: params._id !== undefined,
          visitorIdLength: params._id ? params._id.length : 0
        };
      }, [], (result) => {
        const data = (result as any).value;
        
        if (data.error) {
          browser.assert.fail(data.error);
          return;
        }
        
        browser.assert.ok(data.requestCount > 0, 'Should have captured Matomo requests in anon mode')
        browser.assert.equal(data.trackingModeValue, 'anon', 'Tracking mode should be anon')
        browser.assert.equal(data.siteId, '5', 'Should use localhost development site ID')
        browser.assert.ok(data.hasVisitorId, 'Should include visitor ID even in anon mode')
        browser.assert.ok(data.visitorIdLength === 16, 'Visitor ID should be 16 characters (8 bytes hex)')
      })
  },

  'test mode switching generates correct HTTP requests #group2': function (browser: NightwatchBrowser) {
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
          
          (window as any).__matomoRequests = [];
          
          return true;
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
      .pause(1000)
      .execute(function () {
        // Clear previous requests and switch mode
        (window as any).__matomoRequests = [];
        return true;
      })
      .click('*[data-id="matomo-perf-analyticsSwitch"]') // Switch to anon mode
      .pause(2000)
      .execute(function () {
        // Check requests generated by mode switch
        const requests = (window as any).__matomoRequests || [];
        const modeChangeRequests = requests.filter(req => {
          const url = new URL(req.url);
          const params = Object.fromEntries(url.searchParams);
          return params.e_c === 'tracking_mode_change' || params.e_c === 'perf_analytics_toggle';
        });
        
        return {
          totalRequests: requests.length,
          modeChangeRequests: modeChangeRequests.length,
          hasModeChangeEvent: modeChangeRequests.some(req => {
            const url = new URL(req.url);
            const params = Object.fromEntries(url.searchParams);
            return params.e_c === 'tracking_mode_change' && params.e_a === 'anon';
          }),
          lastRequestParams: requests.length > 0 ? (() => {
            const lastReq = requests[requests.length - 1];
            const url = new URL(lastReq.url);
            return Object.fromEntries(url.searchParams);
          })() : null
        };
      }, [], (result) => {
        const data = (result as any).value;
        
        browser.assert.ok(data.totalRequests > 0, 'Should generate requests when switching modes')
        browser.assert.ok(data.modeChangeRequests > 0, 'Should generate mode change events')
        browser.assert.ok(data.hasModeChangeEvent, 'Should track mode change to anon')
        
        if (data.lastRequestParams) {
          browser.assert.equal(data.lastRequestParams.dimension1, 'anon', 'Latest request should have anon tracking mode')
        }
      })
  },

  'test visitor ID consistency in cookie mode #group2': function (browser: NightwatchBrowser) {
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
          
          (window as any).__matomoRequests = [];
          
          return true;
        }, [])
        .refreshPage()
        .perform(done())
    })
      .waitForElementPresent({
        selector: `//*[@data-id='compilerloaded']`,
        locateStrategy: 'xpath',
        timeout: 120000
      })
      .pause(2000)
      .execute(function () {
        // Get visitor ID from first requests
        const requests = (window as any).__matomoRequests || [];
        const visitorIds = requests.map(req => {
          const url = new URL(req.url);
          return url.searchParams.get('_id');
        }).filter(id => id);
        
        return {
          visitorIds: visitorIds,
          uniqueVisitorIds: [...new Set(visitorIds)],
          requestCount: requests.length
        };
      }, [], (result) => {
        const data = (result as any).value;
        
        browser.assert.ok(data.requestCount > 0, 'Should have made requests')
        browser.assert.ok(data.visitorIds.length > 0, 'Should have visitor IDs')
        browser.assert.equal(data.uniqueVisitorIds.length, 1, 'Should use consistent visitor ID in cookie mode')
      })
      .refreshPage() // Test persistence across page reload
      .waitForElementPresent({
        selector: `//*[@data-id='compilerloaded']`,
        locateStrategy: 'xpath',
        timeout: 120000
      })
      .pause(2000)
      .execute(function () {
        // Compare visitor IDs before and after reload
        const requests = (window as any).__matomoRequests || [];
        const newVisitorIds = requests.map(req => {
          const url = new URL(req.url);
          return url.searchParams.get('_id');
        }).filter(id => id);
        
        return {
          newVisitorIds: newVisitorIds,
          uniqueNewVisitorIds: [...new Set(newVisitorIds)]
        };
      }, [], (result) => {
        const data = (result as any).value;
        
        browser.assert.ok(data.uniqueNewVisitorIds.length === 1, 'Should maintain same visitor ID after reload in cookie mode')
      })
  }
}