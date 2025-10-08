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

  'Test NPM Import with Versioned Folders #group1': function (browser: NightwatchBrowser) {
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
      // Verify versioned folder naming: contracts-upgradeable@VERSION
      .waitForElementPresent('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts-upgradeable@"]', 60000)
  },

  'Verify package.json in versioned folder #group1': function (browser: NightwatchBrowser) {
    browser
      .click('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts-upgradeable@"]')
      .waitForElementVisible('*[data-id$="/package.json"]', 120000)
      .pause(1000)
      .perform(function() {
        // Open the package.json (we need to get the exact selector dynamically)
        browser.elements('css selector', '*[data-id$="/package.json"]', function(result) {
          if (result.value && Array.isArray(result.value) && result.value.length > 0) {
            const selector = '*[data-id$="/package.json"]'
            browser.click(selector)
          }
        })
      })
      .pause(2000)
      .getEditorValue((content) => {
        browser.assert.ok(content.indexOf('"name": "@openzeppelin/contracts-upgradeable"') !== -1, 'package.json should contain package name')
        browser.assert.ok(content.indexOf('"version"') !== -1, 'package.json should contain version')
        browser.assert.ok(content.indexOf('"dependencies"') !== -1 || content.indexOf('"peerDependencies"') !== -1, 'package.json should contain dependencies')
      })
      .end()
  },

  'Test workspace package.json version resolution #group2': function (browser: NightwatchBrowser) {
    browser
      .clickLaunchIcon('filePanel')
      .click('li[data-id="treeViewLitreeViewItemREADME.txt"')
      // Create a package.json specifying OpenZeppelin version
      .addFile('package.json', sources[1]['package.json'])
      .addFile('TokenWithDeps.sol', sources[1]['TokenWithDeps.sol'])
      .clickLaunchIcon('solidity')
      .click('[data-id="compilerContainerCompileBtn"]')
      .pause(10000)  // Wait for compilation
      .clickLaunchIcon('filePanel')
      .click('*[data-id="treeViewDivDraggableItem.deps"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
      // Verify the correct version from package.json was used (4.8.3)
      .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.8.3"]', 60000)
  },

  'Verify canonical version is used consistently #group2': function (browser: NightwatchBrowser) {
    browser
      // Click on the versioned folder
      .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.8.3"]')
      .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.8.3/package.json"]')
      .openFile('.deps/npm/@openzeppelin/contracts@4.8.3/package.json')
      .pause(1000)
      .getEditorValue((content) => {
        const packageJson = JSON.parse(content)
        browser.assert.ok(packageJson.version === '4.8.3', 'Should use version 4.8.3 from workspace package.json')
      })
      .end()
  },

  'Test explicit versioned imports #group3': function (browser: NightwatchBrowser) {
    browser
      .clickLaunchIcon('filePanel')
      .click('li[data-id="treeViewLitreeViewItemREADME.txt"')
      .addFile('ExplicitVersions.sol', sources[2]['ExplicitVersions.sol'])
      .clickLaunchIcon('solidity')
      .click('[data-id="compilerContainerCompileBtn"]')
      .pause(10000)
      .clickLaunchIcon('filePanel')
      .click('*[data-id="treeViewDivDraggableItem.deps"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
      // Verify only ONE version folder exists (canonical version)
      .elements('css selector', '*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@"]', function(result) {
        // Should have only one @openzeppelin/contracts@ folder (deduplication works)
        if (Array.isArray(result.value)) {
          browser.assert.ok(result.value.length === 1, 'Should have exactly one versioned folder for @openzeppelin/contracts')
        }
      })
  },

  'Verify deduplication works correctly #group3': function (browser: NightwatchBrowser) {
    browser
      // Verify that even with explicit @4.8.3 version in imports, 
      // only ONE canonical version folder exists (deduplication)
      .waitForElementPresent('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@"]')
      // Verify package.json exists in the single canonical folder
      .click('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@"]')
      .waitForElementVisible('*[data-id$="contracts@4.8.3/package.json"]', 60000)
      .end()
  },

  'Test explicit version override #group4': function (browser: NightwatchBrowser) {
    browser
      .clickLaunchIcon('filePanel')
      .click('li[data-id="treeViewLitreeViewItemREADME.txt"')
      .addFile('package.json', sources[3]['package.json'])  // Has @openzeppelin/contracts@4.8.3
      .addFile('ConflictingVersions.sol', sources[3]['ConflictingVersions.sol'])  // Imports @5
      .clickLaunchIcon('solidity')
      .click('[data-id="compilerContainerCompileBtn"]')
      .pause(8000)
      .clickLaunchIcon('filePanel')
      // Verify that when explicit version @5 is used, it resolves to 5.x.x
      .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 60000)
      .click('*[data-id="treeViewDivDraggableItem.deps"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
      // Should have version 5.x.x (not 4.8.3 from package.json) because explicit @5 in import
      .waitForElementPresent('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@5"]', 10000)
      .end()
  },

  'Test yarn.lock version resolution #group5': function (browser: NightwatchBrowser) {
    browser
      .clickLaunchIcon('filePanel')
      .click('li[data-id="treeViewLitreeViewItemREADME.txt"')
      .addFile('yarn.lock', sources[4]['yarn.lock'])
      .addFile('YarnLockTest.sol', sources[4]['YarnLockTest.sol'])
      .clickLaunchIcon('solidity')
      .click('[data-id="compilerContainerCompileBtn"]')
      .pause(10000) // Longer pause for npm fetch
      .clickLaunchIcon('filePanel')
      .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 60000)
      .click('*[data-id="treeViewDivDraggableItem.deps"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
      .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
      // Should use version from yarn.lock (4.9.6)
      .waitForElementPresent('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.9"]', 10000)
      .end()
  }
}

const sources = [
  {
    // Test basic upgradeable contracts import
    'UpgradeableNFT.sol': { 
      content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract MyToken is Initializable, ERC1155Upgradeable, OwnableUpgradeable, ERC1155PausableUpgradeable, ERC1155BurnableUpgradeable {
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) initializer public {
        __ERC1155_init("");
        __Ownable_init(initialOwner);
        __ERC1155Pausable_init();
        __ERC1155Burnable_init();
    }
}
` 
    }
  },
  {
    // Test workspace package.json version resolution
    'package.json': {
      content: `{
  "name": "test-workspace",
  "version": "1.0.0",
  "dependencies": {
    "@openzeppelin/contracts": "4.8.3"
  }
}`
    },
    'TokenWithDeps.sol': {
      content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    constructor() ERC20("MyToken", "MTK") {}
}`
    }
  },
  {
    // Test explicit versioned imports get deduplicated
    'ExplicitVersions.sol': {
      content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@4.8.3/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts@4.8.3/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    // Both imports should resolve to same canonical version (deduplication)
    constructor() ERC20("MyToken", "MTK") {}
    
    function testInterface(IERC20 token) public view returns (uint256) {
        return token.totalSupply();
    }
}`
    }
  },
  {
    // Test version conflict scenarios
    'package.json': {
      content: `{
  "name": "conflict-test",
  "version": "1.0.0",
  "dependencies": {
    "@openzeppelin/contracts": "4.8.3"
  }
}`
    },
    'ConflictingVersions.sol': {
      content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Package.json has 4.8.3, but we explicitly request 5
import "@openzeppelin/contracts@5/token/ERC20/IERC20.sol";

contract MyToken {}`
    }
  },
  {
    // Test yarn.lock version resolution (group 5)
    'yarn.lock': {
      content: `# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
# yarn lockfile v1

"@openzeppelin/contracts@^4.9.0":
  version "4.9.6"
  resolved "https://registry.yarnpkg.com/@openzeppelin/contracts/-/contracts-4.9.6.tgz"
  integrity sha512-xSmezSupL+y9VkHZJGDoCBpmnB2ogM13ccaYDWqJTfS3dy96XIBCrAtOzko4xtrkR9Nj/Ox+oF+Y5C+RqXoRWA==
`
    },
    'YarnLockTest.sol': {
      content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    // Should resolve to 4.9.6 from yarn.lock
    constructor() ERC20("MyToken", "MTK") {}
}`
    }
  }
]
