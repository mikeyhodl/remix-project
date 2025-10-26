/// <reference types="mocha" />
import { expect } from 'chai'
import { ImportResolver } from '../src/compiler/import-resolver'
import { NodeIOAdapter } from '../src/compiler/adapters/node-io-adapter'
import { promises as fs } from 'fs'

const INDEX_PATH = '.deps/npm/.resolution-index.json'

describe('ImportResolver standalone (via NodeIOAdapter)', () => {
  it('resolves and saves an npm import without explicit version', async () => {
    const io = new NodeIOAdapter()
    const resolver = new ImportResolver(io as any, 'contracts/Test.sol', true)

    const original = '@openzeppelin/contracts/token/ERC20/ERC20.sol'
    const content = await resolver.resolveAndSave(original)

    expect(content).to.be.a('string')
    expect(content.length).to.be.greaterThan(500)

    // Resolution should include a version mapping
    const resolved = resolver.getResolution(original)
    expect(resolved).to.be.a('string')
    expect(resolved).to.match(/^@openzeppelin\/contracts@\d+\./)

    // Save index and verify file is created
    await resolver.saveResolutionsToIndex()
    const exists = await fs.stat(INDEX_PATH).then(() => true).catch(() => false)
    expect(exists).to.equal(true)
  }).timeout(20000)
})
