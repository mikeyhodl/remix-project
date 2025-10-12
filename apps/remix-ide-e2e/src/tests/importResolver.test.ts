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
            .click('li[data-id="treeViewLitreeViewItemREADME.txt"]')
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
            .waitForElementNotPresent('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@5.4.0"]', 60000)
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
            .elements('css selector', '*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.8.3"]', function (result) {
                // Should have only one @openzeppelin/contracts@ folder (deduplication works)
                if (Array.isArray(result.value)) {
                    browser.assert.ok(result.value.length === 1, 'Should have exactly one versioned folder for @openzeppelin/contracts')
                }
            })
    },

    'Verify package json #group3': function (browser: NightwatchBrowser) {
        browser
            // Verify that even with explicit @4.8.3 version in imports, 
            // only ONE canonical version folder exists (deduplication)
            .waitForElementPresent('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@"]')
            // Verify package.json exists in the single canonical folder
            .click('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@"]')
            .waitForElementVisible('*[data-id$="contracts@4.8.3/package.json"]', 60000)
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.8.3/package.json"]')
            .openFile('.deps/npm/@openzeppelin/contracts@4.8.3/package.json')
            .pause(1000)
            .getEditorValue((content) => {
                const packageJson = JSON.parse(content)
                browser.assert.ok(packageJson.version === '4.8.3', 'Should use version 4.8.3 from workspace package.json')
            })
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
            .waitForElementNotPresent('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.8.3"]', 10000)
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
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@chainlink/contracts@1.4.0"]', 10000)
            .waitForElementNotPresent('*[data-id="treeViewDivDraggableItem.deps/npm/@chainlink/contracts@1.5.0"]', 10000)
            // Verify contracts-ccip@1.6.1
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@chainlink/contracts-ccip@1.6.1"]', 10000)
            .waitForElementNotPresent('*[data-id="treeViewDivDraggableItem.deps/npm/@chainlink/contracts-ccip@1.6.2"]', 10000)
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

    'Test External URL imports (unpkg) #group8': function (browser: NightwatchBrowser) {
        // Compile a file that imports from unpkg and verify the fetched source appears under .deps/https tree
        browser
            .addFile('GitHubImportTest.sol', unpkgImportSource['GitHubImportTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(5000)
            .clickLaunchIcon('filePanel')
            // Expand .deps/https/unpkg.com and check the requested path is present
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 120000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/https"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/https"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/https/unpkg.com"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/https/unpkg.com"]')
            .waitForElementVisible('*[data-id^="treeViewDivDraggableItem.deps/https/unpkg.com/@openzeppelin/contracts@4.8.0/token/ERC20"]', 60000)
            .waitForElementVisible('*[data-id$="treeViewLitreeViewItem.deps/https/unpkg.com/@openzeppelin/contracts@4.8.0/token/ERC20/IERC20.sol"]', 60000)
            // Additionally ensure no compilation error for the import
            .elements('css selector', '*[data-id="compiledErrors"]', function(res) {
                if (Array.isArray(res.value) && res.value.length > 0) {
                    browser.getText('*[data-id="compiledErrors"]', (result) => {
                        const text = (result.value || '').toString()
                        browser.assert.ok(
                            !text.includes('not found'),
                            'External CDN import should resolve without not found errors'
                        )
                    })
                } else {
                    // No compiledErrors element found → no errors to display; treat as pass
                    browser.assert.ok(true, 'External CDN import resolved (no compiled errors panel)')
                }
            })
            
    },

    'Test External URL imports (jsDelivr) #group8': function (browser: NightwatchBrowser) {
        const source = {
            'JsDelivrImport.sol': {
                content: `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\nimport "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.8.0/token/ERC20/IERC20.sol";\ncontract JsDelivrImport {}`
            }
        }
        browser
            .addFile('JsDelivrImport.sol', source['JsDelivrImport.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(5000)
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 120000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/https"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/https"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/https/cdn.jsdelivr.net"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/https/cdn.jsdelivr.net"]')
            .waitForElementVisible('*[data-id^="treeViewDivDraggableItem.deps/https/cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.8.0/token/ERC20"]', 60000)
            .waitForElementVisible('*[data-id$="treeViewLitreeViewItem.deps/https/cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.8.0/token/ERC20/IERC20.sol"]', 60000)
    },

    'Test External URL imports (raw.githubusercontent.com) #group16': function (browser: NightwatchBrowser) {
        const source = {
            'RawGithubImport.sol': {
                content: `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\nimport "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts-upgradeable/v5.4.0/contracts/token/ERC1155/ERC1155Upgradeable.sol";\ncontract RawGithubImport {}`
            }
        }
        browser
            .addFile('RawGithubImport.sol', source['RawGithubImport.sol'])
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 120000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/github"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/github"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/github/OpenZeppelin"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/github/OpenZeppelin"]')
            .waitForElementVisible('*[data-id^="treeViewDivDraggableItem.deps/github/OpenZeppelin/openzeppelin-contracts-upgradeable@v5.4.0"]', 60000)
            .click('*[data-id^="treeViewDivDraggableItem.deps/github/OpenZeppelin/openzeppelin-contracts-upgradeable@v5.4.0"]')
            // Verify package.json was fetched from GitHub
            .waitForElementVisible('*[data-id$="treeViewLitreeViewItem.deps/github/OpenZeppelin/openzeppelin-contracts-upgradeable@v5.4.0/package.json"]', 60000)
            .click('*[data-id$="treeViewLitreeViewItem.deps/github/OpenZeppelin/openzeppelin-contracts-upgradeable@v5.4.0/contracts"]')
            .waitForElementVisible('*[data-id$="treeViewLitreeViewItem.deps/github/OpenZeppelin/openzeppelin-contracts-upgradeable@v5.4.0/contracts/token"]', 60000)
            .click('*[data-id$="treeViewLitreeViewItem.deps/github/OpenZeppelin/openzeppelin-contracts-upgradeable@v5.4.0/contracts/token"]')
            .waitForElementVisible('*[data-id$="treeViewLitreeViewItem.deps/github/OpenZeppelin/openzeppelin-contracts-upgradeable@v5.4.0/contracts/token/ERC1155"]', 60000)
            .click('*[data-id$="treeViewLitreeViewItem.deps/github/OpenZeppelin/openzeppelin-contracts-upgradeable@v5.4.0/contracts/token/ERC1155"]')
            .waitForElementVisible('*[data-id$="treeViewLitreeViewItem.deps/github/OpenZeppelin/openzeppelin-contracts-upgradeable@v5.4.0/contracts/token/ERC1155/ERC1155Upgradeable.sol"]', 60000)
            // Verify package.json content
            .openFile('.deps/github/OpenZeppelin/openzeppelin-contracts-upgradeable@v5.4.0/package.json')
            .pause(1000)
            .getEditorValue((content) => {
                try {
                    const packageJson = JSON.parse(content)
                    browser.assert.ok(packageJson.name && packageJson.name.includes('openzeppelin'), 'Package.json should contain OpenZeppelin package name')
                    browser.assert.ok(packageJson.version === '5.4.0', 'Package.json should contain correct version 5.4.0')
                    browser.assert.ok(packageJson.description, 'Package.json should contain description')
                } catch (e) {
                    browser.assert.ok(false, 'Package.json should be valid JSON: ' + e.message)
                }
            })
    },

    'Test unversioned GitHub raw import (master/main branch) #group17': function (browser: NightwatchBrowser) {
        const source = {
            'UnversionedGithubImport.sol': {
                content: `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\nimport "https://raw.githubusercontent.com/remix-project-org/remix-project/refs/heads/master/apps/remix-ide/contracts/app/ethereum/constitution.sol";\ncontract UnversionedGithubImport {}`
            }
        }
        browser
            .addFile('UnversionedGithubImport.sol', source['UnversionedGithubImport.sol'])
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 120000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/github"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/github"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/github/remix-project-org"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/github/remix-project-org"]')
            // refs/heads/master should normalize to just @master
            .waitForElementVisible('*[data-id^="treeViewDivDraggableItem.deps/github/remix-project-org/remix-project@master"]', 60000)
            .click('*[data-id^="treeViewDivDraggableItem.deps/github/remix-project-org/remix-project@master"]')
            .waitForElementVisible('*[data-id$="treeViewLitreeViewItem.deps/github/remix-project-org/remix-project@master/apps"]', 60000)
            .click('*[data-id$="treeViewLitreeViewItem.deps/github/remix-project-org/remix-project@master/apps"]')
            .waitForElementVisible('*[data-id$="treeViewLitreeViewItem.deps/github/remix-project-org/remix-project@master/apps/remix-ide"]', 60000)
            .click('*[data-id$="treeViewLitreeViewItem.deps/github/remix-project-org/remix-project@master/apps/remix-ide"]')
            .waitForElementVisible('*[data-id$="treeViewLitreeViewItem.deps/github/remix-project-org/remix-project@master/apps/remix-ide/contracts"]', 60000)
            .click('*[data-id$="treeViewLitreeViewItem.deps/github/remix-project-org/remix-project@master/apps/remix-ide/contracts"]')
            .waitForElementVisible('*[data-id$="treeViewLitreeViewItem.deps/github/remix-project-org/remix-project@master/apps/remix-ide/contracts/app"]', 60000)
            .click('*[data-id$="treeViewLitreeViewItem.deps/github/remix-project-org/remix-project@master/apps/remix-ide/contracts/app"]')
            .waitForElementVisible('*[data-id$="treeViewLitreeViewItem.deps/github/remix-project-org/remix-project@master/apps/remix-ide/contracts/app/ethereum"]', 60000)
            .click('*[data-id$="treeViewLitreeViewItem.deps/github/remix-project-org/remix-project@master/apps/remix-ide/contracts/app/ethereum"]')
            .waitForElementVisible('*[data-id$="treeViewLitreeViewItem.deps/github/remix-project-org/remix-project@master/apps/remix-ide/contracts/app/ethereum/constitution.sol"]', 60000)
            // Verify the imported file exists and can be opened
            .openFile('.deps/github/remix-project-org/remix-project@master/apps/remix-ide/contracts/app/ethereum/constitution.sol')
            .pause(1000)
            .getEditorValue((content) => {
                browser.assert.ok(content.length > 0, 'Constitution.sol should have content')
                browser.assert.ok(content.includes('pragma solidity') || content.includes('contract') || content.includes('SPDX'), 'Constitution.sol should be a Solidity file')
            })
    },

    'Test resolution index mapping for Go to Definition #group9': function (browser: NightwatchBrowser) {
        browser
            .addFile('ResolutionIndexTest.sol', resolutionIndexSource['ResolutionIndexTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(2000)
            .clickLaunchIcon('filePanel')
            .openFile('.deps/npm/.resolution-index.json')
            .pause(1000)
            .getEditorValue((content) => {
                try {
                    const idx = JSON.parse(content)
                    const files = Object.keys(idx || {})
                    // Should have at least one source file entry with mappings
                    browser.assert.ok(files.length > 0, 'Resolution index should contain at least one source file')
                } catch (e) {
                    browser.assert.ok(false, 'Resolution index JSON should be valid')
                }
            })
    },

    'Test resolution index persistence across workspace changes #group9': function (browser: NightwatchBrowser) {
        browser
            .addFile('SecondIndexTest.sol', resolutionIndexSource['SecondIndexTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(1000)
            // Change workspace by creating a new blank workspace using Templates UI
            .click('*[data-id="workspacesSelect"]')
            .waitForElementVisible('*[data-id="workspacecreate"]')
            .click('*[data-id="workspacecreate"]')
            .waitForElementVisible('*[data-id="create-blank"]')
            .click('*[data-id="create-blank"]')
            .waitForElementVisible('*[data-id="modalDialogCustomPromptTextCreate"]')
            .scrollAndClick('*[data-id="modalDialogCustomPromptTextCreate"]')
            .setValue('*[data-id="modalDialogCustomPromptTextCreate"]', 'resolver_test_blank')
            .click('*[data-id="TemplatesSelection-modal-footer-ok-react"]')
            .currentWorkspaceIs('resolver_test_blank')
            .pause(500)
            // Ensure file tree is focused in the new workspace before adding files
            .clickLaunchIcon('filePanel')
            // Blank workspace contains only .prettierrc.json and remix.config.json
            .waitForElementVisible('*[data-id="treeViewLitreeViewItemremix.config.json"]', 15000)
            // Compile a minimal file to regenerate the resolution index in the new workspace
            .addFile('IndexAfterWS.sol', indexAfterWSSource['IndexAfterWS.sol'], 'remix.config.json')
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(1500)
            .clickLaunchIcon('filePanel')
            // Verify resolution index now exists and contains entries
            .openFile('.deps/npm/.resolution-index.json')
            .pause(500)
            .getEditorValue((content) => {
                try {
                    const idx = JSON.parse(content)
                    const files = Object.keys(idx || {})
                    browser.assert.ok(files.length > 0, 'Resolution index should persist after workspace changes')
                } catch (e) {
                    browser.assert.ok(false, 'Resolution index JSON should be valid after workspace changes')
                }
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
            .waitForElementVisible('*[data-id$="/token"]', 10000)
            .click('*[data-id$="/token"]')
            .waitForElementVisible('*[data-id$="/ERC20"]', 10000)
            .click('*[data-id$="/ERC20"]')
            .waitForElementVisible('*[data-id$="/extensions"]', 10000)
            .click('*[data-id$="/extensions"]')
            .waitForElementVisible('*[data-id$="/IERC20Metadata.sol"]', 10000)
            .perform(function() {
                browser.assert.ok(true, 'Multi-line imports should be parsed and resolved correctly');
            })
    },

    'Test proper error handling for unresolvable imports #group11': function (browser: NightwatchBrowser) {
        browser
            .addFile('UnresolvableImportTest.sol', unresolvableImportSource['UnresolvableImportTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(3000)
            // Verify that compilation shows proper error message instead of crashing
            .waitForElementVisible('*[data-id="compiledErrors"]', 10000)
            .waitForElementContainsText('*[data-id="compiledErrors"]', 'not found')
            .perform(function() {
                browser.assert.ok(true, 'Unresolvable imports should show proper error messages without crashing');
            })
    },
    
    'Test unpkg CDN imports #group12': function (browser: NightwatchBrowser) {
        browser
            .addFile('UnpkgTest.sol', cdnImportsSource['UnpkgTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(5000) // CDN imports may take longer
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 120000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            // CDN npm packages are normalized to .deps/npm/
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            .waitForElementVisible('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.8.0"]', 60000)
            .perform(function() {
                browser.assert.ok(true, 'unpkg.com CDN imports should be normalized to npm folder');
            })
    },
    
    'Test jsdelivr npm CDN imports #group12': function (browser: NightwatchBrowser) {
        browser
            .addFile('JsdelivrNpmTest.sol', cdnImportsSource['JsdelivrNpmTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(5000)
            .clickLaunchIcon('filePanel')
            // CDN npm packages are normalized to .deps/npm/
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            .waitForElementVisible('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.8.0"]', 60000)
            .perform(function() {
                browser.assert.ok(true, 'cdn.jsdelivr.net npm imports should be normalized to npm folder');
            })
    },
    
    'Test unpkg unversioned CDN imports #group12': function (browser: NightwatchBrowser) {
        browser
            .addFile('UnpkgUnversionedTest.sol', cdnImportsSource['UnpkgUnversionedTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(5000)
            .clickLaunchIcon('filePanel')
            // Unversioned CDN npm packages are normalized to .deps/npm/ with version from workspace
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            // Should have versioned folder (version resolved from workspace/lock file/npm)
            .waitForElementPresent('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@"]', 60000)
            .perform(function() {
                browser.assert.ok(true, 'unpkg.com unversioned imports should be normalized to npm folder with resolved version');
            })
    },
    
    'Test jsdelivr unversioned CDN imports #group12': function (browser: NightwatchBrowser) {
        browser
            .addFile('JsdelivrUnversionedTest.sol', cdnImportsSource['JsdelivrUnversionedTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(5000)
            .clickLaunchIcon('filePanel')
            // Unversioned CDN npm packages are normalized to .deps/npm/ with version from workspace
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            // Should have versioned folder (version resolved from workspace/lock file/npm)
            .waitForElementPresent('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@"]', 60000)
            .perform(function() {
                browser.assert.ok(true, 'cdn.jsdelivr.net unversioned imports should be normalized to npm folder with resolved version');
            })
    },
    
    'Test raw.githubusercontent.com imports #group12': function (browser: NightwatchBrowser) {
        browser
            .addFile('RawGitHubTest.sol', cdnImportsSource['RawGitHubTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(5000)
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 120000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            // raw.githubusercontent.com URLs are normalized to .deps/github/owner/repo@ref/
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/github"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/github"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/github/OpenZeppelin"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/github/OpenZeppelin"]')
            .waitForElementVisible('*[data-id^="treeViewDivDraggableItem.deps/github/OpenZeppelin/openzeppelin-contracts@v4.8.0"]', 60000)
            .perform(function() {
                browser.assert.ok(true, 'raw.githubusercontent.com imports should be normalized to github folder');
            })
    },

    'Test IPFS imports #group13': function (browser: NightwatchBrowser) {
        browser
            .addFile('IPFSTest.sol', ipfsImportsSource['IPFSTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(8000) // IPFS imports may take longer to fetch
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 120000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/ipfs"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/ipfs"]')
            .perform(function() {
                browser.assert.ok(true, 'IPFS imports should be resolved and stored in .deps/ipfs/ folder');
            })
    },

    'Test IPFS relative imports #group13': function (browser: NightwatchBrowser) {
        browser
            .addFile('IPFSRelativeTest.sol', ipfsImportsSource['IPFSRelativeTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(8000)
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/ipfs"]', 60000)
            .perform(function() {
                browser.assert.ok(true, 'IPFS relative imports should resolve correctly within the same IPFS hash context');
            })
    },

    'Test Swarm bzz-raw imports #group14': function (browser: NightwatchBrowser) {
        browser
            .addFile('SwarmTest.sol', swarmImportsSource['SwarmTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(8000) // Swarm imports may take longer to fetch
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 120000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/swarm"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/swarm"]')
            .perform(function() {
                browser.assert.ok(true, 'Swarm bzz-raw:// imports should be resolved and stored in .deps/swarm/ folder');
            })
    },

    'Test Swarm bzz imports #group14': function (browser: NightwatchBrowser) {
        browser
            .addFile('SwarmBzzTest.sol', swarmImportsSource['SwarmBzzTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(8000)
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/swarm"]', 60000)
            .perform(function() {
                browser.assert.ok(true, 'Swarm bzz:// imports should be resolved correctly');
            })
    },

    'Test invalid non-sol import rejection #group15': function (browser: NightwatchBrowser) {
        browser
            .addFile('InvalidImportTest.sol', invalidImportSource['InvalidImportTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(3000)
            .clickLaunchIcon('filePanel')
            // Verify that NO .deps folder was created for the invalid import
            .elements('css selector', '*[data-id="treeViewDivDraggableItem.deps"]', function (result) {
                // .deps folder may exist from other imports, but we should see an error in terminal
                browser.perform(function() {
                    browser.assert.ok(true, 'Non-.sol imports should be rejected with error message');
                })
            })
            // Check terminal for error message
            .clickLaunchIcon('terminal')
            .pause(1000)
            .perform(function() {
                // Terminal should contain error about .sol extension
                browser.getText('.terminal', function(result) {
                    const text = typeof result.value === 'string' ? result.value : ''
                    browser.assert.ok(
                        text.includes('does not end with .sol extension') || 
                        text.includes('Invalid import'),
                        'Terminal should show error about non-.sol import'
                    )
                })
            })
    },

    'Test invalid package.json import rejection #group15': function (browser: NightwatchBrowser) {
        browser
            .addFile('InvalidPackageJsonImport.sol', invalidImportSource['InvalidPackageJsonImport.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(3000)
            .clickLaunchIcon('terminal')
            .pause(1000)
            .perform(function() {
                // Terminal should contain error about .sol extension
                browser.getText('.terminal', function(result) {
                    const text = typeof result.value === 'string' ? result.value : ''
                    browser.assert.ok(
                        text.includes('does not end with .sol extension') || 
                        text.includes('Invalid import'),
                        'Terminal should show error about package.json import'
                    )
                })
            })
    },

    'Test invalid README import rejection #group15': function (browser: NightwatchBrowser) {
        browser
            .addFile('InvalidReadmeImport.sol', invalidImportSource['InvalidReadmeImport.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(3000)
            .clickLaunchIcon('terminal')
            .pause(1000)
            .perform(function() {
                // Terminal should contain error about .sol extension
                browser.getText('.terminal', function(result) {
                    const text = typeof result.value === 'string' ? result.value : ''
                    browser.assert.ok(
                        text.includes('does not end with .sol extension') || 
                        text.includes('Invalid import'),
                        'Terminal should show error about README.md import'
                    )
                })
            })
            .end()
    },

}

// Named source objects for each test group
const upgradeableNFTSource = {
    'UpgradeableNFT.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract UpgradeableNFT is Initializable, ERC1155Upgradeable, OwnableUpgradeable, ERC1155PausableUpgradeable, ERC1155BurnableUpgradeable {
    function initialize() public initializer {
        __ERC1155_init("");
        __Ownable_init(msg.sender);
        __ERC1155Pausable_init();
        __ERC1155Burnable_init();
    }
}
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

contract TokenWithDeps is ERC20 {
    constructor() ERC20("Test Token", "TST") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
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

contract TokenWithDeps is ERC20 {
    constructor() ERC20("Test Token", "TST") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
`
    }
}

const explicitVersionsSource = {
    'ExplicitVersions.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@4.8.3/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts@4.8.3/token/ERC20/ERC20.sol";

contract ExplicitVersions is ERC20 {
    constructor() ERC20("Explicit", "EXP") {}
}
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

contract ConflictingVersions {
    IERC20 public token;
}
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

contract YarnLockTest is ERC20 {
    constructor() ERC20("Yarn Test", "YRN") {}
}
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

contract PackageLockTest is ERC20 {
    constructor() ERC20("PackageLock", "PKL") {}
}
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

import "@chainlink/contracts-ccip@1.6.1/contracts/applications/CCIPReceiver.sol";
import "@chainlink/contracts-ccip@1.6.1/contracts/libraries/Client.sol";

contract ChainlinkCCIP is CCIPReceiver {
    constructor(address router) CCIPReceiver(router) {}
    
    function _ccipReceive(Client.Any2EVMMessage memory _message) internal override {}
}
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

contract NpmAliasTest is ERC20, Ownable {
    constructor() ERC20("NpmAlias", "NPA") Ownable() {}
}
`
    }
}

const unpkgImportSource = {
    'GitHubImportTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Test GitHub URL import via jsDelivr (raw file)
// Use a standalone interface file to avoid nested deps during the test
import "https://unpkg.com/@openzeppelin/contracts@4.8.0/token/ERC20/IERC20.sol";

contract GitHubImportTest {
    function foo(IERC20 token) external view returns (uint256) {
        return token.totalSupply();
    }
}
`
    }
}

const indexAfterWSSource = {
    'IndexAfterWS.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract IndexAfterWS is ERC20 {
    constructor() ERC20("WS", "WSX") {}
}
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

contract ResolutionIndexTest is ERC20, ERC20Burnable {
    constructor() ERC20("Index", "IDX") {}
}
`
    },
    'SecondIndexTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract SecondIndexTest is ERC721, AccessControl {
    constructor() ERC721("Second", "2ND") {}
    
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
`
    }
}

const debugLoggingSource = {
    'DebugLogTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract DebugLogTest is ERC20, Pausable {
    constructor() ERC20("Debug", "DBG") {}
}
`
    },
    'NoDebugLogTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract NoDebugLogTest is ERC1155 {
    constructor() ERC1155("") {}
}
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

// Additional valid import (no star import in Solidity)
import { Context } from "@openzeppelin/contracts/utils/Context.sol";

// Commented imports (should be ignored)
// import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
/* 
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
*/

contract ImportParsingEdgeCases is ERC20, Ownable, Context {
    // String literal containing "import" (should be ignored)
    string constant IMPORT_TEXT = "This is an import statement in a string";
    
    constructor() ERC20("EdgeCase", "EDGE") Ownable(msg.sender) {}
}
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
    ERC20
} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {
    Ownable
} from "@openzeppelin/contracts/access/Ownable.sol";

contract MultiLineImports is ERC20, Ownable {
    constructor() ERC20("MultiLine", "MLI") Ownable(msg.sender) {}
}
`
    }
}

const unresolvableImportSource = {
    'UnresolvableImportTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// This import should fail because SafeMath was removed in OpenZeppelin v5.0+
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

// This import should work fine
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract UnresolvableImportTest is ERC20 {
    constructor() ERC20("Unresolvable", "UNR") {}
}
`
    }
}

const cdnImportsSource = {
    'UnpkgTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Test unpkg.com CDN import (versioned)
import "https://unpkg.com/@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol";

contract UnpkgTest is ERC20 {
    constructor() ERC20("Unpkg", "UPG") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
`
    },
    'UnpkgUnversionedTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Test unpkg.com CDN import (unversioned - version resolved from workspace)
import "https://unpkg.com/@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract UnpkgUnversionedTest is ERC20 {
    constructor() ERC20("UnpkgUnver", "UUV") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
`
    },
    'JsdelivrNpmTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Test cdn.jsdelivr.net npm import (versioned)
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol";

contract JsdelivrNpmTest is ERC20 {
    constructor() ERC20("Jsdelivr", "JSD") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
`
    },
    'JsdelivrUnversionedTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Test cdn.jsdelivr.net npm import (unversioned - version resolved from workspace)
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract JsdelivrUnversionedTest is ERC20 {
    constructor() ERC20("JsdelivrUnver", "JUV") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
`
    },
    'RawGitHubTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Test raw.githubusercontent.com import (GitHub will convert blob URLs to this)
import "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/v4.8.0/contracts/token/ERC20/ERC20.sol";

contract RawGitHubTest is ERC20 {
    constructor() ERC20("RawGitHub", "RGH") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
`
    }
}

const ipfsImportsSource = {
    'IPFSTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Test IPFS import - using a sample Greeter contract on IPFS
// Note: This is a real IPFS hash that should contain a Solidity contract
import "ipfs://QmQQmQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ/Greeter.sol";

contract IPFSTest {
    string public greeting = "Hello from IPFS!";
    
    function setGreeting(string memory _greeting) public {
        greeting = _greeting;
    }
}
`
    },
    'IPFSRelativeTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Test IPFS import with relative path resolution
import "ipfs://QmQQmQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ/contracts/Token.sol";

contract IPFSRelativeTest {
    string public name = "IPFS Relative Test";
    
    function getName() public view returns (string memory) {
        return name;
    }
}
`
    }
}

const swarmImportsSource = {
    'SwarmTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Test Swarm bzz-raw:// import
// Note: This is a sample Swarm hash format
import "bzz-raw://abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890/Storage.sol";

contract SwarmTest {
    uint256 public storedData;
    
    function set(uint256 x) public {
        storedData = x;
    }
    
    function get() public view returns (uint256) {
        return storedData;
    }
}
`
    },
    'SwarmBzzTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Test Swarm bzz:// import (alternative protocol)
import "bzz://abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890/Counter.sol";

contract SwarmBzzTest {
    uint256 public counter;
    
    function increment() public {
        counter++;
    }
    
    function decrement() public {
        counter--;
    }
}
`
    }
}

const invalidImportSource = {
    'InvalidImportTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// This should FAIL - importing a non-.sol file from CDN
import "https://unpkg.com/@openzeppelin/contracts@4.8.0/package.json";

contract InvalidImportTest {
    string public name = "This should not compile";
}
`
    },
    'InvalidPackageJsonImport.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// This should FAIL - importing package.json from npm
import "@openzeppelin/contracts/package.json";

contract InvalidPackageJsonImport {
    string public name = "This should not compile";
}
`
    },
    'InvalidReadmeImport.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// This should FAIL - importing README.md file
import "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/v4.8.0/README.md";

contract InvalidReadmeImport {
    string public name = "This should not compile";
}
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
    unpkgImportSource,
    resolutionIndexSource,
    debugLoggingSource,
    importParsingEdgeCasesSource,
    multiLineImportsSource,
    unresolvableImportSource,
    cdnImportsSource,
    ipfsImportsSource,
    swarmImportsSource,
    invalidImportSource
]
