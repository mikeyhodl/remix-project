'use strict'
import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

module.exports = {
  '@disabled': true,
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done)
  },
  'Pin Solidity Compiler plugin to right side panel #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="movePluginToRight"]')
      .click('*[data-id="movePluginToRight"]')
      .waitForElementVisible('*[data-pinnedPlugin="movePluginToLeft-solidity"]')
      .waitForElementVisible('.codicon-layout-sidebar-right')
      .clickLaunchIcon('filePanel')
  },
  'Maximize right side panel #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('#right-side-panel')
      .waitForElementVisible('*[data-id="maximizeRightSidePanel"]')
      .click('*[data-id="maximizeRightSidePanel"]')
      .waitForElementVisible('#right-side-panel.right-panel-maximized')
      .pause(1000)
  },
  'Verify right panel has no borders when maximized #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('#right-side-panel.right-panel-maximized')
      .checkElementStyle('#right-side-panel', 'border-left-style', 'none')
      .checkElementStyle('#right-side-panel', 'border-right-style', 'none')
  },
  'Verify left panel is hidden when right panel is maximized #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('#right-side-panel.right-panel-maximized')
      .waitForElementNotVisible('#side-panel')
  },
  'Verify main panel is hidden when right panel is maximized #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('#right-side-panel.right-panel-maximized')
      .assert.hasClass('.mainpanel', 'd-none')
  },
  'Verify terminal panel is hidden when right panel is maximized #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('#right-side-panel.right-panel-maximized')
      .waitForElementNotVisible('.terminal-wrap')
  },
  'Verify dragbar is hidden when right panel is maximized #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('#right-side-panel.right-panel-maximized')
      .checkElementStyle('#right-side-panel.right-panel-maximized ~ .dragbar', 'background-color', 'rgba(0, 0, 0, 0)')
      .checkElementStyle('#right-side-panel.right-panel-maximized ~ .dragbar', 'pointer-events', 'none')
  },
  'Minimize right side panel #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="maximizeRightSidePanel"]')
      .click('*[data-id="maximizeRightSidePanel"]')
      .waitForElementNotPresent('#right-side-panel.right-panel-maximized')
      .pause(1000)
  },
  'Verify borders are visible when panel is minimized #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('#right-side-panel')
      .waitForElementNotPresent('#right-side-panel.right-panel-maximized')
      .execute(function () {
        const panel = document.querySelector('#right-side-panel')
        const computedStyle = window.getComputedStyle(panel)
        const borderLeft = computedStyle.getPropertyValue('border-left-style')
        const borderRight = computedStyle.getPropertyValue('border-right-style')
        return borderLeft !== 'none' || borderRight !== 'none'
      }, [], function (result: any) {
        browser.assert.ok(result.value, 'Borders should be visible when panel is not maximized')
      })
  },
  'Verify left panel is visible again when right panel is minimized #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('#side-panel')
      .waitForElementVisible('.sidepanel')
  },
  'Verify main panel is visible again when right panel is minimized #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('.mainpanel')
      .assert.not.hasClass('.mainpanel', 'd-none')
  },
  'Verify terminal panel is visible again when right panel is minimized #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('.terminal-wrap')
  },
  'Maximize and then hide right panel #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('#right-side-panel')
      .waitForElementVisible('*[data-id="maximizeRightSidePanel"]')
      .click('*[data-id="maximizeRightSidePanel"]')
      .waitForElementVisible('#right-side-panel.right-panel-maximized')
      .pause(1000)
      .waitForElementVisible('*[data-id="hideRightSidePanel"]')
      .click('*[data-id="hideRightSidePanel"]')
      .waitForElementNotVisible('#right-side-panel')
      .waitForElementVisible('.codicon-layout-sidebar-right-off')
  },
  'Verify panels are restored when hidden maximized panel is shown again #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="toggleRightSidePanelIcon"]')
      .click('*[data-id="toggleRightSidePanelIcon"]')
      .pause(1000)
      .waitForElementVisible('#right-side-panel')
      .waitForElementVisible('#side-panel')
      .waitForElementVisible('.mainpanel')
      .assert.not.hasClass('.mainpanel', 'd-none')
  },
  'Test auto-restore on file change when panel is maximized #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('#right-side-panel')
      .waitForElementVisible('*[data-id="maximizeRightSidePanel"]')
      .click('*[data-id="maximizeRightSidePanel"]')
      .waitForElementVisible('#right-side-panel.right-panel-maximized')
      .pause(1000)
      .assert.hasClass('.mainpanel', 'd-none')
      .openFile('contracts/2_Owner.sol')
      .pause(2000)
      .waitForElementVisible('#right-side-panel')
      .execute(function () {
        return !document.querySelector('#right-side-panel').classList.contains('right-panel-maximized')
      }, [], function (result: any) {
        browser.assert.ok(result.value, 'Panel should auto-restore after file change')
      })
      .waitForElementVisible('.mainpanel')
      .assert.not.hasClass('.mainpanel', 'd-none')
  },
  'Test panel maximization persists with different plugin #group1': function (browser: NightwatchBrowser) {
    browser
      .clickLaunchIcon('udapp')
      .waitForElementVisible('*[data-id="movePluginToRight"]')
      .click('*[data-id="movePluginToRight"]')
      .waitForElementVisible('*[data-pinnedPlugin="movePluginToLeft-udapp"]')
      .pause(1000)
      .waitForElementVisible('*[data-id="maximizeRightSidePanel"]')
      .click('*[data-id="maximizeRightSidePanel"]')
      .waitForElementVisible('#right-side-panel.right-panel-maximized')
      .checkElementStyle('#right-side-panel', 'border-left-style', 'none')
      .checkElementStyle('#right-side-panel', 'border-right-style', 'none')
      .waitForElementNotVisible('#side-panel')
      .assert.hasClass('.mainpanel', 'd-none')
  },
  'Test maximize panel with terminal open #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('#right-side-panel.right-panel-maximized')
      .click('*[data-id="maximizeRightSidePanel"]')
      .pause(1500)
      .assert.not.hasClass('#right-side-panel', 'right-panel-maximized')
      .waitForElementVisible('.terminal-wrap')
      .waitForElementVisible('#side-panel')
      .click('*[data-id="maximizeRightSidePanel"]')
      .pause(1000)
      .waitForElementVisible('#right-side-panel.right-panel-maximized')
      .waitForElementNotVisible('.terminal-wrap')
      .waitForElementNotVisible('#side-panel')
  },
  'Verify panel state after page reload when not maximized #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('#right-side-panel.right-panel-maximized')
      .click('*[data-id="maximizeRightSidePanel"]')
      .pause(1500)
      .assert.not.hasClass('#right-side-panel', 'right-panel-maximized')
      .waitForElementVisible('#side-panel')
      .waitForElementVisible('.mainpanel')
      .assert.not.hasClass('.mainpanel', 'd-none')
      .refreshPage()
      .waitForElementVisible('#right-side-panel')
      .pause(1000)
      .assert.not.hasClass('#right-side-panel', 'right-panel-maximized')
      .waitForElementVisible('#side-panel')
      .waitForElementVisible('.mainpanel')
      .assert.not.hasClass('.mainpanel', 'd-none')
      .end()
  }
}
