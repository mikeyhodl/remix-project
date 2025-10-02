'use strict'
import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

// Helper 1: Fresh start - enable Matomo and wait for load
function startFreshTest(browser: NightwatchBrowser) {
    return browser
        .execute(function () {
            localStorage.setItem('showMatomo', 'true');
        }, [])
        .refreshPage()
        .waitForElementPresent({
            selector: `//*[@data-id='compilerloaded']`,
            locateStrategy: 'xpath',
            timeout: 120000
        });
}

// Helper 2: Accept consent modal
function acceptConsent(browser: NightwatchBrowser) {
    return browser
        .waitForElementVisible('*[data-id="matomoModalModalDialogModalBody-react"]')
        .click('[data-id="matomoModal-modal-footer-ok-react"]')
        .waitForElementNotVisible('*[data-id="matomoModalModalDialogModalBody-react"]')
        .pause(2000);
}

// Helper 2b: Reject consent via manage preferences
function rejectConsent(browser: NightwatchBrowser) {
    return browser
        .waitForElementVisible('*[data-id="matomoModalModalDialogModalBody-react"]')
        .click('[data-id="matomoModal-modal-footer-cancel-react"]') // Click "Manage Preferences"
        .waitForElementVisible('*[data-id="managePreferencesModalModalDialogModalBody-react"]') // Wait for preferences dialog
        .click('[data-id="matomoPerfAnalyticsToggleSwitch"]') // Uncheck performance analytics toggle
        .click('[data-id="managePreferencesModal-modal-footer-ok-react"]') // Save preferences
        .waitForElementNotVisible('*[data-id="managePreferencesModalModalDialogModalBody-react"]')
        .pause(2000);
}

// Helper 3: Check cookie and consent state
function checkConsentState(browser: NightwatchBrowser, expectedHasCookies: boolean, description: string) {
    return browser
        .execute(function () {
            const cookies = document.cookie.split(';').filter(c => c.includes('_pk_'));
            const matomoManager = (window as any)._matomoManagerInstance;
            const hasConsent = matomoManager.getState().consentGiven;
            return { cookieCount: cookies.length, hasConsent };
        }, [], (result: any) => {
            const hasCookies = result.value.cookieCount > 0;
            browser
                .assert.equal(hasCookies, expectedHasCookies, expectedHasCookies ? 'Should have cookies' : 'Should not have cookies')
                .assert.equal(result.value.hasConsent, expectedHasCookies, expectedHasCookies ? 'Should have consent' : 'Should not have consent')
                .assert.ok(true, `✅ ${description}: ${result.value.cookieCount} cookies, consent=${result.value.hasConsent}`);
        });
}

// Helper 3b: Check cookie and consent state (with separate consent expectation)
function checkTrackingState(browser: NightwatchBrowser, expectedHasCookies: boolean, expectedHasConsent: boolean, description: string) {
    return browser
        .execute(function () {
            const cookies = document.cookie.split(';').filter(c => c.includes('_pk_'));
            const matomoManager = (window as any)._matomoManagerInstance;
            const hasConsent = matomoManager.getState().consentGiven;
            const currentMode = matomoManager.getState().currentMode;
            return { cookieCount: cookies.length, hasConsent, currentMode };
        }, [], (result: any) => {
            const hasCookies = result.value.cookieCount > 0;
            browser
                .assert.equal(hasCookies, expectedHasCookies, expectedHasCookies ? 'Should have cookies' : 'Should not have cookies')
                .assert.equal(result.value.hasConsent, expectedHasConsent, expectedHasConsent ? 'Should have consent' : 'Should not have consent')
                .assert.ok(true, `✅ ${description}: ${result.value.cookieCount} cookies, consent=${result.value.hasConsent}, mode=${result.value.currentMode}`);
        });
}

// Helper: Just initialize debug plugin (no state checking, no clearing)
function initDebugPlugin(browser: NightwatchBrowser) {
    return browser
        .execute(function () {
            const matomoManager = (window as any)._matomoManagerInstance;
            if (!matomoManager) return { success: false, error: 'No MatomoManager' };
            
            return new Promise((resolve) => {
                matomoManager.loadDebugPluginForE2E().then((debugHelpers: any) => {
                    // Don't clear data - we want to keep tracking events across reload
                    (window as any).__matomoDebugHelpers = debugHelpers;
                    resolve({ success: true });
                }).catch((error: any) => {
                    resolve({ success: false, error: error.message });
                });
            });
        }, [], (result: any) => {
            browser.assert.ok(result.value.success, 'Debug plugin reconnected');
        });
}

