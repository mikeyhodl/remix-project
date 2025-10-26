/// <reference types="mocha" />
import { expect } from 'chai'
import { mkdtemp, rm, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promises as fs } from 'fs'

import { NodeIOAdapter } from '../src/compiler/adapters/node-io-adapter'
import { SourceFlattener } from '../src/compiler/source-flattener'

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true } catch { return false }
}

// Helper: collect versions used for a given package prefix from "// File: ..." markers
function collectPackageVersions(flattened: string, pkgPrefix: string): Set<string> {
  const escaped = pkgPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^\\s*//\\s*File:\\s+${escaped}@([^/]+)/`, 'gm')
  const versions = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(flattened)) !== null) {
    versions.add(m[1])
  }
  return versions
}

describe('SourceFlattener - end-to-end parsing + resolving + flattening', () => {
  let originalCwd: string
  let tempDir: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tempDir = await mkdtemp(join(tmpdir(), 'remix-solidity-flat-'))
    process.chdir(tempDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(tempDir, { recursive: true, force: true })
  })

  it('flattens an entry with OpenZeppelin ERC20 import (explicit version for determinism)', async function () {
    this.timeout(60000)

    const io = new NodeIOAdapter()
    const flattener = new SourceFlattener(io, true)

    // Write entry
    const entry = 'MyToken.sol'
    const source = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\nimport "@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol";\n\ncontract MyToken is ERC20 {\n  constructor() ERC20("MyToken", "MTK") {}\n}`
    await fs.writeFile(entry, source, 'utf8')

    const result = await flattener.flatten(entry)

    expect(result.flattened).to.be.a('string')
    expect(result.flattened.length).to.be.greaterThan(5000)

  // Versions: ensure OZ paths are locked to 4.8.0
  const ozVersions = collectPackageVersions(result.flattened, '@openzeppelin/contracts')
  expect(ozVersions.size, `unexpected OZ versions in flat: ${[...ozVersions].join(',')}`).to.equal(1)
  expect(ozVersions.has('4.8.0')).to.equal(true)

    // Basic sanity checks
    expect(result.flattened).to.match(/pragma\s+solidity\s+/)
    expect(result.flattened).to.contain('contract ERC20')
    expect(result.flattened).to.contain('contract MyToken')
    expect(result.flattened).to.not.match(/\bimport\s+\"/)

  // Resolution index may or may not be written depending on whether any import
  // normalization occurred (unversioned → versioned, CDN → npm, etc.).
  // We don't assert existence here; coverage exists in group9 tests.

    // Ensure order contains entry as last element (after its deps)
    expect(result.order[result.order.length - 1]).to.equal(entry)
  })

  it('flattens an entry importing from unpkg CDN (versioned path)', async function () {
    this.timeout(90000)

    const io = new NodeIOAdapter()
    const flattener = new SourceFlattener(io, true)

    const entry = 'CdnEntry.sol'
    const source = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\nimport "https://unpkg.com/@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol";\n\ncontract CdnToken is ERC20 {\n  constructor() ERC20("CdnToken", "CDN") {}\n}`
    await fs.writeFile(entry, source, 'utf8')

    const result = await flattener.flatten(entry)

    expect(result.flattened).to.be.a('string')
    expect(result.flattened.length).to.be.greaterThan(5000)
    // CDN path includes the pinned version
    expect(result.flattened).to.match(/https:\/\/unpkg\.com\/@openzeppelin\/contracts@4\.8\.0\//)
    expect(result.flattened).to.match(/pragma\s+solidity\s+/)
    expect(result.flattened).to.contain('contract ERC20')
    expect(result.flattened).to.contain('contract CdnToken')
    expect(result.flattened).to.not.match(/\bimport\s+\"/)
  })

  it('flattens an entry importing from raw.githubusercontent.com (normalized save path)', async function () {
    this.timeout(120000)

    const io = new NodeIOAdapter()
    const flattener = new SourceFlattener(io, true)

    const entry = 'GhEntry.sol'
    const ghImport = 'https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts-upgradeable/v5.4.0/contracts/token/ERC1155/ERC1155Upgradeable.sol'
    const source = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\nimport "${ghImport}";\n\ncontract Dummy {}`
    await fs.writeFile(entry, source, 'utf8')

    const result = await flattener.flatten(entry)

    expect(result.flattened).to.be.a('string')
    expect(result.flattened.length).to.be.greaterThan(2000)
    // Version resolution for transitive OZ deps should map to @openzeppelin/contracts@5.4.0
    // Validate via resolution index snapshot if present
    if (await exists('.deps/npm/.resolution-index.json')) {
      const idxRaw = await fs.readFile('.deps/npm/.resolution-index.json', 'utf8')
      const idx = JSON.parse(idxRaw)
      const entries: Array<{ from: string; to: string }> = []
      if (Array.isArray(idx)) {
        entries.push(...idx)
      } else if (idx && Array.isArray(idx.mappings)) {
        entries.push(...idx.mappings)
      } else if (idx && typeof idx === 'object') {
        // Handle nested shape: { [file]: { [originalImport]: resolvedPath } }
        for (const [, v] of Object.entries(idx)) {
          if (v && typeof v === 'object') {
            for (const [orig, to] of Object.entries(v as Record<string, unknown>)) {
              if (typeof to === 'string') entries.push({ from: orig, to })
              else if (to && typeof to === 'object' && 'to' in (to as any)) entries.push({ from: orig, to: (to as any).to })
            }
          } else if (typeof v === 'string') {
            // Rare flat shape: { [originalImport]: resolvedPath }
            entries.push({ from: '', to: v as string })
          }
        }
      }
      const hasOZ54 = entries.some((m: any) => typeof m.to === 'string' && m.to.includes('@openzeppelin/contracts@5.4.0/'))
      expect(hasOZ54, 'expected resolution index to include @openzeppelin/contracts@5.4.0').to.equal(true)
    }
    expect(result.flattened).to.match(/pragma\s+solidity\s+/)
    expect(result.flattened).to.contain('ERC1155Upgradeable')
    expect(result.flattened).to.not.match(/\bimport\s+\"/)
  })

  it('writes flattened output to a file with flattenToFile()', async function () {
    this.timeout(90000)

    const io = new NodeIOAdapter()
    const flattener = new SourceFlattener(io, true)

    const entry = 'WriteOut.sol'
    const source = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\nimport "@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol";\n\ncontract WriteOut is ERC20 {\n  constructor() ERC20("WriteOut", "WRO") {}\n}`
    await fs.writeFile(entry, source, 'utf8')

    const outPath = 'out/Flattened.sol'
    const result = await flattener.flattenToFile(entry, outPath)

    expect(await exists(outPath)).to.equal(true)
    const fileContent = await fs.readFile(outPath, 'utf8')
    expect(fileContent).to.equal(result.flattened)
    expect(result.outFile).to.equal(outPath)
  })

  it('flattens an entry importing from GitHub blob URL (blob→raw rewrite)', async function () {
    this.timeout(120000)

    const io = new NodeIOAdapter()
    const flattener = new SourceFlattener(io, true)

    const entry = 'GhBlobEntry.sol'
    const ghBlob = 'https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/v5.4.0/contracts/token/ERC1155/ERC1155Upgradeable.sol'
    const source = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\nimport "${ghBlob}";\n\ncontract Dummy2 {}`
    await fs.writeFile(entry, source, 'utf8')

    const result = await flattener.flatten(entry)

    expect(result.flattened).to.be.a('string')
    expect(result.flattened.length).to.be.greaterThan(2000)
    expect(result.flattened).to.match(/pragma\s+solidity\s+/)
    expect(result.flattened).to.contain('ERC1155Upgradeable')
    expect(result.flattened).to.not.match(/\bimport\s+\"/)
  })

  it('applies remappings from remappings.txt to resolve imports', async function () {
    this.timeout(90000)

    const io = new NodeIOAdapter()
    const flattener = new SourceFlattener(io, true)

    const entry = 'RemapEntry.sol'
    const source = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\nimport "oz/token/ERC20/ERC20.sol";\n\ncontract RemapToken is ERC20 {\n  constructor() ERC20("RemapToken", "RMP") {}\n}`
    await fs.writeFile(entry, source, 'utf8')

    // Foundry-style remappings file
    const remap = 'oz=@openzeppelin/contracts@4.8.0/'
    await fs.writeFile('remappings.txt', remap, 'utf8')

    const result = await flattener.flatten(entry, { remappingsFile: 'remappings.txt' })

    expect(result.flattened).to.be.a('string')
    expect(result.flattened.length).to.be.greaterThan(5000)
    // Versions: ensure remapped OZ is locked to 4.8.0 across included files
    const ozVersions2 = collectPackageVersions(result.flattened, '@openzeppelin/contracts')
    expect(ozVersions2.size, `unexpected OZ versions in flat: ${[...ozVersions2].join(',')}`).to.equal(1)
    expect(ozVersions2.has('4.8.0')).to.equal(true)
    expect(result.flattened).to.match(/pragma\s+solidity\s+/)
    expect(result.flattened).to.contain('contract ERC20')
    expect(result.flattened).to.contain('contract RemapToken')
    expect(result.flattened).to.not.match(/\bimport\s+\"/)
  })

  it('prefers remappings.txt over inline remappings when both provided', async function () {
    this.timeout(90000)

    const io = new NodeIOAdapter()
    const flattener = new SourceFlattener(io, true)

    const entry = 'RemapPrecedence.sol'
    const source = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\nimport "oz/token/ERC20/ERC20.sol";\n\ncontract RemapPrecedence is ERC20 {\n  constructor() ERC20("RemapPrecedence", "RMP2") {}\n}`
    await fs.writeFile(entry, source, 'utf8')

    // File remappings point to 4.8.0
    const remapFileContent = 'oz=@openzeppelin/contracts@4.8.0/'
    await fs.writeFile('remappings.txt', remapFileContent, 'utf8')

    // Inline remappings intentionally point to a different version to test precedence
    const inlineRemaps = ['oz=@openzeppelin/contracts@5.4.0/']

    const result = await flattener.flatten(entry, { remappingsFile: 'remappings.txt', remappings: inlineRemaps })

    expect(result.flattened).to.be.a('string')
    expect(result.flattened.length).to.be.greaterThan(5000)

    // Expect OZ version to be 4.8.0 (from file), and not 5.4.0 (inline ignored)
    const ozVersions = collectPackageVersions(result.flattened, '@openzeppelin/contracts')
    expect(ozVersions.has('4.8.0'), 'expected 4.8.0 from remappings.txt').to.equal(true)
    expect(ozVersions.has('5.4.0'), 'inline remappings should not override file').to.equal(false)

    expect(result.flattened).to.match(/pragma\s+solidity\s+/)
    expect(result.flattened).to.contain('contract ERC20')
    expect(result.flattened).to.contain('contract RemapPrecedence')
    expect(result.flattened).to.not.match(/\bimport\s+\"/)
  })
})
