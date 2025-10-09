# Real-World Diamond Dependency Examples

## 🔷 Scenario 1: OpenZeppelin ERC20 vs ERC721 (Different Versions)

### Setup
```solidity
// MyContract.sol
pragma solidity ^0.8.0;

// Both inherit from different OZ versions
import "@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts@5.0.0/token/ERC721/ERC721.sol";

contract MyToken is ERC20, ERC721 {
    // This WILL fail - duplicate Context.sol definitions!
}
```

### What Happens
```
Both ERC20.sol and ERC721.sol import:
  import "../../utils/Context.sol";

Results in:
  .deps/npm/@openzeppelin/contracts@4.8.0/utils/Context.sol  ← From ERC20
  .deps/npm/@openzeppelin/contracts@5.0.0/utils/Context.sol  ← From ERC721

Compiler sees:
  contract Context { ... }  // Defined in v4.8.0
  contract Context { ... }  // Defined in v5.0.0
  
Error: DeclarationError: Identifier already declared.
```

**Test Command:**
```bash
# Create test file
cat > /Users/filipmertens/projects/remix-project/contracts/DiamondTest1.sol << 'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts@5.0.0/token/ERC721/ERC721.sol";

contract DiamondProblem is ERC20, ERC721 {
    constructor() ERC20("Test", "TST") ERC721("Test", "TST") {}
}
EOF
```

---

## 🔷 Scenario 2: Uniswap V2 vs V3 (Same Interface, Different Versions)

### Setup
```solidity
// ArbitrageBot.sol
pragma solidity ^0.8.0;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

contract ArbitrageBot {
    // Uses both V2 and V3
    // If they both import a shared library at different versions...
}
```

**Likely Conflict:**
- Both might import `@uniswap/lib/contracts/libraries/SafeMath.sol` at different versions
- Or both import `@openzeppelin/contracts` at different versions for common utilities

---

## 🔷 Scenario 3: Compound Finance - Different Protocol Versions

### Setup
```solidity
// YieldOptimizer.sol
pragma solidity ^0.8.0;

import "@compound-finance/compound-v2@1.0.0/contracts/CErc20.sol";
import "@compound-finance/compound-v3@1.0.0/contracts/Comet.sol";

contract YieldOptimizer {
    // Interact with both Compound V2 and V3
}
```

**Conflict:**
- Both might depend on `@openzeppelin/contracts` at different versions
- Compound V2 might use OZ v4.x
- Compound V3 might use OZ v5.x

---

## 🔷 Scenario 4: Chainlink Oracles - Different Feed Versions

### Setup
```solidity
// PriceAggregator.sol
pragma solidity ^0.8.0;

import "@chainlink/contracts@0.6.0/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@chainlink/contracts@0.8.0/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract PriceAggregator {
    // Uses both old and new Chainlink versions
}
```

**Same Interface, Different Implementations:**
- Interface might be identical
- But internal dependencies changed
- Could compile but behave differently!

---

## 🔷 Scenario 5: THE MOST REALISTIC - Upgradeable vs Non-Upgradeable OZ

This is THE perfect real-world example!

### Setup
```solidity
// HybridToken.sol
pragma solidity ^0.8.0;

// Use non-upgradeable for immutable part
import "@openzeppelin/contracts@5.0.0/token/ERC20/ERC20.sol";

// Use upgradeable for proxy pattern
import "@openzeppelin/contracts-upgradeable@5.0.0/access/OwnableUpgradeable.sol";

contract HybridToken is ERC20, OwnableUpgradeable {
    // Mix upgradeable and non-upgradeable patterns
}
```

**The Problem:**
```
contracts@5.0.0 imports:
  import "../../utils/Context.sol";
  → .deps/npm/@openzeppelin/contracts@5.0.0/utils/Context.sol

contracts-upgradeable@5.0.0 imports:
  import "@openzeppelin/contracts/utils/Context.sol";  ← NPM import!
  → Resolver maps to workspace version
  → If workspace has contracts@4.8.0, maps to 4.8.0!
  → But contracts-upgradeable@5.0.0 expects 5.0.0 APIs!
```

**Test Command:**
```bash
cat > contracts/DiamondTest2.sol << 'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts@5.0.0/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable@5.0.0/access/OwnableUpgradeable.sol";

contract HybridToken is ERC20, OwnableUpgradeable {
    constructor() ERC20("Hybrid", "HYB") {
        __Ownable_init();
    }
}
EOF
```

