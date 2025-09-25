'use strict'
import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

declare global {
  interface Window { testplugin: { name: string, url: string }; }
}

module.exports = {
  '@disabled': true,
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done, null)
  },

  'Should show warning for unsupported network when deploying with "Verify" on Remix VM #group1': function (browser: NightwatchBrowser) {
    browser
      .waitForElementVisible('*[data-id="remixIdeSidePanel"]')
      .clickLaunchIcon('filePanel')
      .click('*[data-id="treeViewLitreeViewItemcontracts"]')
      .openFile('contracts/1_Storage.sol')
      .clickLaunchIcon('udapp')
      .waitForElementVisible('*[data-id="Deploy - transact (not payable)"]')
      .waitForElementVisible('#deployAndRunVerifyContract')
      .click('#deployAndRunVerifyContract')
      .click('*[data-id="Deploy - transact (not payable)"]') 
      .waitForElementVisible({
        selector: "//*[contains(text(),'is not supported for verification via this plugin')]",
        locateStrategy: 'xpath',
        timeout: 10000
      })
      .end()
  }
}