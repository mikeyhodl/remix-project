'use strict'
import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

module.exports = {
  '@disabled': false,
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done, 'http://127.0.0.1:8080', false)
  },

  'validate cookie mode parameters from Performance API #group1': function (browser: NightwatchBrowser) {
    browser.perform((done) => {
      browser
        .execute(function () {
          // Set up cookie mode
          const config = {
            'settings/matomo-perf-analytics': true
          };
          localStorage.setItem('config-v0.8:.remix.config', JSON.stringify(config));
          localStorage.setItem('matomo-analytics-consent', Date.now().toString());
          localStorage.setItem('matomo-localhost-enabled', 'true');
          localStorage.setItem('showMatomo', 'true');
          localStorage.setItem('matomo-debug', 'true');
          
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
      .pause(5000) // Wait for Matomo to initialize and send requests
      .execute(function () {
        // Use Performance API to get actual sent requests
        if (!window.performance || !window.performance.getEntriesByType) {
          return { error: 'Performance API not available' };
        }
        
        const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const matomoRequests = resources.filter(resource => 
          resource.name.includes('matomo.php') && resource.name.includes('?')
        );
        
        return {
          totalMatomoRequests: matomoRequests.length,
          requests: matomoRequests.map(request => {
            const url = new URL(request.name);
            const params: Record<string, string> = {};
            
            // Extract all URL parameters
            for (const [key, value] of url.searchParams.entries()) {
              params[key] = value;
            }
            
            return {
              url: request.name,
              params,
              duration: request.duration,
              type: request.initiatorType
            };
          })
        };
      }, [], (result) => {
        const data = (result as any).value;
        
        if (data.error) {
          browser.assert.ok(false, `Performance API error: ${data.error}`);
          return;
        }
        
        console.log('[Test] Cookie mode - found', data.totalMatomoRequests, 'Matomo requests');
        
        browser.assert.ok(data.totalMatomoRequests > 0, `Should have sent Matomo requests (found ${data.totalMatomoRequests})`);
        
        if (data.requests.length > 0) {
          let foundValidRequest = false;
          
          for (let i = 0; i < data.requests.length; i++) {
            const request = data.requests[i];
            const params = request.params;
            
            console.log(`[Test] Request ${i + 1} parameters:`, Object.keys(params).length, 'params');
            
            // Check for key parameters
            if (params.idsite && params.dimension1) {
              foundValidRequest = true;
              
              console.log(`[Test] Key parameters: idsite=${params.idsite}, dimension1=${params.dimension1}, cookie=${params.cookie}`);
              
              // Validate cookie mode parameters
              browser.assert.equal(params.idsite, '5', 'Should use site ID 5 for 127.0.0.1');
              browser.assert.equal(params.dimension1, 'cookie', 'Should be in cookie mode');
              
              if (params.cookie !== undefined) {
                browser.assert.equal(params.cookie, '1', 'Should have cookies enabled');
              }
              
              break; // Found what we need
            }
          }
          
          browser.assert.ok(foundValidRequest, 'Should have found at least one request with required parameters');
        }
      })
  },

  'validate anonymous mode parameters from Performance API #group1': function (browser: NightwatchBrowser) {
    browser.perform((done) => {
      browser
        .execute(function () {
          // Set up anonymous mode - remove consent
          const config = {
            'settings/matomo-perf-analytics': true
          };
          localStorage.setItem('config-v0.8:.remix.config', JSON.stringify(config));
          localStorage.removeItem('matomo-analytics-consent'); // Remove consent for anon mode
          localStorage.setItem('matomo-localhost-enabled', 'true');
          localStorage.setItem('showMatomo', 'true');
          localStorage.setItem('matomo-debug', 'true');
          
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
      .pause(5000) // Wait for Matomo to initialize and send requests
      .execute(function () {
        // Use Performance API to get actual sent requests
        if (!window.performance || !window.performance.getEntriesByType) {
          return { error: 'Performance API not available' };
        }
        
        const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const matomoRequests = resources.filter(resource => 
          resource.name.includes('matomo.php') && resource.name.includes('?')
        );
        
        return {
          totalMatomoRequests: matomoRequests.length,
          requests: matomoRequests.map(request => {
            const url = new URL(request.name);
            const params: Record<string, string> = {};
            
            // Extract all URL parameters
            for (const [key, value] of url.searchParams.entries()) {
              params[key] = value;
            }
            
            return {
              url: request.name,
              params,
              duration: request.duration,
              type: request.initiatorType
            };
          })
        };
      }, [], (result) => {
        const data = (result as any).value;
        
        if (data.error) {
          browser.assert.ok(false, `Performance API error: ${data.error}`);
          return;
        }
        
        console.log('[Test] Anonymous mode - found', data.totalMatomoRequests, 'Matomo requests');
        
        browser.assert.ok(data.totalMatomoRequests > 0, `Should have sent Matomo requests (found ${data.totalMatomoRequests})`);
        
        if (data.requests.length > 0) {
          let foundValidRequest = false;
          
          for (let i = 0; i < data.requests.length; i++) {
            const request = data.requests[i];
            const params = request.params;
            
            console.log(`[Test] Request ${i + 1} parameters:`, Object.keys(params).length, 'params');
            
            // Check for key parameters
            if (params.idsite && params.dimension1) {
              foundValidRequest = true;
              
              console.log(`[Test] Key parameters: idsite=${params.idsite}, dimension1=${params.dimension1}, cookie=${params.cookie}`);
              
              // Validate anonymous mode parameters
              browser.assert.equal(params.idsite, '5', 'Should use site ID 5 for 127.0.0.1');
              browser.assert.equal(params.dimension1, 'anon', 'Should be in anonymous mode');
              
              if (params.cookie !== undefined) {
                browser.assert.equal(params.cookie, '0', 'Should have cookies disabled');
              }
              
              break; // Found what we need
            }
          }
          
          browser.assert.ok(foundValidRequest, 'Should have found at least one request with required parameters');
        }
      })
  },

  'validate Matomo configuration and setup #group1': function (browser: NightwatchBrowser) {
    browser.perform((done) => {
      browser
        .execute(function () {
          // Set up cookie mode for configuration test
          const config = {
            'settings/matomo-perf-analytics': true
          };
          localStorage.setItem('config-v0.8:.remix.config', JSON.stringify(config));
          localStorage.setItem('matomo-analytics-consent', Date.now().toString());
          localStorage.setItem('matomo-localhost-enabled', 'true');
          localStorage.setItem('showMatomo', 'true');
          localStorage.setItem('matomo-debug', 'true');
          
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
      .pause(3000) // Wait for Matomo to initialize
      .execute(function () {
        // Check Matomo setup and configuration
        const _paq = (window as any)._paq;
        const Matomo = (window as any).Matomo;
        const tracker = Matomo?.getAsyncTracker?.();
        const siteIds = (window as any).__MATOMO_SITE_IDS__;
        
        const config = {
          hasPaq: !!_paq,
          paqType: Array.isArray(_paq) ? 'array' : typeof _paq,
          hasMatomo: !!Matomo,
          hasTracker: !!tracker,
          hasSiteIds: !!siteIds,
          siteIds: siteIds,
          trackerUrl: tracker?.getTrackerUrl?.() || 'not available',
          matomoInitialized: Matomo?.initialized || false
        };
        
        return config;
      }, [], (result) => {
        const data = (result as any).value;
        
        console.log('[Test] Matomo configuration check:', data);
        
        // Validate setup
        browser.assert.ok(data.hasMatomo, 'Should have Matomo global object');
        browser.assert.ok(data.hasTracker, 'Should have tracker instance');
        browser.assert.ok(data.hasSiteIds, 'Should have site IDs mapping');
        
        if (data.siteIds) {
          browser.assert.ok(data.siteIds['127.0.0.1'], 'Should have mapping for 127.0.0.1');
          browser.assert.equal(data.siteIds['127.0.0.1'], 5, 'Should map 127.0.0.1 to site ID 5');
        }
        
        if (data.trackerUrl && data.trackerUrl !== 'not available') {
          browser.assert.ok(data.trackerUrl.includes('matomo'), 'Tracker URL should contain matomo');
        }
      })
  }
}