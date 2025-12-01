import { Profile } from "@remixproject/plugin-utils";
import { ElectronBasePlugin, ElectronBasePluginClient } from "@remixproject/plugin-electron"
import chokidar from 'chokidar'
import { ElectronBasePluginRemixdClient } from "../lib/remixd"
import fs from 'fs'
import * as utils from '../lib/utils'

import { basename, join } from "path";
import { spawn } from "child_process";
const profile: Profile = {
    name: 'foundry',
    displayName: 'electron foundry',
    description: 'electron foundry',
}

export class FoundryPlugin extends ElectronBasePlugin {
    clients: any[]
    constructor() {
        super(profile, clientProfile, FoundryPluginClient)
        this.methods = [...super.methods]
    }
}

const clientProfile: Profile = {
    name: 'foundry',
    displayName: 'electron foundry',
    description: 'electron foundry',
    methods: ['sync', 'compile']
}


class FoundryPluginClient extends ElectronBasePluginRemixdClient {

    watcher: chokidar.FSWatcher
    warnlog: boolean
    buildPath: string
    cachePath: string
    logTimeout: NodeJS.Timeout
    processingTimeout: NodeJS.Timeout

    async onActivation(): Promise<void> {
        console.log('Foundry plugin activated')
        this.on('fs' as any, 'workingDirChanged', async (path: string) => {
            this.currentSharedFolder = path
            this.startListening()
        })
        this.currentSharedFolder = await this.call('fs' as any, 'getWorkingDir')
        if(this.currentSharedFolder) this.startListening()
    }

    startListening() {
        this.buildPath = utils.absolutePath('out', this.currentSharedFolder)
        this.cachePath = utils.absolutePath('cache', this.currentSharedFolder)
        this.on('fileManager', 'currentFileChanged', async (currentFile: string) => {
            const cache = JSON.parse(await fs.promises.readFile(join(this.cachePath, 'solidity-files-cache.json'), { encoding: 'utf-8' }))
            this.emitContract(basename(currentFile), cache)
        })
        this.listenOnFoundryCompilation()
    }

     listenOnFoundryCompilation() {
        try {
            if (this.watcher) this.watcher.close()
            this.watcher = chokidar.watch(this.cachePath, { depth: 0, ignorePermissionErrors: true, ignoreInitial: true })
            this.watcher.on('change', async () => {
                const currentFile = await this.call('fileManager', 'getCurrentFile')
                const cache = JSON.parse(await fs.promises.readFile(join(this.cachePath, 'solidity-files-cache.json'), { encoding: 'utf-8' }))
                this.emitContract(basename(currentFile), cache)
            })
            this.watcher.on('add', async () => {
                const currentFile = await this.call('fileManager', 'getCurrentFile')
                const cache = JSON.parse(await fs.promises.readFile(join(this.cachePath, 'solidity-files-cache.json'), { encoding: 'utf-8' }))
                this.emitContract(basename(currentFile), cache)
            })
        } catch (e) {
            console.log(e)
        }
    }
    
    compile() {
        return new Promise((resolve, reject) => {
            const cmd = `forge build`
            const options = { cwd: this.currentSharedFolder, shell: true }
            const child = spawn(cmd, options)
            let error = ''
            child.stdout.on('data', async (data) => {
                if (data.toString().includes('Error')) {
                    this.call('terminal', 'log', { type: 'error', value: `[Foundry] ${data.toString()}` })
                } else {
                    const msg = `[Foundry] ${data.toString()}`
                    console.log('\x1b[32m%s\x1b[0m', msg)
                    this.call('terminal', 'log', { type: 'log', value: msg })
                }
            })
            child.stderr.on('data', (err) => {
                error += err.toString() + '\n'
                this.call('terminal', 'log', { type: 'error', value: `[Foundry] ${err.toString()}` })
            })
            child.on('close', async () => {
                const currentFile = await this.call('fileManager', 'getCurrentFile')
                const cache = JSON.parse(await fs.promises.readFile(join(this.cachePath, 'solidity-files-cache.json'), { encoding: 'utf-8' }))
                this.emitContract(basename(currentFile), cache)
                resolve('')
            })
        })
    }
    
