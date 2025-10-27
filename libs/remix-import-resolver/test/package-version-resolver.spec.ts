/// <reference types="mocha" />
import { expect } from 'chai'
import { PackageVersionResolver, NodeIOAdapter } from '../src'

describe('PackageVersionResolver (standalone via IOAdapter)', () => {
  it('resolves version from npm when no workspace/lock info', async () => {
    const io = new NodeIOAdapter()
    const resolver = new PackageVersionResolver(io, true)
    const result = await resolver.resolveVersion('@openzeppelin/contracts')
    expect(result.version).to.be.a('string')
    // Should look like a semver (loose check)
    expect(result.version).to.match(/^\d+\./)
  expect(['package-json', 'lock-file']).to.include(result.source)
  })
})
