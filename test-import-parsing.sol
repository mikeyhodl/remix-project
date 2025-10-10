// SPDX-License-Identifier: MIT
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

contract TestContract {
    // More string literals that might confuse parser
    string public message = "import something";
    
    function test() public pure returns (string memory) {
        return "import test";
    }
}