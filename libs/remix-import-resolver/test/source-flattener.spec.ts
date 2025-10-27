/// <reference types="mocha" />
import { expect } from 'chai'
import { mkdtemp, rm, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promises as fs } from 'fs'

import { NodeIOAdapter, SourceFlattener } from '../src'

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true } catch { return false }
}

function collectPackageVersions(flattened: string, pkgPrefix: string): Set<string> {
  const escaped = pkgPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^\\s*//\\s*File:\\s+${escaped}@([^/]+)/`, 'gm')
  const versions = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(flattened)) !== null) versions.add(m[1])
  return versions
}

describe('import-resolver: flattener e2e', () => {
  let originalCwd: string
  let tempDir: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tempDir = await mkdtemp(join(tmpdir(), 'import-resolver-flat-'))
    process.chdir(tempDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(tempDir, { recursive: true, force: true })
  })

  it('flattens an entry with OZ ERC20 @4.8.0', async function () {
    this.timeout(60000)
    const io = new NodeIOAdapter()
    const flattener = new SourceFlattener(io, true)
    const entry = 'MyToken.sol'
    const source = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\nimport "@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol";\n\ncontract MyToken is ERC20 {\n  constructor() ERC20("MyToken", "MTK") {}\n}`
    await fs.writeFile(entry, source, 'utf8')
    const result = await flattener.flatten(entry)
    expect(result.flattened).to.be.a('string')
    const ozVersions = collectPackageVersions(result.flattened, '@openzeppelin/contracts')
    expect(ozVersions.size).to.equal(1)
    expect(ozVersions.has('4.8.0')).to.equal(true)
    expect(result.flattened).to.not.match(/\bimport\s+"/)
  })

  it('supports remappings from file and inline (file precedence)', async function () {
    this.timeout(90000)
    const io = new NodeIOAdapter()
    const flattener = new SourceFlattener(io, true)
    const entry = 'Remap.sol'
    const src = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\nimport "oz/token/ERC20/ERC20.sol";\n\ncontract R is ERC20 {\n  constructor() ERC20("R","R") {}\n}`
    await fs.writeFile(entry, src, 'utf8')
    await fs.writeFile('remappings.txt', 'oz=@openzeppelin/contracts@4.8.0/', 'utf8')
    const result = await flattener.flatten(entry, { remappingsFile: 'remappings.txt', remappings: ['oz=@openzeppelin/contracts@5.4.0/']})
    const ozVersions = collectPackageVersions(result.flattened, '@openzeppelin/contracts')
    expect(ozVersions.has('4.8.0')).to.equal(true)
    expect(ozVersions.has('5.4.0')).to.equal(false)
  })

  it('writes flattened output to a file', async function () {
    this.timeout(90000)
    const io = new NodeIOAdapter()
    const flattener = new SourceFlattener(io, true)
    const entry = 'W.sol'
    const src = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\nimport "@openzeppelin/contracts@4.8.0/token/ERC20/ERC20.sol";\n\ncontract W is ERC20 {\n  constructor() ERC20("W","W") {}\n}`
    await fs.writeFile(entry, src, 'utf8')
    const outPath = 'out/F.sol'
    const result = await flattener.flattenToFile(entry, outPath)
    expect(await exists(outPath)).to.equal(true)
    const fileContent = await fs.readFile(outPath, 'utf8')
    expect(fileContent).to.equal(result.flattened)
  })
})
