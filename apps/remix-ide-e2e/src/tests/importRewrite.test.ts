'use strict'
import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

module.exports = {
  before: function (browser: NightwatchBrowser, done: VoidFunction) {
    init(browser, done)
  },

  '@sources': function () {
    return sources
  },

  'Test NPM Import Rewriting with OpenZeppelin #group1': function (browser: NightwatchBrowser) {
    browser
      .clickLaunchIcon('filePanel')
      .click('li[data-id="treeViewLitreeViewItemREADME.txt"')
      .addFile('UpgradeableNFT.sol', sources[0]['UpgradeableNFT.sol'])
      .clickLaunchIcon('solidity')
      .click('[data-id="compilerContainerCompileBtn"]')
      .clickLaunchIcon('filePanel')
      .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 120000)
      .click('*[data-id="treeViewDivDraggableItem.deps"]')
      .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
      .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
      .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts-upgradeable"]')
  },

  'Verify package.json was saved #group1': function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts-upgradeable"]')
      .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts-upgradeable/package.json"]', 120000)
      .openFile('.deps/npm/@openzeppelin/contracts-upgradeable/package.json')
      .pause(2000)
      .getEditorValue((content) => {
        browser.assert.ok(content.indexOf('"name": "@openzeppelin/contracts-upgradeable"') !== -1, 'package.json should contain package name')
        browser.assert.ok(content.indexOf('"version"') !== -1, 'package.json should contain version')
      })
  },

  'Verify imports were rewritten with version tags #group2': function (browser: NightwatchBrowser) {
    browser
      .clickLaunchIcon('filePanel')
      .click('li[data-id="treeViewLitreeViewItemREADME.txt"')
      .addFile('UpgradeableNFT.sol', sources[0]['UpgradeableNFT.sol'])
      .clickLaunchIcon('solidity')
      .click('[data-id="compilerContainerCompileBtn"]')
      .pause(10000)  // Wait for compilation and import resolution
      .clickLaunchIcon('filePanel')
      .click('*[data-id="treeViewDivDraggableItem.deps"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts-upgradeable"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts-upgradeable/token"]')
      .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts-upgradeable/token/ERC1155"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts-upgradeable/token/ERC1155"]')
      .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol"]', 120000)
      .openFile('.deps/npm/@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol')
      .pause(2000)
      .getEditorValue((content) => {
        // Verify the file was saved and has content
        browser.assert.ok(content.length > 1000, 'ERC1155Upgradeable.sol should have substantial content')
        
        // Check for version-tagged imports from @openzeppelin/contracts (non-upgradeable)
        const hasVersionedImport = content.indexOf('@openzeppelin/contracts@') !== -1
        browser.assert.ok(hasVersionedImport, 'Should have version-tagged imports from @openzeppelin/contracts')
        
        // Verify relative imports are NOT rewritten (check for common patterns)
        const hasRelativeImport = content.indexOf('"./')  !== -1 || content.indexOf('"../') !== -1 ||
                                 content.indexOf('\'./')  !== -1 || content.indexOf('\'../') !== -1
        browser.assert.ok(hasRelativeImport, 'Should preserve relative imports within the package')
      })
      .end()
  },

  'Test import rewriting with multiple packages #group3': function (browser: NightwatchBrowser) {
    browser
      .clickLaunchIcon('filePanel')
      .click('li[data-id="treeViewLitreeViewItemREADME.txt"')
      .addFile('UpgradeableNFT.sol', sources[0]['UpgradeableNFT.sol'])
      .clickLaunchIcon('solidity')
      .click('[data-id="compilerContainerCompileBtn"]')
      .pause(10000)  // Wait for compilation and all imports to resolve
      .clickLaunchIcon('filePanel')
      // Verify both packages were imported (contracts-upgradeable depends on contracts)
      .click('*[data-id="treeViewDivDraggableItem.deps"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
      .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts"]', 60000)
      .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts-upgradeable"]', 60000)
  },

  'Verify both package.json files exist #group3': function (browser: NightwatchBrowser) {
    browser
      // Verify contracts package.json
      .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts"]')
      .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts/package.json"]', 120000)
      .openFile('.deps/npm/@openzeppelin/contracts/package.json')
      .pause(1000)
      .getEditorValue((content) => {
        browser.assert.ok(content.indexOf('"name": "@openzeppelin/contracts"') !== -1, '@openzeppelin/contracts package.json should be saved')
      })
      .end()
  }
}

const sources = [
  {
    // Test with upgradeable contracts which import from both packages
    'UpgradeableNFT.sol': { 
      content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
` 
    }
  }
]