// Helper 4: Reload and check persistence (with debug plugin ready)
function reloadAndCheckPersistence(browser: NightwatchBrowser, expectedHasModal: boolean, expectedHasCookies: boolean) {
    return browser
        .refreshPage()
        .waitForElementPresent({
            selector: `//*[@data-id='compilerloaded']`,
            locateStrategy: 'xpath',
            timeout: 120000
        })
        .pause(2000)
        .perform(() => initDebugPlugin(browser)) // Initialize debug plugin after reload
        .execute(function () {
            const hasModal = !!document.querySelector('[data-id="matomoModalModalDialogModalBody-react"]');
            const cookies = document.cookie.split(';').filter(c => c.includes('_pk_'));
            return { hasModal, cookieCount: cookies.length };
        }, [], (result: any) => {
            browser
                .assert.equal(result.value.hasModal, expectedHasModal, expectedHasModal ? 'Should have modal after reload' : 'No modal after reload')
                .assert.equal(result.value.cookieCount > 0, expectedHasCookies, expectedHasCookies ? 'Cookies should persist' : 'No cookies should persist')
                .assert.ok(true, `✅ Reload check: modal=${result.value.hasModal}, ${result.value.cookieCount} cookies`);
        });
}

// Helper 5: Trigger tracking event by clicking element
function triggerEvent(browser: NightwatchBrowser, elementId: string, description: string = '') {
    const displayName = description || elementId.replace('verticalIcons', '').replace('Icon', '');
    return browser
        .click(`[data-id="${elementId}"]`)
        .pause(2000) // Wait longer for event to be captured by debug plugin
        .assert.ok(true, `🎯 Triggered: ${displayName}`);
}

// Helper 6: Check last event has correct tracking mode and visitor ID
function checkLastEventMode(browser: NightwatchBrowser, expectedMode: 'cookie' | 'anon', expectedCategory: string, expectedAction: string, expectedName: string, description: string) {
    return browser
        .pause(1000) // Extra wait to ensure debug plugin captured the event
        .execute(function () {
            const debugHelpers = (window as any).__matomoDebugHelpers;
            if (!debugHelpers) return { error: 'Debug helpers not found' };
            
            const events = debugHelpers.getEvents();
            if (events.length === 0) return { error: 'No events found' };
            
            // Debug: Show all events to understand what's being captured
            console.log('DEBUG: All events found:', events.map(e => ({
                category: e.e_c || e.category,
                action: e.e_a || e.action, 
                name: e.e_n || e.name,
                timestamp: e.timestamp
            })));
            
            const lastEvent = events[events.length - 1];
            
            // Store ALL events as JSON string in browser global for Nightwatch visibility
            (window as any).__detectedevents = JSON.stringify(events, null, 2);
            
            return {
                mode: lastEvent.dimension1, // 'cookie' or 'anon'
                hasVisitorId: !!lastEvent.visitorId && lastEvent.visitorId !== 'null',
                visitorId: lastEvent.visitorId,
                eventName: lastEvent.e_n || lastEvent.name || 'unknown',
                category: lastEvent.e_c || lastEvent.category || 'unknown',
                action: lastEvent.e_a || lastEvent.action || 'unknown',
                totalEvents: events.length,
                allEventsJson: JSON.stringify(events, null, 2) // Include in return for immediate logging
            };
        }, [], (result: any) => {
            const expectedHasId = expectedMode === 'cookie';
            browser
                .assert.equal(result.value.mode, expectedMode, `Event should be in ${expectedMode} mode`)
                .assert.equal(result.value.hasVisitorId, expectedHasId, expectedHasId ? 'Should have visitor ID' : 'Should NOT have visitor ID')
                .assert.equal(result.value.category, expectedCategory, `Event should have category "${expectedCategory}"`)
                .assert.equal(result.value.action, expectedAction, `Event should have action "${expectedAction}"`)
                .assert.equal(result.value.eventName, expectedName, `Event should have name "${expectedName}"`)
                .assert.ok(true, `✅ ${description}: ${result.value.category}/${result.value.action}/${result.value.eventName} → ${result.value.mode} mode, visitorId=${result.value.hasVisitorId ? 'yes' : 'no'}`)
                .assert.ok(true, `📋 All events JSON: ${result.value.allEventsJson}`);
            
            // Store visitor ID globally for comparison later
            (browser as any).__lastVisitorId = result.value.visitorId;
        });
}

