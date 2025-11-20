'use strict'
import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

module.exports = {
  '@disabled': true,
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done)
  },

  'Check if RemixAI plugin is pinned to right side panel on load #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="movePluginToLeft"]')
      .waitForElementVisible('*[data-id="remix-ai-assistant-starter-beginner-0"]')
      .waitForElementVisible('*[data-id="remix-ai-assistant-starter-intermediate-1"]')
      .waitForElementVisible('*[data-id="remix-ai-assistant-starter-expert-2"]')
      .click('*[data-id="movePluginToLeft"]')
      .waitForElementVisible('*[data-pinnedPlugin="movePluginToRight-remixaiassistant"]')
  },
  'Pin Solidity Compiler plugin to right side panel #group1': function (browser: NightwatchBrowser) {
    browser
      .clickLaunchIcon('solidity')
      .pause(2000)
      .waitForElementVisible('*[data-id="movePluginToRight"]')
      .click('*[data-id="movePluginToRight"]')
      .waitForElementVisible('*[data-pinnedPlugin="movePluginToLeft-solidity"]')
      .clickLaunchIcon('filePanel')
  },
  'Toggle right side panel to hide pinned plugin and restore it #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="hideRightSidePanel"]')
      .click('*[data-id="hideRightSidePanel"]')
      .waitForElementNotVisible('*[data-pinnedplugin="movePluginToLeft-solidity"]')
      .waitForElementVisible('*[data-id="restoreClosedPlugin"')
      .click('*[data-id="restoreClosedPlugin"]')
      .waitForElementVisible('*[data-pinnedplugin="movePluginToLeft-solidity"]')
  },
  'Toggle right side panel, reload IDE, panel state should persist #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="hideRightSidePanel"]')
      .click('*[data-id="hideRightSidePanel"]')
      .waitForElementNotVisible('*[data-pinnedplugin="movePluginToLeft-solidity"]')
      .waitForElementVisible('*[data-id="restoreClosedPlugin"')
      .refresh()
      .waitForElementVisible('*[data-id="restoreClosedPlugin"')
      .click('*[data-id="restoreClosedPlugin"]')
      .waitForElementVisible('*[data-pinnedplugin="movePluginToLeft-solidity"]')
  },
  'Swap pinned plugin from right side panel when panel is hidden #group1': function (browser: NightwatchBrowser) {
    browser
      .refreshPage()
      .waitForElementVisible('*[data-pinnedplugin="movePluginToLeft-solidity"]')
      .waitForElementVisible('*[data-id="hideRightSidePanel"]')
      .click('*[data-id="hideRightSidePanel"]')
      .waitForElementVisible('*[data-id="restoreClosedPlugin"]')
      .clickLaunchIcon('udapp')
      .waitForElementVisible('*[data-pinnedplugin="movePluginToRight-udapp"]')
      .click('*[data-id="movePluginToRight"]')
      .waitForElementVisible('*[data-pinnedplugin="movePluginToLeft-udapp"]')
      .waitForElementVisible('*[data-id="movePluginToRight"]')
      .click('*[data-pinnedplugin="movePluginToLeft-udapp"]')
      .end()
  },
  'Check if right side panel is hidden when app is in desktop client mode #group1': function (browser: NightwatchBrowser) {
    browser
      .url('http://127.0.0.1:8080/?#activate=udapp,desktopClient')
      .waitForElementNotPresent('#right-side-panel')
      .end()
  }
}
