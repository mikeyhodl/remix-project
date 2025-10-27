'use strict'
import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

module.exports = {
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done)
  },
  'Create blank workspace': function (browser: NightwatchBrowser) {
    browser
      .refreshPage()
      .waitForElementVisible('*[data-id="workspacesSelect"]')
      .click('*[data-id="workspacesSelect')
      .pause(3000)
      .click('*[data-id="workspacecreate"]')
      .waitForElementVisible('*[data-id="template-explorer-modal-react"]')
      .waitForElementVisible('*[data-id="template-card-blank-1"]')
      .click('*[data-id="template-card-blank-1"]')
      .waitForElementVisible('*[data-id="workspace-name-blank-input"]')
      .click('*[data-id="workspace-name-blank-input"]')
      .pause(1000)
      .setValue('*[data-id="workspace-name-blank-input"]', 'Test Blank Workspace')
      .click('*[data-id="validate-blankworkspace-button"]')
      .pause(1000)
      .assert.textContains('*[data-id="workspacesSelect-togglerText"]', 'Test Blank Workspace', 'Workspace name is correct')
      .isVisible('*[data-id="treeViewDivDraggableItemremix.config.json"]')
      .isVisible('*[data-id="treeViewDivDraggableItem.prettierrc.json"]')
      .waitForElementNotPresent('*[data-id="treeViewDivDraggableItemcontracts"]')
  },
  'Create Pectra 7702 based workspace': function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(3000)
      .click('*[data-id="workspacecreate"]')
      .waitForElementVisible('*[data-id="template-card-simpleEip7702-2"]')
      .click('*[data-id="template-card-simpleEip7702-2"]')
      .waitForElementVisible('*[data-id="workspace-name-simpleEip7702-input"]')
      .click('*[data-id="workspace-name-simpleEip7702-input"]')
      .setValue('*[data-id="workspace-name-simpleEip7702-input"]', 'Test Pectra 7702 Workspace')
      .click('*[data-id="validate-simpleEip7702workspace-button"]')
      .pause(1000)
      .assert.textContains('*[data-id="workspacesSelect-togglerText"]', 'Test Pectra 7702 Workspace', 'Workspace name is correct')
      .isVisible('*[data-id="treeViewDivDraggableItemremix.config.json"]')
      .waitForElementVisible('*[data-id="treeViewDivDraggableItemcontracts"]')
      .isVisible('*[data-id="treeViewDivDraggableItemcontracts/Example7702.sol"]')
      .waitForElementNotPresent('*[data-id="treeViewDivDraggableItemtests"]')
  },
  'Create Semaphore based workspace': function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(3000)
      .click('*[data-id="workspacecreate"]')
      .waitForElementVisible('*[data-id="template-explorer-template-container"]')
      .click('*[data-id="template-explorer-template-container"]')
      .scrollInto('*[data-id="template-category-Circom ZKP"]')
      .waitForElementVisible('*[data-id="template-card-semaphore-0"]')
      .click('*[data-id="template-card-semaphore-0"]')
      .waitForElementVisible('*[data-id="workspace-name-semaphore-input"]')
      .click('*[data-id="workspace-name-semaphore-input"]')
      .setValue('*[data-id="workspace-name-semaphore-input"]', 'Test Semaphore Workspace')
      .click('*[data-id="validate-semaphoreworkspace-button"]')
      .pause(1000)
      .assert.textContains('*[data-id="workspacesSelect-togglerText"]', 'Test Semaphore Workspace', 'Workspace name is correct')
      .isVisible('*[data-id="treeViewDivDraggableItemremix.config.json"]')
      .waitForElementVisible('*[data-id="treeViewDivDraggableItemcircuits"]')
      .isVisible('*[data-id="treeViewDivDraggableItemcircuits/semaphore.circom"]')
      .waitForElementNotPresent('*[data-id="treeViewDivDraggableItemtests"]')
      .click('*[data-id="treeViewDivDraggableItemcircuits/semaphore.circom"]')
      .waitForElementVisible('*[data-id="compile-action"]')
      .click('*[data-id="compile-action"]')
      .pause(3000)
      .waitForElementContainsText('*[data-id="terminalJournal"]', 'Everything went okay', 60000)
      .clickLaunchIcon('filePanel')
      .waitForElementVisible('*[data-id="treeViewDivDraggableItemcircuits/.bin/semaphore_js"]')
  },
  'Search for Noir Simple Multiplier template': function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(3000)
      .click('*[data-id="workspacecreate"]')
      .waitForElementVisible('*[data-id="template-explorer-search-input"]')
      .click('*[data-id="template-explorer-search-input"]')
      .setValue('*[data-id="template-explorer-search-input"]', 'Simple Multiplier')
      .pause(1000)
      .waitForElementVisible('*[data-id="template-card-multNr-0"]')
      .click('*[data-id="template-card-multNr-0"]')
      .waitForElementVisible('*[data-id="workspace-name-multNr-input"]')
      .click('*[data-id="workspace-name-multNr-input"]')
      .setValue('*[data-id="workspace-name-multNr-input"]', 'Test Simple Multiplier Workspace')
      .click('*[data-id="validate-multNrworkspace-button"]')
      .waitForElementVisible('*[data-id="treeViewDivDraggableItemNargo.toml"]')
      .isVisible('*[data-id="treeViewDivDraggableItemsrc"]')
      .isVisible('*[data-id="treeViewDivDraggableItemsrc/main.nr"]')
      .click('*[data-id="treeViewDivDraggableItemsrc/main.nr"]')
      .waitForElementVisible('*[data-id="compile-action"]')
  },
  'Create OpenZeppelin ERC20 template from topcards': function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(3000)
      .click('*[data-id="workspacecreate"]')
      .waitForElementVisible('*[data-id="contract-wizard-topcard"]')
      .click('*[data-id="contract-wizard-topcard"]')
      .waitForElementVisible('*[data-id="contract-wizard-container"]')
}