// Helper 7: Remember cookie value for later comparison 
function rememberCookieValue(browser: NightwatchBrowser, description: string) {
    return browser
        .execute(function () {
            // Find the _pk_id cookie
            const cookies = document.cookie.split(';');
            const pkCookie = cookies.find(c => c.trim().startsWith('_pk_id'));
            return { pkCookie: pkCookie ? pkCookie.trim() : null };
        }, [], (result: any) => {
            (browser as any).__savedCookie = result.value.pkCookie;
            browser.assert.ok(true, `📝 ${description}: Saved cookie ${result.value.pkCookie ? result.value.pkCookie.substring(0, 20) + '...' : 'none'}`);
        });
}

// Helper 8: Check cookie value is exactly the same as before
function checkSameCookie(browser: NightwatchBrowser, description: string) {
    return browser
        .execute(function () {
            // Find the _pk_id cookie again
            const cookies = document.cookie.split(';');
            const pkCookie = cookies.find(c => c.trim().startsWith('_pk_id'));
            return { pkCookie: pkCookie ? pkCookie.trim() : null };
        }, [], (result: any) => {
            const savedCookie = (browser as any).__savedCookie;
            if (savedCookie && result.value.pkCookie) {
                browser
                    .assert.equal(result.value.pkCookie, savedCookie, 'Cookie value should be exactly the same after reload')
                    .assert.ok(true, `✅ ${description}: Same cookie persisted`);
            } else {
                browser.assert.ok(true, `ℹ️ ${description}: No cookies to compare`);
            }
        });
}

// Helper 8b: Check cookie value is different from before (new visitor ID)
function checkNewCookie(browser: NightwatchBrowser, description: string) {
    return browser
        .execute(function () {
            // Find the _pk_id cookie again
            const cookies = document.cookie.split(';');
            const pkCookie = cookies.find(c => c.trim().startsWith('_pk_id'));
            return { pkCookie: pkCookie ? pkCookie.trim() : null };
        }, [], (result: any) => {
            const savedCookie = (browser as any).__savedCookie;
            if (savedCookie && result.value.pkCookie) {
                browser
                    .assert.notEqual(result.value.pkCookie, savedCookie, 'Cookie value should be different (new visitor ID)')
                    .assert.ok(true, `✅ ${description}: New visitor ID generated`);
            } else if (result.value.pkCookie && !savedCookie) {
                browser.assert.ok(true, `✅ ${description}: New visitor ID created (no previous cookie)`);
            } else {
                browser.assert.ok(true, `ℹ️ ${description}: No cookies found`);
            }
        });
}

// Helper 9: Dump all debug events to Nightwatch log
function dumpAllEvents(browser: NightwatchBrowser, description: string) {
    return browser
        .execute(function () {
            const debugHelpers = (window as any).__matomoDebugHelpers;
            if (!debugHelpers) return { error: 'No debug helpers found' };
            
            const events = debugHelpers.getEvents();
            return {
                totalEvents: events.length,
                allEventsJson: JSON.stringify(events, null, 2),
                events: events.map((e: any, i: number) => ({
                    index: i,
                    mode: e.dimension1,
                    visitorId: e.visitorId,
                    eventName: e.e_n || 'unknown',
                    category: e.e_c || 'unknown',
                    action: e.e_a || 'unknown'
                }))
            };
        }, [], (result: any) => {
            browser.assert.ok(true, `📊 ${description}: ${result.value.totalEvents} total events`);
            browser.assert.ok(true, `📋 Full JSON: ${result.value.allEventsJson}`);
            if (result.value.events && result.value.events.length > 0) {
                result.value.events.forEach((event: any) => {
                    browser.assert.ok(true, `   Event ${event.index}: ${event.eventName} → mode=${event.mode}, visitorId=${event.visitorId ? 'yes' : 'no'}, ${event.category}/${event.action}`);
                });
            } else {
                browser.assert.ok(true, '   No events found in debug plugin');
            }
        });
}

