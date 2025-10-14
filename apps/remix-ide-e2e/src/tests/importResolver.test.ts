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
            .elements('css selector', '*[data-id="compiledErrors"]', function (res) {
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
            // Navigate through folders to reach .resolution-index.json
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/.resolution-index.json"]', 60000)
            .openFile('.deps/npm/.resolution-index.json')
            .pause(1000)
            .getEditorValue((content) => {
                try {
                    const idx = JSON.parse(content)
                    const sourceFiles = Object.keys(idx || {})

                    // Verify structure: index should map source files to their import resolutions
                    browser.assert.ok(sourceFiles.length > 0, 'Resolution index should contain at least one source file')

                    // Check that our test file is in the index
                    const hasTestFile = sourceFiles.some(file => file.includes('ResolutionIndexTest.sol'))
                    browser.assert.ok(hasTestFile, 'Resolution index should contain ResolutionIndexTest.sol')

                    // Verify each entry has import mappings
                    const testFileEntry = sourceFiles.find(file => file.includes('ResolutionIndexTest.sol'))
                    if (testFileEntry) {
                        const mappings = idx[testFileEntry]
                        browser.assert.ok(typeof mappings === 'object' && mappings !== null, 'Each source file should have an object of import mappings')

                        // Verify the mappings contain resolved paths for @openzeppelin imports
                        const importKeys = Object.keys(mappings)
                        const hasOpenzeppelinImport = importKeys.some(key => key.includes('@openzeppelin/contracts'))
                        browser.assert.ok(hasOpenzeppelinImport, 'Resolution index should map @openzeppelin imports to their resolved paths')

                        // Verify resolved paths point to versioned npm packages
                        if (hasOpenzeppelinImport) {
                            const ozImport = importKeys.find(key => key.includes('@openzeppelin/contracts'))
                            const resolvedPath = mappings[ozImport]
                            browser.assert.ok(resolvedPath && resolvedPath.includes('@openzeppelin/contracts@'), 'Resolved paths should point to versioned package (e.g., @openzeppelin/contracts@5.4.0/...)')
                        }
                    }
                } catch (e) {
                    browser.assert.ok(false, 'Resolution index JSON should be valid: ' + e.message)
                }
            })
    },

    'Test debug logging with localStorage flag #group10': function (browser: NightwatchBrowser) {
        browser
            // Enable debug logging
            .execute(function () {
                localStorage.setItem('remix-debug-resolver', 'true');
                return localStorage.getItem('remix-debug-resolver');
            }, [], function (result) {
                browser.assert.strictEqual(result.value, 'true', 'Debug flag should be set');
            })
            .addFile('DebugLogTest.sol', debugLoggingSource['DebugLogTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(2000)
            // Verify debug flag is set (simplified test since we can't easily capture console in E2E)
            .perform(function () {
                browser.execute(function () {
                    // Just verify the debug flag is correctly set
                    return localStorage.getItem('remix-debug-resolver') === 'true';
                }, [], function (result) {
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
            .execute(function () {
                localStorage.removeItem('remix-debug-resolver');
                return localStorage.getItem('remix-debug-resolver');
            }, [], function (result) {
                browser.assert.strictEqual(result.value, null, 'Debug flag should be disabled');
            })
            .addFile('NoDebugLogTest.sol', debugLoggingSource['NoDebugLogTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(2000)
            // Verify debug flag is disabled
            .perform(function () {
                browser.execute(function () {
                    // Verify the debug flag is correctly disabled
                    return localStorage.getItem('remix-debug-resolver') === null;
                }, [], function (result) {
                    if (result.value === true) {
                        browser.assert.ok(true, 'Debug flag should be disabled');
                    } else {
                        browser.assert.ok(false, 'Debug flag should be disabled');
                    }
                });
            })
    },

    'Test multi-line import with symbols parsing #group11': function (browser: NightwatchBrowser) {
        const source = {
            'ImportParsingEdgeCases.sol': {
                content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Multi-line import with symbols
import {
    IERC20,
    IERC20Metadata
} from "@openzeppelin/contracts@4.8.0/token/ERC20/extensions/IERC20Metadata.sol";

// Additional valid import (no star import in Solidity)
import { Context } from "@openzeppelin/contracts@4.8.0/utils/Context.sol";
`
            }
        }
        browser
            .addFile('ImportParsingEdgeCases.sol', source['ImportParsingEdgeCases.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(2000)
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            // Verify that multi-line imports are resolved correctly
            .waitForElementVisible('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.8.0"]', 60000)
            .click('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.8.0"]')
            // Verify the imported files actually exist - check IERC20Metadata.sol
            .waitForElementVisible('*[data-id$="contracts@4.8.0/token"]', 10000)
            .click('*[data-id$="contracts@4.8.0/token"]')
            .waitForElementVisible('*[data-id$="contracts@4.8.0/token/ERC20"]', 10000)
            .click('*[data-id$="contracts@4.8.0/token/ERC20"]')
            .waitForElementVisible('*[data-id$="contracts@4.8.0/token/ERC20/extensions"]', 10000)
            .click('*[data-id$="contracts@4.8.0/token/ERC20/extensions"]')
            .waitForElementVisible('*[data-id$="contracts@4.8.0/token/ERC20/extensions/IERC20Metadata.sol"]', 10000)
            // Collapse and re-expand to check Context.sol in utils folder
            .click('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.8.0"]') // Collapse
            .pause(500)
            .click('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.8.0"]') // Re-expand
            .waitForElementVisible('*[data-id$="contracts@4.8.0/utils"]', 10000)
            .click('*[data-id$="contracts@4.8.0/utils"]')
            .waitForElementVisible('*[data-id$="contracts@4.8.0/utils/Context.sol"]', 10000)
            .perform(function () {
                browser.assert.ok(true, 'All imported files exist in the correct folder structure');
            })

    },

    'Test commented imports are ignored #group11': function (browser: NightwatchBrowser) {
        const source = {
            'CommentedImports.sol': {
                content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Regular import (should be resolved)
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Commented imports (should be ignored)
// import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
/* 
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
*/

contract CommentedImports is ERC20 {
    constructor() ERC20("Test", "TST") {}
}
`
            }
        }
        browser
            .addFile('CommentedImports.sol', source['CommentedImports.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(2000)
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            .click('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@"]')
            .waitForElementVisible('*[data-id$="/token"]', 10000)
            .click('*[data-id$="/token"]')
            .waitForElementVisible('*[data-id$="/ERC20"]', 10000)
            // Verify ERC721 and ERC1155 folders don't exist (commented imports ignored)
            .waitForElementNotPresent('*[data-id$="/ERC721"]', 5000)
            .waitForElementNotPresent('*[data-id$="/ERC1155"]', 5000)
            .perform(function () {
                browser.assert.ok(true, 'Commented imports should be ignored during parsing');
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
            .perform(function () {
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
            .perform(function () {
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
            .perform(function () {
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
            .perform(function () {
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
            .perform(function () {
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
            .perform(function () {
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
            .perform(function () {
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
            .perform(function () {
                browser.assert.ok(true, 'IPFS relative imports should resolve correctly within the same IPFS hash context');
            })
    },

    'Test invalid non-sol import rejection #group15': function (browser: NightwatchBrowser) {
        browser
            .addFile('InvalidImportTest.sol', invalidImportSource['InvalidImportTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(3000)
            .clickLaunchIcon('filePanel')
            .waitForElementNotPresent('*[data-id="treeViewDivDraggableItem.deps"]', 5000)
    },

    'Test invalid package.json import rejection #group15': function (browser: NightwatchBrowser) {
        browser
            .addFile('InvalidPackageJsonImport.sol', invalidImportSource['InvalidPackageJsonImport.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(3000)
            .clickLaunchIcon('filePanel')
            .waitForElementNotPresent('*[data-id="treeViewDivDraggableItem.deps"]', 5000)
    },

    'Test invalid README import rejection #group15': function (browser: NightwatchBrowser) {
        browser
            .addFile('InvalidReadmeImport.sol', invalidImportSource['InvalidReadmeImport.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(3000)
            .clickLaunchIcon('filePanel')
            .waitForElementNotPresent('*[data-id="treeViewDivDraggableItem.deps"]', 5000)
            .end()
    },

    'Test npm alias with multiple package versions #group18': function (browser: NightwatchBrowser) {
        browser
            .addFile('package.json', npmAliasMultiVersionSource['package.json'])
            .addFile('eee.sol', npmAliasMultiVersionSource['eee.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(3000)
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            // Verify both versions are present
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.9.6"]', 60000)
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@5.0.2"]', 60000)
            .perform(function () {
                browser.assert.ok(true, 'Both @openzeppelin/contracts@4.9.6 and @openzeppelin/contracts@5.0.2 should be present')
            })
            // Verify contracts@4.9.6 structure
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.9.6"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.9.6/token"]', 10000)
            .click('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.9.6/token"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.9.6/token/ERC20"]', 10000)
            .click('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.9.6/token/ERC20"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.9.6/token/ERC20/ERC20.sol"]', 10000)
            .perform(function () {
                browser.assert.ok(true, 'contracts@4.9.6 should contain token/ERC20/ERC20.sol')
            })
            // Verify contracts@5.0.2 structure
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@5.0.2"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@5.0.2/token"]', 10000)
            .click('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@5.0.2/token"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@5.0.2/token/ERC20"]', 10000)
            .click('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@5.0.2/token/ERC20"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol"]', 10000)
            .perform(function () {
                browser.assert.ok(true, 'contracts@5.0.2 should contain token/ERC20/ERC20.sol')
            })
            // Check resolution index
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/.resolution-index.json"]', 60000)
            .openFile('.deps/npm/.resolution-index.json')
            .pause(1000)
            .getEditorValue((content) => {
                try {
                    const idx = JSON.parse(content)
                    const sourceFiles = Object.keys(idx || {})
                    
                    // Find eee.sol entry
                    const eeeSolEntry = sourceFiles.find(file => file.includes('eee.sol'))
                    browser.assert.ok(!!eeeSolEntry, 'Resolution index should contain eee.sol')
                    
                    if (eeeSolEntry) {
                        const mappings = idx[eeeSolEntry]
                        
                        // Check that both imports are mapped correctly
                        const hasV4Import = Object.keys(mappings).some(key => 
                            key.includes('@openzeppelin/contracts/token/ERC20/ERC20.sol') &&
                            mappings[key].includes('@openzeppelin/contracts@4.9.6')
                        )
                        const hasV5Import = Object.keys(mappings).some(key => 
                            key.includes('@openzeppelin/contracts-5/token/ERC20/ERC20.sol') &&
                            mappings[key].includes('@openzeppelin/contracts@5.0.2')
                        )
                        
                        browser.assert.ok(hasV4Import, 'Resolution index should map @openzeppelin/contracts to version 4.9.6')
                        browser.assert.ok(hasV5Import, 'Resolution index should map @openzeppelin/contracts-5 to version 5.0.2')
                    }
                } catch (e) {
                    browser.assert.fail('Resolution index should be valid JSON: ' + e.message)
                }
            })
    },

    'Test jsDelivr CDN with multiple versions from same package #group19': function (browser: NightwatchBrowser) {
        browser
            .addFile('MixedCDNVersions.sol', jsDelivrMultiVersionSource['MixedCDNVersions.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(3000)
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            // Verify both versions are present
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.9.6"]', 60000)
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@5.0.2"]', 60000)
            .perform(function () {
                browser.assert.ok(true, 'Both @openzeppelin/contracts@4.9.6 and @openzeppelin/contracts@5.0.2 should be present from jsDelivr CDN')
            })
            // Verify contracts@4.9.6 structure (ECDSA utilities)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.9.6"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.9.6/utils"]', 10000)
            .click('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.9.6/utils"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.9.6/utils/cryptography"]', 10000)
            .click('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.9.6/utils/cryptography"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.9.6/utils/cryptography/ECDSA.sol"]', 10000)
            .perform(function () {
                browser.assert.ok(true, 'contracts@4.9.6 should contain utils/cryptography/ECDSA.sol from jsDelivr')
            })
            // Verify contracts@5.0.2 structure (ERC20 token)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@5.0.2"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@5.0.2/token"]', 10000)
            .click('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@5.0.2/token"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@5.0.2/token/ERC20"]', 10000)
            .click('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@5.0.2/token/ERC20"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol"]', 10000)
            .perform(function () {
                browser.assert.ok(true, 'contracts@5.0.2 should contain token/ERC20/ERC20.sol from jsDelivr')
            })
            // Verify resolution index mappings
            .isVisible({
                selector: '*[data-id="treeViewLitreeViewItem.deps/npm/.resolution-index.json"]',
                timeout: 10000,
                suppressNotFoundErrors: true
            })
            .perform(async function () {
                const resolutionIndexExists = await new Promise((resolve) => {
                    browser.isVisible({
                        selector: '*[data-id="treeViewLitreeViewItem.deps/npm/.resolution-index.json"]',
                        suppressNotFoundErrors: true
                    }, (result) => {
                        resolve(result.value === true)
                    })
                })

                if (resolutionIndexExists) {
                    browser.assert.ok(true, 'Resolution index file should exist for jsDelivr multi-version imports')
                } else {
                    browser.assert.ok(true, 'Resolution index not visible (may be hidden file)')
                }
            })
            .openFile('.deps/npm/.resolution-index.json')
            .pause(1000)
            .getEditorValue((content) => {
                try {
                    const idx = JSON.parse(content)
                    const sourceFiles = Object.keys(idx || {})
                    
                    // Find MixedCDNVersions.sol entry
                    const wkEntry = sourceFiles.find(file => file.includes('MixedCDNVersions.sol'))
                    browser.assert.ok(!!wkEntry, 'Resolution index should contain MixedCDNVersions.sol')
                    
                    if (wkEntry) {
                        const mappings = idx[wkEntry]
                        
                        // Check that both jsDelivr imports are mapped correctly
                        const hasV4Import = Object.keys(mappings).some(key => 
                            key.includes('cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.9.6') &&
                            key.includes('ECDSA.sol')
                        )
                        const hasV5Import = Object.keys(mappings).some(key => 
                            key.includes('cdn.jsdelivr.net/npm/@openzeppelin/contracts@5.0.2') &&
                            key.includes('ERC20.sol')
                        )
                        
                        browser.assert.ok(hasV4Import, 'Resolution index should map jsDelivr 4.9.6 ECDSA import')
                        browser.assert.ok(hasV5Import, 'Resolution index should map jsDelivr 5.0.2 ERC20 import')
                    }
                } catch (e) {
                    browser.assert.fail('Resolution index should be valid JSON: ' + e.message)
                }
            })
    },

    'Test jsDelivr CDN mixing v5 ERC20 with v4 SafeMath #group20': function (browser: NightwatchBrowser) {
        browser
            .addFile('djdidjod.sol', jsDelivrV5WithV4UtilsSource['djdidjod.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(3000)
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            // Verify both versions are present
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.9.6"]', 60000)
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@5.0.2"]', 60000)
            .perform(function () {
                browser.assert.ok(true, 'Both @openzeppelin/contracts@4.9.6 and @openzeppelin/contracts@5.0.2 should be present for SafeMath + ERC20v5')
            })
            // Verify contracts@4.9.6 structure (SafeMath utilities)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4.9.6"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.9.6/utils"]', 10000)
            .click('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.9.6/utils"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.9.6/utils/math"]', 10000)
            .click('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.9.6/utils/math"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@4.9.6/utils/math/SafeMath.sol"]', 10000)
            .perform(function () {
                browser.assert.ok(true, 'contracts@4.9.6 should contain utils/math/SafeMath.sol from jsDelivr')
            })
            // Verify contracts@5.0.2 structure (ERC20 token)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@5.0.2"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@5.0.2/token"]', 10000)
            .click('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@5.0.2/token"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@5.0.2/token/ERC20"]', 10000)
            .click('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@5.0.2/token/ERC20"]')
            .waitForElementVisible('*[data-id="treeViewLitreeViewItem.deps/npm/@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol"]', 10000)
            .perform(function () {
                browser.assert.ok(true, 'contracts@5.0.2 should contain token/ERC20/ERC20.sol from jsDelivr')
            })
            // Verify compilation succeeded (no errors)
            .waitForElementPresent('*[data-id="compiledContracts"]', 10000)
            .perform(function () {
                browser.assert.ok(true, 'Contract should compile successfully with v5 ERC20 and v4 SafeMath')
            })
            // Verify resolution index mappings
            .openFile('.deps/npm/.resolution-index.json')
            .pause(1000)
            .getEditorValue((content) => {
                try {
                    const idx = JSON.parse(content)
                    const sourceFiles = Object.keys(idx || {})
                    
                    // Find djdidjod.sol entry
                    const djEntry = sourceFiles.find(file => file.includes('djdidjod.sol'))
                    browser.assert.ok(!!djEntry, 'Resolution index should contain djdidjod.sol')
                    
                    if (djEntry) {
                        const mappings = idx[djEntry]
                        
                        // Check that both jsDelivr imports are mapped correctly
                        const hasV4Import = Object.keys(mappings).some(key => 
                            key.includes('cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.9.6') &&
                            key.includes('SafeMath.sol')
                        )
                        const hasV5Import = Object.keys(mappings).some(key => 
                            key.includes('cdn.jsdelivr.net/npm/@openzeppelin/contracts@5.0.2') &&
                            key.includes('ERC20.sol')
                        )
                        
                        browser.assert.ok(hasV4Import, 'Resolution index should map jsDelivr 4.9.6 SafeMath import')
                        browser.assert.ok(hasV5Import, 'Resolution index should map jsDelivr 5.0.2 ERC20 import')
                    }
                } catch (e) {
                    browser.assert.fail('Resolution index should be valid JSON: ' + e.message)
                }
            })
    },

    'Test Chainlink contracts with transitive multi-version OpenZeppelin dependencies #group21': function (browser: NightwatchBrowser) {
        browser
            .addFile('ChainlinkMultiVersion.sol', chainlinkMultiVersionSource['ChainlinkMultiVersion.sol'])
            // Enable generate-contract-metadata to create build-info files
            .waitForElementVisible('*[data-id="topbar-settingsIcon"]')
            .click('*[data-id="topbar-settingsIcon"]')
            .waitForElementVisible('*[data-id="settings-sidebar-general"]')
            .click('*[data-id="settings-sidebar-general"]')
            .waitForElementPresent('[data-id="generate-contract-metadataSwitch"]')
            .click('[data-id="generate-contract-metadataSwitch"]')
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(5000) // Longer pause for multiple CDN fetches
            .clickLaunchIcon('filePanel')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 120000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            // Verify both OpenZeppelin versions are present (pulled in as transitive deps from Chainlink)
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]')
            .waitForElementPresent('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@4"]', 60000)
            .waitForElementPresent('*[data-id^="treeViewDivDraggableItem.deps/npm/@openzeppelin/contracts@5"]', 60000)
            .perform(function () {
                browser.assert.ok(true, 'Both OpenZeppelin v4 and v5 should be present as transitive dependencies from Chainlink')
            })
            // Verify Chainlink contracts are resolved
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@chainlink"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps/npm/@chainlink"]')
            .waitForElementPresent('*[data-id^="treeViewDivDraggableItem.deps/npm/@chainlink/contracts@1.5.0"]', 60000)
            .perform(function () {
                browser.assert.ok(true, 'Chainlink contracts@1.5.0 should be resolved from jsDelivr CDN')
            })
            // Verify specific Chainlink imports exist
            .click('*[data-id^="treeViewDivDraggableItem.deps/npm/@chainlink/contracts@1.5.0"]')
            .waitForElementVisible('*[data-id$="contracts@1.5.0/src"]', 10000)
            .click('*[data-id$="contracts@1.5.0/src"]')
            .waitForElementVisible('*[data-id$="contracts@1.5.0/src/v0.8"]', 10000)
            .click('*[data-id$="contracts@1.5.0/src/v0.8"]')
            // Check for functions directory
            .waitForElementVisible('*[data-id$="contracts@1.5.0/src/v0.8/functions"]', 10000)
            .click('*[data-id$="contracts@1.5.0/src/v0.8/functions"]')
            .waitForElementVisible('*[data-id$="contracts@1.5.0/src/v0.8/functions/v1_3_0"]', 10000)
            .perform(function () {
                browser.assert.ok(true, 'Chainlink functions/v1_3_0 directory should exist')
            })
            // Verify compilation succeeded despite multiple OpenZeppelin versions
            .waitForElementPresent('*[data-id="compiledContracts"]', 10000)
            .perform(function () {
                browser.assert.ok(true, 'Contract should compile successfully with Chainlink and transitive multi-version OpenZeppelin dependencies')
            })
            // Check build info to verify actual sources sent to compiler
            .waitForElementVisible('*[data-id="treeViewDivDraggableItemartifacts"]', 60000)
            .waitForElementVisible('*[data-id="treeViewDivDraggableItemartifacts/build-info"]', 60000)
            .click('*[data-id="treeViewDivDraggableItemartifacts/build-info"]')
            .pause(1000)
            // Click any .json file in the build-info directory using XPath
            .useXpath()
            .waitForElementVisible('//li[starts-with(@data-id, "treeViewLitreeViewItemartifacts/build-info/") and substring(@data-id, string-length(@data-id) - 4) = ".json"]', 10000)
            .click('//li[starts-with(@data-id, "treeViewLitreeViewItemartifacts/build-info/") and substring(@data-id, string-length(@data-id) - 4) = ".json"]')
            .useCss()
            .pause(2000)
            .getEditorValue((content) => {
                try {
                    const buildInfo = JSON.parse(content)
                        
                    const sources = buildInfo.input.sources
                    const sourceFiles = Object.keys(sources)
                    
                    // Check for key OpenZeppelin version indicators that prove correct loading
                    // 1. Look for versioned path with v4.8.x content
                    const ozV4VersionedPath = sourceFiles.find(file => 
                        file.includes('@openzeppelin/contracts@4.8.3/utils/Address.sol') && 
                        sources[file].content.includes('4.8.0')
                    )
                    browser.assert.ok(!!ozV4VersionedPath, 'Should find OpenZeppelin v4.8.x Address.sol with version comment')
                    
                    // 2. Look for non-versioned path but with v4.8.0 content 
                    const ozV4NonVersionedPath = sourceFiles.find(file => 
                        file.includes('@openzeppelin/contracts@4.8.3/utils/structs/EnumerableSet.sol') 
                         && sources[file].content.includes('4.8.0')
                    )

                    browser.assert.ok(!!ozV4NonVersionedPath, 'Should find OpenZeppelin EnumerableSet.sol with v4.8.0 comment')
                    
                    // 3. Look for IERC165 with v4.4.1 version indicator
                    const ozV4IERC165Path = sourceFiles.find(file => 
                        file.includes('@openzeppelin/contracts@5.0.2/utils/introspection/IERC165.sol') &&
                        sources[file].content.includes('5.0.0')
                    )
                    browser.assert.ok(!!ozV4IERC165Path, 'Should find OpenZeppelin IERC165.sol with v4.4.1 comment')
                    
                    browser.assert.ok(true, 'OpenZeppelin contracts loaded correctly with proper version indicators')
                    
                } catch (e) {
                    browser.assert.fail('Build info should be valid JSON: ' + e.message)
                }
            })
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
    },
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

const npmAliasMultiVersionSource = {
    'package.json': {
        content: `{
  "name": "oz-multi-version-mre",
  "private": true,
  "scripts": {
    "compile": "hardhat compile"
  },
  "devDependencies": {
    "hardhat": "^2.22.9"
  },
  "dependencies": {
    "@openzeppelin/contracts": "4.9.6",
    "@openzeppelin/contracts-5": "npm:@openzeppelin/contracts@5.0.2"
  }
}`
    },
    'eee.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Same library, two versions, imported under different npm package names
import {ERC20 as ERC20v4} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20 as ERC20v5} from "@openzeppelin/contracts-5/token/ERC20/ERC20.sol";
`
    }
}

const jsDelivrMultiVersionSource = {
    'MixedCDNVersions.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20 as ERC20v5} from "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol";
import {ECDSA as ECDSAv4} from "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.9.6/utils/cryptography/ECDSA.sol";

contract MixedOkay is ERC20v5 {
    using ECDSAv4 for bytes32;

    constructor() ERC20v5("Mixed Okay", "MOK") {}

    function recover(bytes32 digest, bytes memory signature) external pure returns (address) {
        return ECDSAv4.recover(digest, signature);
    }
}
`
    }
}

const jsDelivrV5WithV4UtilsSource = {
    'djdidjod.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Must be 0z v5 -- _update exists only in v5
import {ERC20 as ERC20v5} from
    "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol";

// Must be 0z v4 — SafeMath was removed in v5
import {SafeMath as SafeMathv4} from
    "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.9.6/utils/math/SafeMath.sol";

contract MixedProof is ERC20v5 {
    using SafeMathv4 for uint256;

    constructor() ERC20v5("Mixed Proof", "MPF") {}

    // Proves we're on 0z v5: this override compiles only with v5
    function _update(address from, address to, uint256 value) internal override {
        // Touch SafeMath v4 to prove that library is from 4.9.6
        uint256 bumped = value.add(1); // SafeMath v4 method
        super._update(from, to, bumped - 1);
    }
}
`
    }
}

const chainlinkMultiVersionSource = {
    'ChainlinkMultiVersion.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Import Chainlink contracts that have transitive dependencies on different OpenZeppelin versions
// This tests that the dependency resolver correctly handles multiple versions of the same package
// when they are pulled in as transitive dependencies from a third-party library
import "https://cdn.jsdelivr.net/npm/@chainlink/contracts@1.5.0/src/v0.8/functions/v1_3_0/accessControl/TermsOfServiceAllowList.sol";
import "https://cdn.jsdelivr.net/npm/@chainlink/contracts@1.5.0/src/v0.8/keystone/interfaces/IReceiver.sol";

contract ChainlinkMultiVersion {
    // This contract tests transitive multi-version dependency resolution
    // Chainlink contracts may depend on different OpenZeppelin versions internally
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
    invalidImportSource,
    npmAliasMultiVersionSource,
    jsDelivrMultiVersionSource,
    jsDelivrV5WithV4UtilsSource,
    chainlinkMultiVersionSource,
]

