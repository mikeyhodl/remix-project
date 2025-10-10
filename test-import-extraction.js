const fs = require('fs');

// Copy the enhanced extractImports logic from dependency-resolver.ts
function extractImports(content) {
    const imports = []
    
    // Step 1: Remove all comments to avoid false positives
    // Remove single-line comments: // comment
    let cleanContent = content.replace(/\/\/.*$/gm, '')
    
    // Remove multi-line comments: /* comment */
    cleanContent = cleanContent.replace(/\/\*[\s\S]*?\*\//g, '')
    
    // Step 2: Remove string literals that aren't import statements
    // This prevents matching "import" inside string literals
    // We'll temporarily replace string literals with placeholders, then restore import strings
    const stringLiterals = []
    let stringIndex = 0
    
    // Find all string literals and replace with placeholders
    cleanContent = cleanContent.replace(/(["'])(?:(?!\1)[^\\]|\\.)*\1/g, (match) => {
      const placeholder = `__STRING_LITERAL_${stringIndex++}__`
      stringLiterals.push(match)
      return placeholder
    })
    
    // Step 3: Find import statements (now without interference from comments or strings)
    // Match various import patterns across multiple lines
    const importPatterns = [
      // import "path/to/file.sol";
      /import\s+["']([^"']+)["']\s*;/g,
      
      // import {Symbol1, Symbol2} from "path/to/file.sol";
      /import\s*{\s*[^}]*}\s*from\s+["']([^"']+)["']\s*;/g,
      
      // import * as Name from "path/to/file.sol";
      /import\s+\*\s+as\s+\w+\s+from\s+["']([^"']+)["']\s*;/g,
      
      // import Name from "path/to/file.sol";
      /import\s+\w+\s+from\s+["']([^"']+)["']\s*;/g,
      
      // import Name, {Symbol} from "path/to/file.sol";  
      /import\s+\w+\s*,\s*{\s*[^}]*}\s*from\s+["']([^"']+)["']\s*;/g
    ]
    
    // Apply each pattern
    for (const pattern of importPatterns) {
      let match
      while ((match = pattern.exec(cleanContent)) !== null) {
        const importPath = match[1]
        if (importPath && !imports.includes(importPath)) {
          imports.push(importPath)
        }
      }
      // Reset regex state for next pattern
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

// Expected imports (should NOT include commented ones or string literals)
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