// Helper 10: Show stored events from browser global
function showStoredEvents(browser: NightwatchBrowser, description: string) {
    const storedEvents = (browser as any).__detectedevents;
    if (storedEvents) {
        browser.assert.ok(true, `📋 ${description} - Stored events: ${storedEvents}`);
    } else {
        browser.assert.ok(true, `📋 ${description} - No events stored yet`);
    }
    return browser;
}

// Helper: Check if element exists and is clickable
function checkElementExists(browser: NightwatchBrowser, elementId: string, description: string) {
    return browser
        .execute(function (elementId) {
            const element = document.querySelector(`[data-id="${elementId}"]`);
            return {
                exists: !!element,
                visible: element ? window.getComputedStyle(element).display !== 'none' : false,
                clickable: element ? !element.hasAttribute('disabled') : false,
                tagName: element ? element.tagName : null,
                className: element ? element.className : null
            };
        }, [elementId], (result: any) => {
            browser.assert.ok(result.value.exists, `${description}: Element [data-id="${elementId}"] should exist`);
            if (result.value.exists) {
                browser.assert.ok(true, `✅ ${description}: Found ${result.value.tagName}.${result.value.className}, visible=${result.value.visible}, clickable=${result.value.clickable}`);
            }
        });
}

// Predefined common events
function clickHome(browser: NightwatchBrowser) {
    return browser
        .perform(() => checkElementExists(browser, 'verticalIconsHomeIcon', 'Home button check'))
        .perform(() => triggerEvent(browser, 'verticalIconsHomeIcon', 'Home'));
}

function clickSolidity(browser: NightwatchBrowser) {
    return triggerEvent(browser, 'verticalIconsKindsolidity', 'Solidity Compiler');
}

function clickFileExplorer(browser: NightwatchBrowser) {
    return triggerEvent(browser, 'verticalIconsKindfilePanel', 'File Explorer');
}

// Helper: Navigate to settings and switch matomo preferences
function switchMatomoSettings(browser: NightwatchBrowser, enablePerformance: boolean, description: string) {
    return browser
        .waitForElementVisible('*[data-id="topbar-settingsIcon"]')
        .click('*[data-id="topbar-settingsIcon"]') // Open settings
        .waitForElementVisible('*[data-id="settings-sidebar-analytics"]')
        .click('*[data-id="settings-sidebar-analytics"]') // Click Analytics section
        .waitForElementVisible('*[data-id="matomo-perf-analyticsSwitch"]')
        .execute(function () {
            // Check current toggle state
            const perfToggle = document.querySelector('[data-id="matomo-perf-analyticsSwitch"]');
            const isCurrentlyOn = perfToggle?.querySelector('.fa-toggle-on');
            return { currentState: !!isCurrentlyOn };
        }, [], (result: any) => {
            const currentState = result.value.currentState;
            const needsClick = currentState !== enablePerformance;
            
            if (needsClick) {
                browser
                    .click('*[data-id="matomo-perf-analyticsSwitch"]') // Toggle performance analytics
                    .pause(1000) // Wait for setting to apply
                    .assert.ok(true, `🔧 ${description}: Switched performance analytics to ${enablePerformance ? 'enabled' : 'disabled'}`);
            } else {
                browser.assert.ok(true, `🔧 ${description}: Performance analytics already ${enablePerformance ? 'enabled' : 'disabled'}`);
            }
        })
        .pause(2000); // Wait for changes to take effect
}

// Helper: Verify settings state matches expectations  
function verifySettingsState(browser: NightwatchBrowser, expectedPerformanceEnabled: boolean, description: string) {
    return browser
        .execute(function () {
            const config = JSON.parse(window.localStorage.getItem('config-v0.8:.remix.config') || '{}');
            const perfAnalytics = config['settings/matomo-perf-analytics'];
            return { perfAnalytics };
        }, [], (result: any) => {
            browser
                .assert.equal(result.value.perfAnalytics, expectedPerformanceEnabled, `Performance analytics should be ${expectedPerformanceEnabled ? 'enabled' : 'disabled'} in localStorage`)
                .assert.ok(true, `✅ ${description}: localStorage shows performance=${result.value.perfAnalytics}`);
        });
}

