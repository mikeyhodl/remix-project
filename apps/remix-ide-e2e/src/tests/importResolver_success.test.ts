import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

module.exports = {
    '@disabled': false,
    before: function (browser: NightwatchBrowser, done: VoidFunction) {
        init(browser, done)
    },

    'Test successful import resolution still works': function (browser: NightwatchBrowser) {
        browser
            .addFile('SuccessfulImportTest.sol', successfulImportSource['SuccessfulImportTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(3000)
            .clickLaunchIcon('filePanel')
            // Verify that successful imports create deps folder
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps"]', 60000)
            .click('*[data-id="treeViewDivDraggableItem.deps"]')
            .click('*[data-id="treeViewDivDraggableItem.deps/npm"]')
            .waitForElementVisible('*[data-id="treeViewDivDraggableItem.deps/npm/@openzeppelin"]', 10000)
            .perform(function() {
                browser.assert.ok(true, 'Successful imports should resolve dependencies correctly');
            })
            .end()
    },
}

const successfulImportSource = {
    'SuccessfulImportTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// This import should work fine
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
`
    }
}