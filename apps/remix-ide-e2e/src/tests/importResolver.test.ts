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
            .perform(function () {
                // Open the package.json (we need to get the exact selector dynamically)
                browser.elements('css selector', '*[data-id$="/package.json"]', function (result) {
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
            .pause(2000)  // Wait for compilation
            .clickLaunchIcon('filePanel')
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            // Verify the correct version from package.json was used (4.8.3)
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.8.3"]', 60000)
            .openFile('package.json')
            .setEditorValue(sources[2]['package.json'].content) // Change to OpenZeppelin 5.4.0
            .pause(1000)
            .openFile('TokenWithDeps.sol')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@5.4.0"]', 60000)
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
            .addFile('ExplicitVersions.sol', sources[3]['ExplicitVersions.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(1000)
            .clickLaunchIcon('filePanel')
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            // Verify only ONE version folder exists (canonical version)
            .elements('css selector', '*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@"]', function (result) {
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
            .addFile('package.json', sources[4]['package.json'])  // Has @openzeppelin/contracts@4.8.3
            .addFile('ConflictingVersions.sol', sources[4]['ConflictingVersions.sol'])  // Imports @5
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(1000)
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
            .addFile('yarn.lock', sources[5]['yarn.lock'])
            .addFile('YarnLockTest.sol', sources[5]['YarnLockTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(1000) // Longer pause for npm fetch
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            // Should use version from yarn.lock (4.9.6)
            .waitForElementPresent('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.9"]', 10000)
    },

    'Test package-lock.json version resolution #group6': function (browser: NightwatchBrowser) {
        browser
            .clickLaunchIcon('filePanel')
            .click('li[data-id="treeViewLitreeViewItemREADME.txt"')
            .addFile('package-lock.json', sources[7]['package-lock.json'])
            .addFile('PackageLockTest.sol', sources[7]['PackageLockTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(1000)
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            // Should use version from package-lock.json (4.8.1)
            .waitForElementPresent('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.8.1"]', 10000)
            .end()
    },

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
        // Test workspace package.json version resolution
        'package.json': {
            content: `{
  "name": "test-workspace",
  "version": "1.0.0",
  "dependencies": {
    "@openzeppelin/contracts": "5.4.0"
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
    },
    {
        // Test yarn.lock change detection (group 5) - Changed version to 4.7.3
        'yarn.lock': {
            content: `# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
# yarn lockfile v1

"@openzeppelin/contracts@^4.7.0":
  version "4.7.3"
  resolved "https://registry.yarnpkg.com/@openzeppelin/contracts/-/contracts-4.7.3.tgz"
  integrity sha512-dGRS0agJzu8ybo44pCIf3xBaPQN/65AIXNgK8+4gzKd5kbvlqyxryUYVLJv7fK98Seyd2hDzVEHSWAh0Bt1Yw==
`
        }
    },
    {
        // Test package-lock.json version resolution (group 6)
        'package-lock.json': {
            content: `{
  "name": "remix-project",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "remix-project",
      "version": "1.0.0",
      "dependencies": {
        "@openzeppelin/contracts": "^4.8.0"
      }
    },
    "node_modules/@openzeppelin/contracts": {
      "version": "4.8.1",
      "resolved": "https://registry.npmjs.org/@openzeppelin/contracts/-/contracts-4.8.1.tgz",
      "integrity": "sha512-xQ6v385CMc2Qnn1H3bKXB8gEtXCCB8iYS4Y4BS3XgNpvBzXDgLx4NN8q8TV3B0S7o0+yD4CRBb/2W2mlYWKHdg=="
    }
  }
}`
        },
        'PackageLockTest.sol': {
            content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    // Should resolve to 4.8.1 from package-lock.json
    constructor() ERC20("MyToken", "MTK") {}
}`
        }
    },
    {
        // Test package-lock.json change detection (group 6) - Changed version to 4.6.0
        'package-lock.json': {
            content: `{
  "name": "remix-project",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "remix-project",
      "version": "1.0.0",
      "dependencies": {
        "@openzeppelin/contracts": "^4.6.0"
      }
    },
    "node_modules/@openzeppelin/contracts": {
      "version": "4.6.0",
      "resolved": "https://registry.npmjs.org/@openzeppelin/contracts/-/contracts-4.6.0.tgz",
      "integrity": "sha512-8vi4d50NNya/bQqCTNr9oGZXGQs7VRuXVZ5ivW7s3t+a76p/sU4Mbq3XBT3aKfpixiO14SV1jqFoXsdyHYiP8g=="
    }
  }
}`
        }
    }
]
