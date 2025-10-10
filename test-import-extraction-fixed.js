const fs = require('fs');

function extractImports(content) {
    const imports = []
    
    // Step 1: Remove all comments to avoid false positives
    let cleanContent = content.replace(/\/\/.*$/gm, '')
    cleanContent = cleanContent.replace(/\/\*[\s\S]*?\*\//g, '')
    
    // Step 2: Match import statements directly
    const importPatterns = [
      /import\s+["']([^"']+)["']\s*;/g,
      /import\s*{\s*[^}]*}\s*from\s+["']([^"']+)["']\s*;/g,
      /import\s+\*\s+as\s+\w+\s+from\s+["']([^"']+)["']\s*;/g,
      /import\s+\w+\s+from\s+["']([^"']+)["']\s*;/g,
      /import\s+\w+\s*,\s*{\s*[^}]*}\s*from\s+["']([^"']+)["']\s*;/g
    ]
    
    for (const pattern of importPatterns) {
      let match
      while ((match = pattern.exec(cleanContent)) !== null) {
        const importPath = match[1]
        if (importPath && !imports.includes(importPath)) {
          imports.push(importPath)
        }
      }
      pattern.lastIndex = 0
    }
    
    return imports
}

// Test with our test file
const testContent = fs.readFileSync('./test-import-parsing.sol', 'utf8');
const extractedImports = extractImports(testContent);

console.log('=== Enhanced Import Extraction Test ===');
console.log('Extracted imports:');
extractedImports.forEach((imp, index) => {
  console.log(`  ${index + 1}. ${imp}`);
});

console.log(`\nTotal imports found: ${extractedImports.length}`);

// Expected imports (should NOT include commented ones)
const expectedImports = [
  "@openzeppelin/contracts/token/ERC20/ERC20.sol",
  "@openzeppelin/contracts/access/Ownable.sol", 
  "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol",
  "@openzeppelin/contracts/utils/math/SafeMath.sol",
  "@openzeppelin/contracts/utils/Context.sol"
];

console.log('\n=== Verification ===');
console.log('Expected imports:');
expectedImports.forEach((imp, index) => {
  console.log(`  ${index + 1}. ${imp}`);
});

console.log('\nMatch verification:');
const missing = expectedImports.filter(exp => !extractedImports.includes(exp));
const unexpected = extractedImports.filter(ext => !expectedImports.includes(ext));

if (missing.length === 0 && unexpected.length === 0) {
  console.log('✅ All tests PASSED! Import extraction working correctly.');
} else {
  if (missing.length > 0) {
    console.log('❌ Missing imports:', missing);
  }
  if (unexpected.length > 0) {
    console.log('❌ Unexpected imports:', unexpected);
  }
}

// Test individual patterns
console.log('\n=== Pattern Testing ===');
const testPatterns = [
  'import "@openzeppelin/contracts/token/ERC20/ERC20.sol";',
  'import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";',
  'import * as SafeMath from "@openzeppelin/contracts/utils/math/SafeMath.sol";',
  'import DefaultExport from "@openzeppelin/contracts/utils/Context.sol";',
  'import DefaultExport, { Named } from "@openzeppelin/contracts/access/Ownable.sol";'
];

testPatterns.forEach((testPattern, index) => {
  const result = extractImports(testPattern);
  console.log(`Pattern ${index + 1}: "${testPattern}" → ${result.length > 0 ? result[0] : 'NO MATCH'}`);
});
