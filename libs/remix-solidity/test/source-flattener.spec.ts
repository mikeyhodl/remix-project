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
})