    private async emitContract(file: string, cache) {
        try {
            const path = join(this.buildPath, file) // out/Counter.sol/
            const compilationResult = {
                input: {},
                output: {
                    contracts: {},
                    sources: {}
                },
                inputSources: { sources: {}, target: '' },
                solcVersion: null,
                compilationTarget: null
            }
            compilationResult.inputSources.target = file
            await this.readContract(path, compilationResult, cache)
            this.emit('compilationFinished', compilationResult.compilationTarget, { sources: compilationResult.input }, 'soljson', compilationResult.output, compilationResult.solcVersion)
        } catch (e) {
            console.log('Error emitting contract', e)
        }
    }

    async readContract(contractFolder, compilationResultPart, cache) {
        const files = await fs.promises.readdir(contractFolder)
        for (const file of files) {
            const path = join(contractFolder, file)
            const content = await fs.promises.readFile(path, { encoding: 'utf-8' })
            compilationResultPart.inputSources.sources[file] = { content }
            await this.feedContractArtifactFile(file, content, compilationResultPart, cache)
        }
    }

    async feedContractArtifactFile(path, content, compilationResultPart, cache) {
        const contentJSON = JSON.parse(content)
        const contractName = basename(path).replace('.json', '')

        let sourcePath = ''
        if (contentJSON?.metadata?.settings?.compilationTarget) {
            for (const key in contentJSON.metadata.settings.compilationTarget) {
                if (contentJSON.metadata.settings.compilationTarget[key] === contractName) {
                    sourcePath = key
                    break
                }
            }
        }

        if (!sourcePath) return

        const currentCache = cache.files[sourcePath]
        if (!currentCache.artifacts[contractName]) return

        // extract source and version
        const metadata = contentJSON.metadata
        if (metadata.compiler && metadata.compiler.version) {
            compilationResultPart.solcVersion = metadata.compiler.version
        } else {
            compilationResultPart.solcVersion = ''
            console.log('\x1b[32m%s\x1b[0m', 'compiler version not found, please update Foundry to the latest version.')
        }

        if (metadata.sources) {
            for (const path in metadata.sources) {
                const absPath = utils.absolutePath(path, this.currentSharedFolder)
                try {
                    const content = await fs.promises.readFile(absPath, { encoding: 'utf-8' })
                    compilationResultPart.input[path] = { content }
                } catch (e) {
                    compilationResultPart.input[path] = { content: '' }
                }
            }
        } else {
            console.log('\x1b[32m%s\x1b[0m', 'sources input not found, please update Foundry to the latest version.')
        }

        compilationResultPart.compilationTarget = sourcePath
        // extract data
        if (!compilationResultPart.output['sources'][sourcePath]) compilationResultPart.output['sources'][sourcePath] = {}
        compilationResultPart.output['sources'][sourcePath] = {
            ast: contentJSON['ast'],
            id: contentJSON['id']
        }
        if (!compilationResultPart.output['contracts'][sourcePath]) compilationResultPart.output['contracts'][sourcePath] = {}

        contentJSON.bytecode.object = contentJSON.bytecode.object.replace('0x', '')
        contentJSON.deployedBytecode.object = contentJSON.deployedBytecode.object.replace('0x', '')
        compilationResultPart.output['contracts'][sourcePath][contractName] = {
            abi: contentJSON.abi,
            evm: {
                bytecode: contentJSON.bytecode,
                deployedBytecode: contentJSON.deployedBytecode,
                methodIdentifiers: contentJSON.methodIdentifiers
            },
            metadata: contentJSON.metadata
        }
    }

    async sync() {
        console.log('syncing Foundry with Remix...')
        const currentFile = await this.call('fileManager', 'getCurrentFile')
        const cache = JSON.parse(await fs.promises.readFile(join(this.cachePath, 'solidity-files-cache.json'), { encoding: 'utf-8' }))
        this.emitContract(basename(currentFile), cache)
    }
}