// Simple helper: setup and check tracking state
function setupAndCheckState(browser: NightwatchBrowser, description: string) {
    return browser
        .execute(function () {
            // Setup debug plugin
            const matomoManager = (window as any)._matomoManagerInstance;
            if (!matomoManager) return { success: false, error: 'No MatomoManager' };
            
            return new Promise((resolve) => {
                matomoManager.loadDebugPluginForE2E().then((debugHelpers: any) => {
                    debugHelpers.clearData();
                    (window as any).__matomoDebugHelpers = debugHelpers;
                    resolve({ success: true });
                }).catch((error: any) => {
                    resolve({ success: false, error: error.message });
                });
            });
        }, [], (result: any) => {
            browser.assert.ok(result.value.success, 'Debug plugin setup');
        })
        .execute(function () {
            // Check current state
            const debugHelpers = (window as any).__matomoDebugHelpers;
            const matomoManager = (window as any)._matomoManagerInstance;
            
            if (!debugHelpers || !matomoManager) {
                return { error: 'Missing components' };
            }
            
            const events = debugHelpers.getEvents();
            const state = matomoManager.getState();
            const queueStatus = matomoManager.getQueueStatus();
            
            // Check cookies
            const cookies = document.cookie.split(';').reduce((acc, cookie) => {
                const [name, value] = cookie.trim().split('=');
                if (name) acc[name] = value;
                return acc;
            }, {} as any);
            const matomoCookies = Object.keys(cookies).filter(name => name.startsWith('_pk_'));
            
            // Events by type
            const cookieEvents = events.filter((e: any) => e.dimension1 === 'cookie');
            const anonymousEvents = events.filter((e: any) => e.dimension1 === 'anon');
            const eventsWithId = events.filter((e: any) => e.visitorId && e.visitorId !== 'null');
            
            return {
                totalEvents: events.length,
                cookieEvents: cookieEvents.length,
                anonymousEvents: anonymousEvents.length,
                eventsWithId: eventsWithId.length,
                queuedEvents: queueStatus.queueLength,
                hasCookies: matomoCookies.length > 0,
                cookieCount: matomoCookies.length,
                hasConsent: state.consentGiven,
                mode: state.currentMode,
                summary: `${events.length}events(${cookieEvents.length}cookie/${anonymousEvents.length}anon), ${queueStatus.queueLength}queue, ${matomoCookies.length}cookies, consent=${state.consentGiven}`
            };
        }, [], (result: any) => {
            browser.assert.ok(true, `${description}: ${result.value.summary}`);
            return result.value;
        });
}

// Helper: Check prequeue vs debug events (before/after consent)
function checkPrequeueState(browser: NightwatchBrowser, description: string) {
    return browser
        .execute(function () {
            const matomoManager = (window as any)._matomoManagerInstance;
            const debugHelpers = (window as any).__matomoDebugHelpers;
            
            if (!matomoManager || !debugHelpers) {
                return { error: 'Missing components' };
            }
            
            const queueStatus = matomoManager.getQueueStatus();
            const events = debugHelpers.getEvents();
            
            return {
                queueLength: queueStatus.queueLength,
                debugEvents: events.length,
                hasConsent: matomoManager.getState().consentGiven,
                summary: `Queue: ${queueStatus.queueLength} events, Debug: ${events.length} events, Consent: ${matomoManager.getState().consentGiven}`
            };
        }, [], (result: any) => {
            browser.assert.ok(true, `📊 ${description}: ${result.value.summary}`);
            return result.value;
        });
}

// Helper: Verify prequeue has events but debug is empty
function verifyPrequeueActive(browser: NightwatchBrowser, description: string) {
    return browser
        .execute(function () {
            const matomoManager = (window as any)._matomoManagerInstance;
            const debugHelpers = (window as any).__matomoDebugHelpers;
            const queueStatus = matomoManager.getQueueStatus();
            const events = debugHelpers.getEvents();
            return { queueLength: queueStatus.queueLength, debugEvents: events.length };
        }, [], (result: any) => {
            browser
                .assert.ok(result.value.queueLength > 0, `Should have queued events (found ${result.value.queueLength})`)
                .assert.equal(result.value.debugEvents, 0, 'Should have no debug events before consent')
                .assert.ok(true, `✅ ${description}: ${result.value.queueLength} queued, ${result.value.debugEvents} debug`);
        });
}

