import setupMethods from 'solc/wrapper'
import { CompilerInput, MessageToWorker } from './../../compiler/types'
let compileJSON: ((input: CompilerInput) => string) | null = (input) => { return '' }
const missingInputs: string[] = []

self.onmessage = (e: MessageEvent) => {
  const data: MessageToWorker = e.data
  switch (data.cmd) {
  case 'loadVersion':
  {
    const startTime = Date.now()
    console.log(`[COMPILER-WORKER] loadVersion command received at ${new Date().toISOString()}`)
    console.log(`[COMPILER-WORKER] URL to load: ${data.data}`)

    console.log(`[COMPILER-WORKER] Starting importScripts (download)...`)
    const importStartTime = Date.now()
    ;(self as any).importScripts(data.data)
    const importEndTime = Date.now()
    console.log(`[COMPILER-WORKER] importScripts completed in ${importEndTime - importStartTime}ms`)

    console.log(`[COMPILER-WORKER] Starting setupMethods (initialization)...`)
    const setupStartTime = Date.now()
    const compiler = setupMethods(self)
    const setupEndTime = Date.now()
    console.log(`[COMPILER-WORKER] setupMethods completed in ${setupEndTime - setupStartTime}ms`)

    compileJSON = (input) => {
      try {
        const missingInputsCallback = (path: string) => {
          missingInputs.push(path)
          return { error: 'Deferred import' }
        }
        return compiler.compile(input, { import: missingInputsCallback })
      } catch (exception) {
        return JSON.stringify({ error: 'Uncaught JavaScript exception:\n' + exception })
      }
    }

    console.log(`[COMPILER-WORKER] Getting version and license...`)
    const versionStartTime = Date.now()
    const version = compiler.version()
    const license = compiler.license()
    const versionEndTime = Date.now()
    console.log(`[COMPILER-WORKER] Version: ${version}, License retrieved in ${versionEndTime - versionStartTime}ms`)

    console.log(`[COMPILER-WORKER] Posting versionLoaded message back to main thread...`)
    self.postMessage({
      cmd: 'versionLoaded',
      data: version,
      license: license
    })
    const endTime = Date.now()
    console.log(`[COMPILER-WORKER] Total loadVersion time: ${endTime - startTime}ms`)
    console.log(`[COMPILER-WORKER] Breakdown: download=${importEndTime - importStartTime}ms, init=${setupEndTime - setupStartTime}ms, version=${versionEndTime - versionStartTime}ms`)
    break
  }

  case 'compile':
    missingInputs.length = 0
    if (data.input && compileJSON) {
      self.postMessage({
        cmd: 'compiled',
        job: data.job,
        timestamp: data.timestamp,
        data: compileJSON(data.input),
        input: data.input,
        missingInputs: missingInputs
      })
    }
    break
  }
}