---

## 🔷 Scenario 6: AAVE v2 vs v3 - Protocol Migration

### Setup
```solidity
// MigrationHelper.sol
pragma solidity ^0.8.0;

import "@aave/protocol-v2@1.0.0/contracts/interfaces/ILendingPool.sol";
import "@aave/core-v3@1.0.0/contracts/interfaces/IPool.sol";

contract MigrationHelper {
    // Help users migrate from AAVE v2 to v3
    // Both protocols might depend on different OZ versions
}
```

---

## 🔷 Scenario 7: The "Works Separately, Fails Together" Example

### Package A (Works Fine Alone)
```solidity
// StableToken.sol
pragma solidity ^0.8.0;

import "@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol";

contract StableToken is ERC20 {
    constructor() ERC20("Stable", "STB") {}
}
```

### Package B (Works Fine Alone)
```solidity
// GovernanceToken.sol
pragma solidity ^0.8.0;

import "@openzeppelin/contracts@5.0.0/token/ERC20/ERC20.sol";

contract GovernanceToken is ERC20 {
    constructor() ERC20("Governance", "GOV") {}
}
```

### Combined (FAILS!)
```solidity
// DAOSystem.sol
pragma solidity ^0.8.0;

import "./StableToken.sol";      // Uses OZ 4.8.0
import "./GovernanceToken.sol";  // Uses OZ 5.0.0

contract DAOSystem {
    StableToken public stable;
    GovernanceToken public governance;
    
    // This will fail because both versions of Context.sol are compiled!
}
```

**Test This:**
```bash
# Create three files
mkdir -p contracts/dao

cat > contracts/dao/StableToken.sol << 'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol";
contract StableToken is ERC20 {
    constructor() ERC20("Stable", "STB") {}
}
EOF

cat > contracts/dao/GovernanceToken.sol << 'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts@5.0.0/token/ERC20/ERC20.sol";
contract GovernanceToken is ERC20 {
    constructor() ERC20("Governance", "GOV") {}
}
EOF

cat > contracts/dao/DAOSystem.sol << 'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./StableToken.sol";
import "./GovernanceToken.sol";

contract DAOSystem {
    StableToken public stable;
    GovernanceToken public governance;
    
    constructor() {
        stable = new StableToken();
        governance = new GovernanceToken();
    }
}
EOF
```

---

## 🎯 THE BEST TEST CASE (Simplest to Reproduce)

```solidity
// contracts/SimpleDiamond.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import SAME contract from DIFFERENT versions
import "@openzeppelin/contracts@4.9.0/utils/Context.sol" as ContextV4;
import "@openzeppelin/contracts@5.0.0/utils/Context.sol" as ContextV5;

contract SimpleDiamond {
    // This should fail with:
    // DeclarationError: Identifier already declared.
    
    // Even though we aliased the imports, Solidity compiles
    // both Context.sol files which both define "contract Context"
}
```

**Why This Is Perfect:**
- ✅ Minimal example
- ✅ Same exact file from different versions
- ✅ Guaranteed to have duplicate declarations
- ✅ Easy to test
- ✅ Clear error message

**Test Command:**
```bash
cat > contracts/SimpleDiamond.sol << 'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@4.9.0/utils/Context.sol" as ContextV4;
import "@openzeppelin/contracts@5.0.0/utils/Context.sol" as ContextV5;

contract SimpleDiamond {
    // This will fail compilation
}
EOF
```

---

## 🎬 Expected Results

### With Current Resolver (What We Expect):

**Scenario 1 (Context from two versions):**
```
Compilation Output:
  🚨 DUPLICATE FILE DETECTED - Will cause compilation errors!
     File: utils/Context.sol
     From package: @openzeppelin/contracts
  
     Already imported from version: 4.9.0
     Now requesting version:       5.0.0
       (from workspace package.json)
  
  DeclarationError: Identifier already declared.
    --> @openzeppelin/contracts@5.0.0/utils/Context.sol:15:1:
       contract Context { ... }
       ^----------------------^
```

**Scenario 2 (ERC20 + ERC721 different versions):**
```
Compilation Output:
  🚨 DUPLICATE FILE DETECTED
     Multiple contracts inherit from different versions
     
  DeclarationError: Identifier already declared.
    contract Context defined in:
      - @openzeppelin/contracts@4.8.0/utils/Context.sol
      - @openzeppelin/contracts@5.0.0/utils/Context.sol
```

