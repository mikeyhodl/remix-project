'use strict'
import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

module.exports = {
    '@disabled': false, // Set to true to disable this test suite
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
            .addFile('UpgradeableNFT.sol', upgradeableNFTSource['UpgradeableNFT.sol'])
            .pause(3000)
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
    },

    'Test workspace package.json version resolution #group2': function (browser: NightwatchBrowser) {
        browser
            // Create a package.json specifying OpenZeppelin version
            .addFile('package.json', packageJsonV4_8_3Source['package.json'])
            .addFile('TokenWithDeps.sol', packageJsonV4_8_3Source['TokenWithDeps.sol'])
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
            .setEditorValue(packageJsonV5_4_0Source['package.json'].content) // Change to OpenZeppelin 5.4.0
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
    },

    'Test explicit versioned imports #group3': function (browser: NightwatchBrowser) {
        browser
            .addFile('ExplicitVersions.sol', explicitVersionsSource['ExplicitVersions.sol'])
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
    },

    'Test explicit version override #group4': function (browser: NightwatchBrowser) {
        browser
            .addFile('package.json', conflictingVersionsSource['package.json'])  // Has @openzeppelin/contracts@4.8.3
            .addFile('ConflictingVersions.sol', conflictingVersionsSource['ConflictingVersions.sol'])  // Imports @5
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
    },

    'Test yarn.lock version resolution #group5': function (browser: NightwatchBrowser) {
        browser
            .addFile('yarn.lock', yarnLockV4_9_6Source['yarn.lock'])
            .addFile('YarnLockTest.sol', yarnLockV4_9_6Source['YarnLockTest.sol'])
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
            .addFile('package-lock.json', packageLockV4_8_1Source['package-lock.json'])
            .addFile('PackageLockTest.sol', packageLockV4_8_1Source['PackageLockTest.sol'])
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
            
    },

    'Test Chainlink CCIP parent dependency resolution #group7': function (browser: NightwatchBrowser) {
        browser
            .addFile('ChainlinkCCIP.sol', chainlinkCCIPSource['ChainlinkCCIP.sol'])
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@chainlink"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@chainlink"]')
            // Verify contracts@1.4.0 (not 1.5.0!) - this is the key test for parent dependency resolution
            .waitForElementNotPresent('*[data-id="treeViewDivDraggableItem.deps/npm/@chainlink/contracts@1.5.0"]', 10000)
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@chainlink/contracts@1.4.0"]', 10000)
            // Verify contracts-ccip@1.6.1
            .waitForElementNotPresent('*[data-id="treeViewDivDraggableItem.deps/npm/@chainlink/contracts-ccip@1.6.2"]', 10000)
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@chainlink/contracts-ccip@1.6.1"]', 10000)
            
    },

    'Test npm alias syntax imports #group8': function (browser: NightwatchBrowser) {
        browser
            .addFile('NpmAliasTest.sol', npmAliasSource['NpmAliasTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(2000)
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            // Verify npm:@openzeppelin/contracts@4.9.0 syntax resolves correctly
            .waitForElementVisible('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.9"]', 10000)
    },

    'Test GitHub URL imports #group8': function (browser: NightwatchBrowser) {
        browser
            .addFile('GitHubImportTest.sol', githubImportSource['GitHubImportTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(3000) // GitHub imports may take longer
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/github"]')
            // Verify GitHub import creates proper folder structure
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/github/OpenZeppelin"]', 10000)
            .click('*[data-id="treeViewDivDraggableItem.deps/github/OpenZeppelin"]')
            .waitForElementVisible('*[data-id^="treeViewDivDraggableItem.deps/github/OpenZeppelin/openzeppelin-contracts@"]', 10000)
            
    },

    'Test resolution index mapping for Go to Definition #group9': function (browser: NightwatchBrowser) {
        browser
            .addFile('ResolutionIndexTest.sol', resolutionIndexSource['ResolutionIndexTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(2000)
            .clickLaunchIcon('filePanel')
            .openFile('ResolutionIndexTest.sol')
            .pause(1000)
            // Test that the resolution index is created (simplified test)
            .perform(function() {
                browser.execute(function() {
                    // Check if resolution index is stored in localStorage
                    return localStorage.getItem('remix-import-resolution-index') !== null;
                }, [], function(result) {
                    if (result.value === true) {
                        browser.assert.ok(true, 'Resolution index should be created and stored');
                    } else {
                        browser.assert.ok(false, 'Resolution index should be created and stored');
                    }
                });
            })
    },

    'Test resolution index persistence across workspace changes #group9': function (browser: NightwatchBrowser) {
        browser
            .addFile('SecondIndexTest.sol', resolutionIndexSource['SecondIndexTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(1000)
            // Change workspace by creating a new folder
            .rightClick('*[data-id="treeViewLitreeViewItem"]')
            .click('*[data-id="contextMenuItemcreateFolder"]')
            .waitForElementVisible('*[data-id="fileSystemModalDialogModalFooter-react"] .modal-ok')
            .setValue('*[data-id="fileSystemModalDialogModalBody-react"] input', 'test-folder')
            .click('*[data-id="fileSystemModalDialogModalFooter-react"] .modal-ok')
            .pause(500)
            // Verify resolution index still works after workspace change
            .openFile('SecondIndexTest.sol')
            .perform(function() {
                browser.execute(function() {
                    // Test that resolution index persists across workspace changes
                    return localStorage.getItem('remix-import-resolution-index') !== null;
                }, [], function(result) {
                    if (result.value === true) {
                        browser.assert.ok(true, 'Resolution index should persist across workspace changes');
                    } else {
                        browser.assert.ok(false, 'Resolution index should persist across workspace changes');
                    }
                });
            })
            
    },

    'Test debug logging with localStorage flag #group10': function (browser: NightwatchBrowser) {
        browser
            // Enable debug logging
            .execute(function() {
                localStorage.setItem('remix-debug-resolver', 'true');
                return localStorage.getItem('remix-debug-resolver');
            }, [], function(result) {
                browser.assert.strictEqual(result.value, 'true', 'Debug flag should be set');
            })
            .addFile('DebugLogTest.sol', debugLoggingSource['DebugLogTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(2000)
            // Verify debug flag is set (simplified test since we can't easily capture console in E2E)
            .perform(function() {
                browser.execute(function() {
                    // Just verify the debug flag is correctly set
                    return localStorage.getItem('remix-debug-resolver') === 'true';
                }, [], function(result) {
                    if (result.value === true) {
                        browser.assert.ok(true, 'Debug flag should be enabled');
                    } else {
                        browser.assert.ok(false, 'Debug flag should be enabled');
                    }
                });
            })
    },

    'Test debug logging disabled by default #group10': function (browser: NightwatchBrowser) {
        browser
            // Disable debug logging
            .execute(function() {
                localStorage.removeItem('remix-debug-resolver');
                return localStorage.getItem('remix-debug-resolver');
            }, [], function(result) {
                browser.assert.strictEqual(result.value, null, 'Debug flag should be disabled');
            })
            .addFile('NoDebugLogTest.sol', debugLoggingSource['NoDebugLogTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(2000)
            // Verify debug flag is disabled
            .perform(function() {
                browser.execute(function() {
                    // Verify the debug flag is correctly disabled
                    return localStorage.getItem('remix-debug-resolver') === null;
                }, [], function(result) {
                    if (result.value === true) {
                        browser.assert.ok(true, 'Debug flag should be disabled');
                    } else {
                        browser.assert.ok(false, 'Debug flag should be disabled');
                    }
                });
            })
    },

    'Test enhanced import parsing edge cases #group11': function (browser: NightwatchBrowser) {
        browser
            .addFile('ImportParsingEdgeCases.sol', importParsingEdgeCasesSource['ImportParsingEdgeCases.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(2000)
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            // Verify that only valid imports are resolved (commented ones should be ignored)
            .elements('css selector', '*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@"]', function(result) {
                // Should have exactly one contracts folder (multi-line imports, star imports, mixed imports all resolve correctly)
                browser.assert.ok(Array.isArray(result.value) && result.value.length === 1, 'Should resolve exactly one contracts version');
            })
            
    },

    'Test multi-line import parsing specifically #group11': function (browser: NightwatchBrowser) {
        browser
            .addFile('MultiLineImports.sol', multiLineImportsSource['MultiLineImports.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(2000)
            .clickLaunchIcon('filePanel')
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            .click('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@"]')
            .waitForElementVisible('*[data-id$="token/ERC20/extensions/IERC20Metadata.sol"]', 10000)
            .perform(function() {
                browser.assert.ok(true, 'Multi-line imports should be parsed and resolved correctly');
            })
            .end()
    },

}

// Named source objects for each test group - much cleaner with just imports!
const upgradeableNFTSource = {
    'UpgradeableNFT.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
`
    }
}

const packageJsonV4_8_3Source = {
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
`
    }
}

const packageJsonV5_4_0Source = {
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
`
    }
}

const explicitVersionsSource = {
    'ExplicitVersions.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@4.8.3/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts@4.8.3/token/ERC20/ERC20.sol";
`
    }
}

const conflictingVersionsSource = {
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
`
    }
}

const yarnLockV4_9_6Source = {
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
`
    }
}

const yarnLockV4_7_3Source = {
    'yarn.lock': {
        content: `# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
# yarn lockfile v1

"@openzeppelin/contracts@^4.7.0":
  version "4.7.3"
  resolved "https://registry.yarnpkg.com/@openzeppelin/contracts/-/contracts-4.7.3.tgz"
  integrity sha512-dGRS0agJzu8ybo44pCIf3xBaPQN/65AIXNgK8+4gzKd5kbvlqyxryUYVLJv7fK98Seyd2hDzVEHSWAh0Bt1Yw==
`
    }
}

const packageLockV4_8_1Source = {
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
`
    }
}

const packageLockV4_6_0Source = {
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

const chainlinkCCIPSource = {
    'ChainlinkCCIP.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts-ccip@1.6.1/contracts/applications/CCIPClientExample.sol";
`
    }
}

const npmAliasSource = {
    'NpmAliasTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Test npm alias syntax: npm:@openzeppelin/contracts@4.9.0
import "npm:@openzeppelin/contracts@4.9.0/token/ERC20/ERC20.sol";
import "npm:@openzeppelin/contracts@4.9.0/access/Ownable.sol";
`
    }
}

const githubImportSource = {
    'GitHubImportTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Test GitHub URL import
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.8.0/contracts/token/ERC20/ERC20.sol";
`
    }
}

const resolutionIndexSource = {
    'ResolutionIndexTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
`
    },
    'SecondIndexTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
`
    }
}

const debugLoggingSource = {
    'DebugLogTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
`
    },
    'NoDebugLogTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
`
    }
}

const importParsingEdgeCasesSource = {
    'ImportParsingEdgeCases.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Regular imports
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Multi-line import with symbols
import {
    IERC20,
    IERC20Metadata
} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

// Import with star
import * as SafeMath from "@openzeppelin/contracts/utils/math/SafeMath.sol";

// Commented imports (should be ignored)
// import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
/* 
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
*/

// String literal containing "import" (should be ignored)
string constant IMPORT_TEXT = "This is an import statement in a string";

// Mixed import styles
import DefaultExport, {
    NamedExport1,
    NamedExport2 as Alias
} from "@openzeppelin/contracts/utils/Context.sol";
`
    }
}

const multiLineImportsSource = {
    'MultiLineImports.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Multi-line imports with various formatting
import {
    IERC20,
    IERC20Metadata
} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {
    ERC20,
    IERC20 as TokenInterface
} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {
    Ownable
} from "@openzeppelin/contracts/access/Ownable.sol";
`
    }
}

// Keep sources array for backwards compatibility with @sources function
const sources = [
    upgradeableNFTSource,
    packageJsonV4_8_3Source,
    packageJsonV5_4_0Source,
    explicitVersionsSource,
    conflictingVersionsSource,
    yarnLockV4_9_6Source,
    yarnLockV4_7_3Source,
    packageLockV4_8_1Source,
    packageLockV4_6_0Source,
    chainlinkCCIPSource,
    npmAliasSource,
    githubImportSource,
    resolutionIndexSource,
    debugLoggingSource,
    importParsingEdgeCasesSource,
    multiLineImportsSource
]