// Helper: Verify queue flushed to debug with correct mode
function verifyQueueFlushed(browser: NightwatchBrowser, expectedMode: 'cookie' | 'anon', description: string) {
    return browser
        .execute(function (expectedMode) {
            const matomoManager = (window as any)._matomoManagerInstance;
            const debugHelpers = (window as any).__matomoDebugHelpers;
            const queueStatus = matomoManager.getQueueStatus();
            const events = debugHelpers.getEvents();
            const modeEvents = events.filter((e: any) => e.dimension1 === expectedMode);
            return { 
                queueLength: queueStatus.queueLength, 
                debugEvents: events.length,
                modeEvents: modeEvents.length,
                firstEvent: events[0] || null
            };
        }, [expectedMode], (result: any) => {
            browser
                .assert.equal(result.value.queueLength, 0, 'Queue should be empty after consent')
                .assert.ok(result.value.debugEvents > 0, `Should have debug events after flush (found ${result.value.debugEvents})`)
                .assert.ok(result.value.modeEvents > 0, `Should have ${expectedMode} mode events (found ${result.value.modeEvents})`)
                .assert.ok(true, `✅ ${description}: ${result.value.queueLength} queued, ${result.value.debugEvents} debug (${result.value.modeEvents} ${expectedMode} mode)`);
            
            // Verify first event mode and visitor ID
            if (result.value.firstEvent) {
                const expectedHasId = expectedMode === 'cookie';
                browser
                    .assert.equal(result.value.firstEvent.dimension1, expectedMode, `Flushed events should be in ${expectedMode} mode`)
                    .assert.equal(!!result.value.firstEvent.visitorId, expectedHasId, expectedHasId ? 'Flushed events should have visitor ID' : 'Flushed events should NOT have visitor ID');
            }
        });
}