**Scenario 3 (DAO System):**
```
Compilation Output:
  ✅ StableToken.sol compiles (uses OZ 4.8.0)
  ✅ GovernanceToken.sol compiles (uses OZ 5.0.0)
  
  When compiling DAOSystem.sol:
  🚨 DUPLICATE FILE DETECTED
     Both StableToken and GovernanceToken import ERC20
     from different OZ versions!
     
  DeclarationError: Identifier already declared.
```

---

## 🔧 How to Test These

### Option 1: Use Remix IDE
1. Open Remix
2. Create `SimpleDiamond.sol` with the code above
3. Compile
4. Watch for duplicate declaration error + our warning

### Option 2: Use E2E Test
```typescript
// In importResolver.test.ts
it('should detect diamond dependency conflict', async function() {
  await'
  
  const content = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@4.9.0/utils/Context.sol" as ContextV4;
import "@openzeppelin/contracts@5.0.0/utils/Context.sol" as ContextV5;

contract SimpleDiamond {
    // Should fail
}
  `
  
  await browser.addFile('SimpleDiamond.sol', { content })
  await browser.clickLaunchIcon('solidity')
  await browser.clickButton('Compile SimpleDiamond.sol')
  
  // Should see our warning in terminal
  const terminal = await browser.getTerminalText()
  assert.include(terminal, 'DUPLICATE FILE DETECTED')
  assert.include(terminal, 'Already imported from version: 4.9.0')
  assert.include(terminal, 'Now requesting version: 5.0.0')
  
  // Should also see compiler error
  const errors = await browser.getCompilationErrors()
  assert.include(errors, 'DeclarationError: Identifier already declared')
})
```

### Option 3: Manual Test in Your Workspace
```bash
# Navigate to Remix contracts folder
cd /Users/filipmertens/projects/remix-project/contracts

# Create test file
cat > SimpleDiamond.sol << 'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@4.9.0/utils/Context.sol" as ContextV4;
import "@openzeppelin/contracts@5.0.0/utils/Context.sol" as ContextV5;

contract SimpleDiamond {
    // Should fail with duplicate declaration
}
EOF

# Compile with Remix IDE
# Or use solc directly:
npx solc --version
npx solc SimpleDiamond.sol
```

---

## 📊 Summary Table

| Scenario | Difficulty | Real-World? | Expected Error | Our Warning |
|----------|-----------|-------------|----------------|-------------|
| SimpleDiamond (Context.sol twice) | ⭐ Easy | ❌ Contrived | Duplicate declaration | ✅ Yes |
| ERC20 + ERC721 different versions | ⭐⭐ Medium | ⚠️  Possible | Duplicate Context | ✅ Yes |
| DAO System (StableToken + GovernanceToken) | ⭐⭐ Medium | ✅ Realistic | Duplicate Context | ✅ Yes |
| Upgradeable + Non-upgradeable mix | ⭐⭐⭐ Hard | ✅ Very Common | API mismatch | ✅ Yes (peer dep warning) |
| Uniswap V2 + V3 | ⭐⭐⭐ Hard | ✅ Very Common | Varies | ✅ Yes |
| AAVE v2 + v3 migration | ⭐⭐⭐⭐ Very Hard | ✅ Real Protocol | Varies | ✅ Yes |

---

## 🎯 Recommendation: Test with SimpleDiamond

**This is your best test case:**
```solidity
import "@openzeppelin/contracts@4.9.0/utils/Context.sol" as ContextV4;
import "@openzeppelin/contracts@5.0.0/utils/Context.sol" as ContextV5;
```

**Why:**
1. ✅ Minimal code
2. ✅ Guaranteed conflict (same file, different versions)
3. ✅ Tests our duplicate file detection
4. ✅ Tests our version conflict warnings
5. ✅ Easy to understand what went wrong

**Expected Output:**
```
Terminal:
  🚨 DUPLICATE FILE DETECTED - Will cause compilation errors!
     File: utils/Context.sol
     From package: @openzeppelin/contracts
  
     Already imported from version: 4.9.0
     Now requesting version:       5.0.0
  
Compiler:
  DeclarationError: Identifier already declared.
  int_or_address @openzeppelin/contracts@5.0.0/utils/Context.sol:15:1:
  contract Context {
  ^-----------------^
  Note: The previous declaration is here:
  --> @openzeppelin/contracts@4.9.0/utils/Context.sol:15:1:
  contract Context {
  ^-----------------^
```

Want me to create this test file for you?
