import { expect } from 'chai'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { ImportResolver } from '../src/compiler/import-resolver'
import { NodeIOAdapter } from '../src/compiler/adapters/node-io-adapter'

describe('extractPackageName (alias-aware)', function () {
  let originalCwd: string
  let tempDir: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tempDir = await mkdtemp(join(tmpdir(), 'extract-pkgname-test-'))
    process.chdir(tempDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(tempDir, { recursive: true, force: true })
  })

  it('returns alias key for npm alias remapping (e.g., @module_remapping)', async function () {
    await writeFile('package.json', JSON.stringify({
      name: 'alias-ws', private: true,
      dependencies: { '@module_remapping': 'npm:@openzeppelin/contracts@4.9.0' }
    }, null, 2))

    const io = new NodeIOAdapter()
    const resolver = new ImportResolver(io as any, 'Alias.spec.ts', false)
    // Ensure workspace resolutions are loaded so alias keys are known to the resolver
    await (resolver as any).packageVersionResolver.loadWorkspaceResolutions()

    const pkg = (resolver as any).extractPackageName('@module_remapping/token/ERC20/ERC20.sol')
    expect(pkg).to.equal('@module_remapping')
  })

  it('returns scoped package for standard scoped import', async function () {
    await writeFile('package.json', JSON.stringify({ name: 'basic-ws', private: true }, null, 2))

    const io = new NodeIOAdapter()
    const resolver = new ImportResolver(io as any, 'Alias.spec.ts', false)
    await (resolver as any).packageVersionResolver.loadWorkspaceResolutions()

    const pkg = (resolver as any).extractPackageName('@openzeppelin/contracts/token/ERC20/ERC20.sol')
    expect(pkg).to.equal('@openzeppelin/contracts')
  })
})
