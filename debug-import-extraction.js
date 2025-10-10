const fs = require('fs');

function extractImports(content) {
    console.log('=== Original content (first 500 chars) ===');
    console.log(content.substring(0, 500));
    
    const imports = []
    
    // Step 1: Remove all comments to avoid false positives
    let cleanContent = content.replace(/\/\/.*$/gm, '')
    cleanContent = cleanContent.replace(/\/\*[\s\S]*?\*\//g, '')
    
    console.log('\n=== After removing comments (first 500 chars) ===');
    console.log(cleanContent.substring(0, 500));
    
    // Step 2: Remove string literals that aren't import statements
    const stringLiterals = []
    let stringIndex = 0
    
    cleanContent = cleanContent.replace(/(["'])(?:(?!\1)[^\\]|\\.)*\1/g, (match) => {
      const placeholder = `__STRING_LITERAL_${stringIndex++}__`
      stringLiterals.push(match)
      return placeholder
    })
    
    console.log('\n=== After removing string literals (first 500 chars) ===');
    console.log(cleanContent.substring(0, 500));
    
    // Step 3: Find import statements
    const importPatterns = [
      /import\s+["']([^"']+)["']\s*;/g,
      /import\s*{\s*[^}]*}\s*from\s+["']([^"']+)["']\s*;/g,
      /import\s+\*\s+as\s+\w+\s+from\s+["']([^"']+)["']\s*;/g,
      /import\s+\w+\s+from\s+["']([^"']+)["']\s*;/g,
      /import\s+\w+\s*,\s*{\s*[^}]*}\s*from\s+["']([^"']+)["']\s*;/g
    ]
    
    console.log('\n=== Testing patterns ===');
    for (let i = 0; i < importPatterns.length; i++) {
      const pattern = importPatterns[i];
      console.log(`\nPattern ${i + 1}: ${pattern}`);
      let match
      while ((match = pattern.exec(cleanContent)) !== null) {
        console.log(`  Found match: ${match[1]}`);
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

console.log('\n=== Final Result ===');
console.log('Extracted imports:', extractedImports);
