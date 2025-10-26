/// <reference types="mocha" />
import { expect } from 'chai'
import { 
  normalizeGithubBlobUrl,
  normalizeRawGithubUrl,
  rewriteNpmCdnUrl,
  normalizeIpfsUrl,
  normalizeSwarmUrl
} from '../src/compiler/utils/url-normalizer'

describe('url-normalizer', () => {
  it('converts GitHub blob to raw', () => {
    const out = normalizeGithubBlobUrl('https://github.com/openzeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/token/ERC20/ERC20.sol')
    expect(out).to.equal('https://raw.githubusercontent.com/openzeppelin/openzeppelin-contracts/v5.0.2/contracts/token/ERC20/ERC20.sol')
  })

  it('normalizes raw.githubusercontent.com', () => {
    const out = normalizeRawGithubUrl('https://raw.githubusercontent.com/openzeppelin/openzeppelin-contracts/v5.0.2/contracts/token/ERC20/ERC20.sol')
    expect(out?.targetPath).to.equal('github/openzeppelin/openzeppelin-contracts@v5.0.2/contracts/token/ERC20/ERC20.sol')
    expect(out?.normalizedPath).to.equal('github/openzeppelin/openzeppelin-contracts@v5.0.2/contracts/token/ERC20/ERC20.sol')
  })

  it('rewrites npm CDN to npm path', () => {
    const out = rewriteNpmCdnUrl('https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol')
    expect(out?.npmPath).to.equal('@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol')
  })

  it('normalizes ipfs', () => {
    const out = normalizeIpfsUrl('ipfs://QmHash/path/file.sol')
    expect(out?.targetPath).to.match(/^ipfs\/QmHash\//)
  })

  it('normalizes swarm', () => {
    const out = normalizeSwarmUrl('bzz-raw://abcdef/path/file.sol')
    expect(out?.targetPath).to.match(/^swarm\/abcdef\//)
  })
})
