import { NightwatchBrowser } from 'nightwatch'
import init from '../helpers/init'

module.exports = {
    '@disabled': false,
    before: function (browser: NightwatchBrowser, done: VoidFunction) {
        init(browser, done)
    },

    'Test proper error handling for unresolvable imports': function (browser: NightwatchBrowser) {
        browser
            .addFile('UnresolvableImportTest.sol', unresolvableImportSource['UnresolvableImportTest.sol'])
            .clickLaunchIcon('solidity')
            .click('[data-id="compilerContainerCompileBtn"]')
            .pause(3000)
            // Verify that compilation shows proper error message instead of crashing
            .waitForElementVisible('*[data-id="compiledErrors"]', 10000)
            .waitForElementContainsText('*[data-id="compiledErrors"]', 'not found @openzeppelin/contracts/utils/math/SafeMath.sol')
            .perform(function() {
                browser.assert.ok(true, 'Unresolvable imports show proper error messages without crashing');
            })
            .end()
    },
}

const unresolvableImportSource = {
    'UnresolvableImportTest.sol': {
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// This import should fail because SafeMath was removed in OpenZeppelin v4.0+
import * as SafeMath from "@openzeppelin/contracts/utils/math/SafeMath.sol";

// This import should work fine
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
`
    }
}