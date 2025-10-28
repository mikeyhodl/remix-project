import { expect } from 'chai'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { stat } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { NodeIOAdapter, SourceFlattener } from '../src'

// This test guards against missing upgradeable utility imports (e.g., ContextUpgradeable)
// when the entry import is unversioned and the resolver maps it to a versioned path.
// We verify that the flattener's source bundle keys align with the graph keys
// and that the flattened output contains ContextUpgradeable and ERC165Upgradeable.

describe('SourceFlattener - upgradeable package resolution (Node adapter)', function() {
  this.timeout(20000)

  let tempDir: string
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    tempDir = mkdtempSync(join(tmpdir(), 'resolver-node-upg-'))
    process.chdir(tempDir)
  })
  afterEach(() => {
    process.chdir(originalCwd)
    try { rmSync(tempDir, { recursive: true, force: true }) } catch {}
  })

  it('includes ContextUpgradeable and ERC165Upgradeable when flattening unversioned upgradeable import', async () => {
    const entry = 'Test.sol'
    writeFileSync(entry, [
      '// SPDX-License-Identifier: MIT',
      'pragma solidity ^0.8.20;',
      "import '@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol';",
      'contract T is ERC1155Upgradeable {',
      '  constructor() { __ERC1155_init("") ; }',
      '}',
      ''
    ].join('\n'))

    const io = new NodeIOAdapter()
    const flattener = new SourceFlattener(io, false)
    const res = await flattener.flatten(entry)

    // Basic sanity: flattened contains the entry marker and ERC1155Upgradeable section (versioned path)
    expect(res.flattened).to.match(/\/\/ File: @openzeppelin\/contracts-upgradeable@\d+\.\d+\.\d+\/token\/ERC1155\/ERC1155Upgradeable\.sol/)

    // Critically, ensure ContextUpgradeable and ERC165Upgradeable appear (i.e., their code was pulled in)
    expect(res.flattened).to.match(/abstract\s+contract\s+ContextUpgradeable/) // class header
    expect(res.flattened).to.match(/abstract\s+contract\s+ERC165Upgradeable/)

    // And the sources map contains a key for the versioned path
    const hasVersionedKey = Array.from(res.sources.keys()).some(k => /@openzeppelin\/contracts-upgradeable@\d+\.\d+\.\d+\/token\/ERC1155\/ERC1155Upgradeable\.sol/.test(k))
    expect(hasVersionedKey, 'sources map should contain versioned ERC1155Upgradeable key').to.equal(true)

    // Additionally, verify that key upgradeable files were saved to deterministic, normalized paths on disk.
    // NodeIOAdapter writes exactly to the target path (no implicit .deps prefix),
    // so the on-disk location should match the canonical bundle keys.
    const keys = Array.from(res.sources.keys())
    const mustExistPatterns = [
      /@openzeppelin\/contracts-upgradeable@[^/]+\/token\/ERC1155\/ERC1155Upgradeable\.sol$/, // entry dep
      /@openzeppelin\/contracts-upgradeable@[^/]+\/utils\/ContextUpgradeable\.sol$/,           // utility
      /@openzeppelin\/contracts-upgradeable@[^/]+\/utils\/introspection\/ERC165Upgradeable\.sol$/, // introspection
      /@openzeppelin\/contracts-upgradeable@[^/]+\/proxy\/utils\/Initializable\.sol$/        // initializer base
    ]
    const filesToCheck = keys.filter(k => mustExistPatterns.some(re => re.test(k)))
    expect(filesToCheck.length, 'expected core upgradeable files present in bundle keys').to.equal(mustExistPatterns.length)
    for (const p of filesToCheck) {
      const existsDeps = await stat(`.deps/${p}`).then(() => true).catch(() => false)
      const existsNpm = await stat(`.deps/npm/${p}`).then(() => true).catch(() => false)
      expect(existsDeps || existsNpm, `expected on-disk file under .deps for normalized path: ${p}`).to.equal(true)
    }
  })
})