module.exports = {
    '@disabled': false,
    before: function (browser: NightwatchBrowser, done: () => void) {
        init(browser, done, 'http://127.0.0.1:8080', false)
    },

    /**
     * Simple pattern: User accepts cookies → has cookies + visitor ID → reload → same state
     */
    'User accepts cookies #group1': function (browser: NightwatchBrowser) {
        browser
            .perform(() => startFreshTest(browser))
            .perform(() => setupAndCheckState(browser, 'Initial state'))
            .perform(() => acceptConsent(browser))
            .perform(() => checkConsentState(browser, true, 'After accept'))
            .perform(() => clickHome(browser)) // Trigger tracking event
            .perform(() => checkLastEventMode(browser, 'cookie', 'topbar', 'header', 'Home', 'Home click event')) // Verify event was tracked with cookie mode + visitor ID
            .perform(() => rememberCookieValue(browser, 'Before reload')) // Remember the cookie value
            .perform(() => reloadAndCheckPersistence(browser, false, true))
            .perform(() => checkSameCookie(browser, 'After reload')) // Check cookie is exactly the same
            .perform(() => clickHome(browser)) // Click again after reload - same visitor ID guaranteed by cookie
            .perform(() => checkLastEventMode(browser, 'cookie', 'topbar', 'header', 'Home', 'Home click after reload')) // Verify event after reload also tracked correctly
            .assert.ok(true, '✅ Pattern complete: accept → cookies → reload → same cookies → same visitor ID in new events')
    },

    /**
     * Simple pattern: User rejects cookies → no cookies + no visitor ID → reload → same anonymous state
     */
    'User rejects cookies (anonymous mode) #group2': function (browser: NightwatchBrowser) {
        browser
            .perform(() => startFreshTest(browser))
            .perform(() => setupAndCheckState(browser, 'Initial state'))
            .perform(() => rejectConsent(browser))
            .perform(() => checkConsentState(browser, false, 'After reject'))
            .perform(() => clickHome(browser)) // Trigger tracking event
            .perform(() => checkLastEventMode(browser, 'anon', 'topbar', 'header', 'Home', 'Home click event (anonymous)')) // Verify event was tracked in anonymous mode with no visitor ID
            .perform(() => reloadAndCheckPersistence(browser, false, false))
            .perform(() => clickHome(browser)) // Click again after reload - still anonymous
            .perform(() => checkLastEventMode(browser, 'anon', 'topbar', 'header', 'Home', 'Home click after reload (anonymous)')) // Verify event after reload still anonymous
            .assert.ok(true, '✅ Pattern complete: reject → anonymous → reload → same anonymous state → no visitor ID persistence')
    },

    /**
     * Settings tab pattern: User switches preferences via Settings → Analytics
     */
    'User switches settings via Settings tab #group3': function (browser: NightwatchBrowser) {
        browser
            .perform(() => startFreshTest(browser))
            .perform(() => setupAndCheckState(browser, 'Initial state'))
            .perform(() => acceptConsent(browser)) // Start with cookie mode
            .perform(() => checkConsentState(browser, true, 'After accept'))
            .perform(() => clickHome(browser)) // Trigger event in cookie mode
            .perform(() => checkLastEventMode(browser, 'cookie', 'topbar', 'header', 'Home', 'Initial cookie mode event'))
            .perform(() => rememberCookieValue(browser, 'Original cookie mode')) // Remember the first cookie
            
            // Switch to anonymous via settings
            .perform(() => switchMatomoSettings(browser, false, 'Disable performance analytics'))
            .perform(() => verifySettingsState(browser, false, 'Settings verification'))
            .perform(() => checkConsentState(browser, false, 'After settings switch to anonymous'))
            .perform(() => clickHome(browser)) // Trigger event in anonymous mode
            .perform(() => checkLastEventMode(browser, 'anon', 'topbar', 'header', 'Home', 'After switch to anonymous'))
            
            // Switch back to cookie mode via settings
            .perform(() => switchMatomoSettings(browser, true, 'Enable performance analytics'))
            .perform(() => verifySettingsState(browser, true, 'Settings verification'))
            .perform(() => checkConsentState(browser, true, 'After settings switch to cookie'))
            .perform(() => clickHome(browser)) // Trigger event in cookie mode again
            .perform(() => checkLastEventMode(browser, 'cookie', 'topbar', 'header', 'Home', 'After switch back to cookie'))
            .perform(() => checkNewCookie(browser, 'New visitor ID after anonymous switch')) // Verify it's a NEW cookie, not the old one
            .assert.ok(true, '✅ Pattern complete: settings toggle → anonymous ↔ cookie mode switching works with new visitor ID')
    },

    /**
     * Simple pattern: Prequeue → Accept → Queue flush to cookie mode
     */
    'Prequeue flush to cookie mode #group4': function (browser: NightwatchBrowser) {
        browser
            .perform(() => startFreshTest(browser))
            .perform(() => setupAndCheckState(browser, 'Initial state'))
            .pause(3000) // Wait for events to accumulate in prequeue
            .perform(() => checkPrequeueState(browser, 'Before consent'))
            .perform(() => verifyPrequeueActive(browser, 'Prequeue working'))
            .perform(() => acceptConsent(browser)) // Accept consent
            .pause(2000) // Wait for queue flush
            .perform(() => checkPrequeueState(browser, 'After consent'))
            .perform(() => verifyQueueFlushed(browser, 'cookie', 'Queue flush successful'))
            .assert.ok(true, '✅ Pattern complete: prequeue → accept → queue flush to cookie mode')
    },

    /**
     * Simple pattern: Prequeue → Reject → Queue flush to anonymous mode
     */
    'Prequeue flush to anonymous mode #group5': function (browser: NightwatchBrowser) {
        browser
            .perform(() => startFreshTest(browser))
            .perform(() => setupAndCheckState(browser, 'Initial state'))
            .pause(3000) // Wait for events to accumulate in prequeue
            .perform(() => checkPrequeueState(browser, 'Before consent'))
            .perform(() => verifyPrequeueActive(browser, 'Prequeue working'))
            .perform(() => rejectConsent(browser)) // Reject consent
            .pause(2000) // Wait for queue flush
            .perform(() => checkPrequeueState(browser, 'After consent'))
            .perform(() => verifyQueueFlushed(browser, 'anon', 'Queue flush successful'))
            .assert.ok(true, '✅ Pattern complete: prequeue → reject → queue flush to anonymous mode')
    }
}