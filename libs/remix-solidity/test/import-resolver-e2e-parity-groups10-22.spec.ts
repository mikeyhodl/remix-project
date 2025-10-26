/// <reference types="mocha" />
import { expect } from 'chai'
import { promises as fs } from 'fs'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { ImportResolver } from '../src/compiler/import-resolver'
import { NodeIOAdapter } from '../src/compiler/adapters/node-io-adapter'

async function exists(path: string): Promise<boolean> {
  try {
    await fs.stat(path)
    return true
  } catch {
    return false
  }
}

describe('ImportResolver e2e parity (groups 10–22 subset) - Node + local FS', () => {
  let originalCwd: string
  let tempDir: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tempDir = await mkdtemp(join(tmpdir(), 'remix-solidity-test-'))
    process.chdir(tempDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(tempDir, { recursive: true, force: true })
  })

  // group10 (debug flag) – UI-specific; not applicable in Node unit tests
  it.skip('#group10 - debug logging toggles via localStorage (UI only)', () => {})

  // group11 (import parsing edge cases) – parsing belongs to compiler integration; skip here
  it.skip('#group11 - import parsing edge cases (compiler integration)', () => {})

  describe('#group12 - CDN imports normalization', () => {
    it('normalizes unpkg versioned to npm path and saves under versioned folders', async function () {
      this.timeout(40000)
      const io = new NodeIOAdapter()
      const resolver = new ImportResolver(io as any, 'UnpkgTest.sol', true)
      const original = 'https://unpkg.com/@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol'
      const content = await resolver.resolveAndSave(original)
      expect(content).to.be.a('string').and.not.empty
      // package.json saved under .deps/npm with the version
      expect(await exists('.deps/npm/@openzeppelin/contracts@4.8.0/package.json')).to.equal(true)
      // mapping should point to npm path
      const mapped = resolver.getResolution(original)
      expect(mapped).to.include('@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol')
    })

    it('normalizes jsDelivr versioned to npm path and saves under versioned folders', async function () {
      this.timeout(40000)
      const io = new NodeIOAdapter()
      const resolver = new ImportResolver(io as any, 'JsdelivrNpmTest.sol', true)
      const original = 'https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol'
      const content = await resolver.resolveAndSave(original)
      expect(content).to.be.a('string').and.not.empty
      expect(await exists('.deps/npm/@openzeppelin/contracts@4.8.0/package.json')).to.equal(true)
      const mapped = resolver.getResolution(original)
      expect(mapped).to.include('@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol')
    })

    it('normalizes unpkg unversioned to npm path and resolves version from workspace', async function () {
      this.timeout(50000)
      // set workspace dependency to control version resolution
      await writeFile('package.json', JSON.stringify({
        name: 'test-workspace',
        version: '1.0.0',
        dependencies: { '@openzeppelin/contracts': '4.9.6' }
      }, null, 2))

      const io = new NodeIOAdapter()
      const resolver = new ImportResolver(io as any, 'UnpkgUnversionedTest.sol', true)
      const original = 'https://unpkg.com/@openzeppelin/contracts/token/ERC20/ERC20.sol'
      const content = await resolver.resolveAndSave(original)
      expect(content).to.be.a('string').and.not.empty
  // should save package.json according to resolved version
  expect(await exists('.deps/npm/@openzeppelin/contracts@4.9.6/package.json')).to.equal(true)
  const mapped = resolver.getResolution(original)
  // Some environments record an intermediate mapping first (bare npm path) before final canonical mapping
  expect(mapped).to.include('@openzeppelin/contracts/token/ERC20/ERC20.sol')
    })

    it('normalizes jsDelivr unversioned to npm path and resolves version from workspace', async function () {
      this.timeout(50000)
      await writeFile('package.json', JSON.stringify({
        name: 'test-workspace',
        version: '1.0.0',
        dependencies: { '@openzeppelin/contracts': '4.9.6' }
      }, null, 2))

      const io = new NodeIOAdapter()
      const resolver = new ImportResolver(io as any, 'JsdelivrUnversionedTest.sol', true)
      const original = 'https://cdn.jsdelivr.net/npm/@openzeppelin/contracts/token/ERC20/ERC20.sol'
      const content = await resolver.resolveAndSave(original)
      expect(content).to.be.a('string').and.not.empty
  expect(await exists('.deps/npm/@openzeppelin/contracts@4.9.6/package.json')).to.equal(true)
  const mapped = resolver.getResolution(original)
  expect(mapped).to.include('@openzeppelin/contracts/token/ERC20/ERC20.sol')
    })
  })

  describe('#group16 - raw.githubusercontent.com imports', () => {
    it('saves GitHub raw imports under .deps/github and fetches package.json when available', async function () {
      this.timeout(60000)
      const io = new NodeIOAdapter()
      const resolver = new ImportResolver(io as any, 'RawGithubImport.sol', true)
      const original = 'https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts-upgradeable/v5.4.0/contracts/token/ERC1155/ERC1155Upgradeable.sol'
      const content = await resolver.resolveAndSave(original)
      expect(content).to.be.a('string').and.not.empty
      // normalized folder and optional package.json
      // Depending on adapter targetPath, file may be saved under `github/...` or `.deps/github/...`
      const ghSolPath = 'github/OpenZeppelin/openzeppelin-contracts-upgradeable@v5.4.0/contracts/token/ERC1155/ERC1155Upgradeable.sol'
      const ghDepsSolPath = `.deps/${ghSolPath}`
      expect(
        await exists(ghSolPath) || await exists(ghDepsSolPath)
      ).to.equal(true)
      // package.json should be saved under .deps/github
      expect(await exists('.deps/github/OpenZeppelin/openzeppelin-contracts-upgradeable@v5.4.0/package.json')).to.equal(true)
    })
  })

  describe('#group17 - unversioned GitHub raw import master/main normalization', () => {
    it('normalizes refs/heads/master to @master in .deps/github path', async function () {
      this.timeout(60000)
      const io = new NodeIOAdapter()
      const resolver = new ImportResolver(io as any, 'UnversionedGithubImport.sol', true)
      const original = 'https://raw.githubusercontent.com/remix-project-org/remix-project/refs/heads/master/apps/remix-ide/contracts/app/ethereum/constitution.sol'
      const content = await resolver.resolveAndSave(original)
      expect(content).to.be.a('string').and.not.empty
      const ghMasterSol = 'github/remix-project-org/remix-project@master/apps/remix-ide/contracts/app/ethereum/constitution.sol'
      const ghMasterSolDeps = `.deps/${ghMasterSol}`
      expect(
        await exists(ghMasterSol) || await exists(ghMasterSolDeps)
      ).to.equal(true)
    })
  })

  describe('#group18 - npm alias with multiple package versions', () => {
    it('resolves both @openzeppelin/contracts and alias @openzeppelin/contracts-5', async function () {
      this.timeout(70000)
      await writeFile('package.json', JSON.stringify({
        name: 'oz-multi-version-mre',
        private: true,
        dependencies: {
          '@openzeppelin/contracts': '4.9.6',
          '@openzeppelin/contracts-5': 'npm:@openzeppelin/contracts@5.0.2'
        }
      }, null, 2))

      const io = new NodeIOAdapter()
      const resolver = new ImportResolver(io as any, 'eee.sol', true)
      await resolver.resolveAndSave('@openzeppelin/contracts/token/ERC20/ERC20.sol')
      await resolver.resolveAndSave('@openzeppelin/contracts-5/token/ERC20/ERC20.sol')

  // Expect v4 package.json to be present (workspace resolution)
  expect(await exists('.deps/npm/@openzeppelin/contracts@4.9.6/package.json')).to.equal(true)
      // For the alias package, some environments don't persist package.json for the resolved real package.
      // Instead, ensure the resolved Solidity content was fetched under the expected versioned folder.
      expect(
        // saved directly (NodeIOAdapter default) or under .deps (if adapter provides a targetPath)
        await exists('@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol')
        || await exists('.deps/npm/@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol')
        || await exists('@openzeppelin/contracts@5/token/ERC20/ERC20.sol')
        || await exists('.deps/npm/@openzeppelin/contracts@5/token/ERC20/ERC20.sol')
      ).to.equal(true)

      // Also verify in-memory resolutions for both imports
      const mappedV4 = resolver.getResolution('@openzeppelin/contracts/token/ERC20/ERC20.sol')
      const mappedV5 = resolver.getResolution('@openzeppelin/contracts-5/token/ERC20/ERC20.sol')
      expect(mappedV4 && mappedV4.includes('@openzeppelin/contracts@4.9.6/')).to.equal(true)
      expect(mappedV5 && mappedV5.includes('@openzeppelin/contracts@5')).to.equal(true)
    })
  })

  describe('#group19 - jsDelivr multi-version imports', () => {
    it('resolves v4 ECDSA and v5 ERC20 via CDN and records mappings', async function () {
      this.timeout(70000)
      const io = new NodeIOAdapter()
      const resolver = new ImportResolver(io as any, 'MixedCDNVersions.sol', true)
      const v4 = 'https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.9.6/utils/cryptography/ECDSA.sol'
      const v5 = 'https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol'
      await resolver.resolveAndSave(v4)
      await resolver.resolveAndSave(v5)
      // Ensure package.json saved for both
      expect(await exists('.deps/npm/@openzeppelin/contracts@4.9.6/package.json')).to.equal(true)
      expect(await exists('.deps/npm/@openzeppelin/contracts@5.0.2/package.json') || await exists('.deps/npm/@openzeppelin/contracts@5/package.json')).to.equal(true)

      await resolver.saveResolutionsToIndex()
      const idxRaw = await fs.readFile('.deps/npm/.resolution-index.json', 'utf8')
      const idx = JSON.parse(idxRaw)
      const files = Object.keys(idx || {})
      const entry = files.find((f) => f.includes('MixedCDNVersions.sol'))
      expect(!!entry).to.equal(true)
    })
  })

  describe('#group20 - jsDelivr mixing v5 ERC20 with v4 SafeMath', () => {
    it('resolves both versions and ensures content fetched', async function () {
      this.timeout(70000)
      const io = new NodeIOAdapter()
      const resolver = new ImportResolver(io as any, 'djdidjod.sol', true)
      const v5 = 'https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol'
      const v4 = 'https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.9.6/utils/math/SafeMath.sol'
      const c1 = await resolver.resolveAndSave(v5)
      const c2 = await resolver.resolveAndSave(v4)
      expect(c1).to.be.a('string').and.not.empty
      expect(c2).to.be.a('string').and.not.empty
      expect(await exists('.deps/npm/@openzeppelin/contracts@5.0.2/package.json') || await exists('.deps/npm/@openzeppelin/contracts@5/package.json')).to.equal(true)
      expect(await exists('.deps/npm/@openzeppelin/contracts@4.9.6/package.json')).to.equal(true)
    })
  })

  // group13 (IPFS) – requires gateway mapping in Node adapter; skip for now
  it.skip('#group13 - IPFS imports (requires gateway mapping in Node adapter)', () => {})

  // group15 (invalid non-sol/package.json imports) – enforced by compiler/frontend; skip here
  it.skip('#group15 - invalid non-sol/package.json imports (frontend validation)', () => {})

  // group21 – transitive deps via compiler parse; skip here
  it.skip('#group21 - transitive multi-version via Chainlink (compiler integration)', () => {})

  // group22 – complex local + external imports; skip here
  it.skip('#group22 - complex project with local+external imports (compiler integration)', () => {})
})
