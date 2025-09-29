'use strict'
import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

module.exports = {
  '@disabled': false, // Enable for testing the approach
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done, 'http://127.0.0.1:8080', false)
  },

  'debug Matomo tracking approach - check _paq array #group1': function (browser: NightwatchBrowser) {
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
      .pause(5000) // Wait for Matomo to initialize
      .execute(function () {
        // Check what's available for inspection
        const _paq = (window as any)._paq;
        const matomoTracker = (window as any).Matomo?.getTracker?.();
        
        // _paq gets replaced by Matomo script, so check what type it is
        const paqType = Array.isArray(_paq) ? 'array' : typeof _paq;
        const paqLength = Array.isArray(_paq) ? _paq.length : (_paq?.length || 0);
        
        let paqSample = [];
        let allCommands = [];
        
        if (Array.isArray(_paq)) {
          // Still an array (before Matomo script loads)
          paqSample = _paq.slice(0, 10).map(item => 
            Array.isArray(item) ? item.join('|') : String(item)
          );
          allCommands = _paq.filter(item => Array.isArray(item)).map(item => item[0]);
        } else if (_paq && typeof _paq === 'object') {
          // Matomo has loaded and _paq is now a tracker object
          paqSample = ['Matomo tracker object loaded'];
          allCommands = Object.keys(_paq);
        }
        
        // Try to see what Matomo objects exist
        const matomoObjects = {
          hasPaq: !!_paq,
          paqType: paqType,
          paqLength: paqLength,
          hasMatomo: !!(window as any).Matomo,
          hasTracker: !!matomoTracker,
          matomoKeys: (window as any).Matomo ? Object.keys((window as any).Matomo) : [],
          windowMatomoSiteIds: (window as any).__MATOMO_SITE_IDS__ || null
        };
        
        console.debug('[Matomo][test] Debug info:', matomoObjects);
        console.debug('[Matomo][test] _paq sample:', paqSample);
        
        return {
          ...matomoObjects,
          paqSample,
          allCommands
        };
      }, [], (result) => {
        const data = (result as any).value;
        console.log('[Test] Matomo inspection results:', data);
        
        if (!data) {
          browser.assert.fail('No data returned from Matomo inspection');
          return;
        }
        
        // Basic assertions to understand what we have
        browser.assert.ok(data.hasPaq, 'Should have _paq available (array or tracker object)')
        
        if (data.paqType === 'array') {
          console.log('[Test] _paq is still an array with commands:', data.allCommands);
          browser.assert.ok(data.paqLength > 0, 'Should have commands in _paq array');
        } else {
          console.log('[Test] _paq is now a Matomo tracker object with methods:', data.allCommands);
          browser.assert.ok(data.hasMatomo, 'Should have Matomo global object when tracker is loaded');
        }
        
        if (data.windowMatomoSiteIds) {
          console.log('[Test] Site IDs mapping found:', data.windowMatomoSiteIds);
        }
      })
  },

  'check network activity using Performance API #group1': function (browser: NightwatchBrowser) {
    browser.perform((done) => {
      browser
        .execute(function () {
          // Set up and clear any previous state
          localStorage.setItem('config-v0.8:.remix.config', JSON.stringify({'settings/matomo-perf-analytics': true}));
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
      .pause(5000) // Wait for network activity
      .execute(function () {
        // Check Performance API for network requests
        if (!window.performance || !window.performance.getEntriesByType) {
          return { error: 'Performance API not available' };
        }
        
        const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const matomoResources = resources.filter(resource => 
          resource.name.includes('matomo') || 
          resource.name.includes('matomo.php') ||
          resource.name.includes('matomo.js')
        );
        
        const navigationEntries = window.performance.getEntriesByType('navigation');
        
        return {
          totalResources: resources.length,
          matomoResources: matomoResources.map(r => ({
            name: r.name,
            type: r.initiatorType,
            duration: r.duration,
            size: r.transferSize || 0
          })),
          hasNavigationTiming: navigationEntries.length > 0
        };
      }, [], (result) => {
        const data = (result as any).value;
        
        if (data.error) {
          console.log('[Test] Performance API error:', data.error);
          browser.assert.ok(true, 'Performance API not available - this is expected');
          return;
        }
        
        console.log('[Test] Network inspection:', data);
        console.log('[Test] Matomo resources found:', data.matomoResources);
        
        browser.assert.ok(data.totalResources > 0, 'Should have some network resources');
        
        if (data.matomoResources.length > 0) {
          browser.assert.ok(true, `Found ${data.matomoResources.length} Matomo resources`);
        } else {
          console.log('[Test] No Matomo resources detected in Performance API');
        }
      })
  }
}