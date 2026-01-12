import { DebuggerUI } from '@remix-ui/debugger-ui' // eslint-disable-line
import { DebuggerApiMixin } from '@remix-ui/debugger-ui'
import { ViewPlugin } from '@remixproject/engine-web'
import * as packageJson from '../../../../../package.json'
import React from 'react' // eslint-disable-line
import { bleach } from '@remix-ui/helper'
import { compilationFinishedToastMsg, compilingToastMsg, notFoundToastMsg, sourceVerificationNotAvailableToastMsg } from '@remix-ui/helper'
const css = require('./styles/debugger-tab-styles')

const profile = {
  name: 'debugger',
  displayName: 'Debugger',
  methods: [
    'debug',
    'getTrace',
    'decodeLocalVariable',
    'decodeStateVariable',
    'globalContext',
    'getValidSourceLocationFromVMTraceIndex',
    'sourceLocationFromInstructionIndex',
    'extractLocalsAt',
    'decodeLocalsAt',
    'extractStateAt',
    'decodeStateAt',
    'storageViewAt'
  ],
  events: [],
  icon: 'assets/img/debuggerLogo.webp',
  description: 'Debug transactions',
  kind: 'debugging',
  location: 'sidePanel',
  documentation: 'https://remix-ide.readthedocs.io/en/latest/debugger.html',
  version: packageJson.version,
  maintainedBy: 'Remix'
}

export default class DebuggerTab extends DebuggerApiMixin(ViewPlugin) {
  constructor () {
    super(profile)
    this.el = document.createElement('div')
    this.el.setAttribute('id', 'debugView')
    this.el.classList.add(css.debuggerTabView)
    this.initDebuggerApi()
  }

  render () {
    this.on('fetchAndCompile', 'compiling', (settings) => {
      settings = JSON.stringify(settings, null, '\t')
      this.call('notification', 'toast', compilingToastMsg(settings))
    })

    this.on('fetchAndCompile', 'compilationFailed', (data) => {
      this.call('notification', 'toast', compilationFinishedToastMsg())
    })

    this.on('fetchAndCompile', 'notFound', (contractAddress) => {
      this.call('notification', 'toast', notFoundToastMsg(contractAddress))
    })

    this.on('fetchAndCompile', 'sourceVerificationNotAvailable', () => {
      this.call('notification', 'toast', sourceVerificationNotAvailableToastMsg())
    })
    const onReady = (api) => { this.api = api }
    return <div className="overflow-hidden px-1" id='debugView'><DebuggerUI debuggerAPI={this} onReady={onReady} /></div>
  }

  showMessage (title, message) {
    try {
      this.call('notification', 'alert', {
        id: 'debuggerTabShowMessage',
        title,
        message: bleach.sanitize(message)
      })
    } catch (e) {
      console.log(e)
    }
  }

  /**
   * Retrieves the execution trace for the transaction currently being debugged.
   *
   * @returns {Promise<any|null>} The complete execution trace including all steps, or null if debugger backend is not initialized
   */
  async getTrace () {
    if (!this.debuggerBackend) return null
    return await this.debuggerBackend.debugger.getTrace()
  }

  /**
   * Decodes a local variable at a specific step in the transaction execution.
   * Local variables are function-scoped variables in the smart contract.
   *
   * @param {number} variableId - The unique identifier of the local variable to decode
   * @param {number} [stepIndex] - Optional step index in the trace; defaults to current step if not provided
   * @returns {Promise<any|null>} The decoded variable value and metadata, or null if debugger backend is not initialized
   */
  async decodeLocalVariable (variableId: number, stepIndex?: number) {
    if (!this.debuggerBackend) return null
    return await this.debuggerBackend.debugger.decodeLocalVariableById(stepIndex || this.debuggerBackend.step_manager.currentStepIndex, variableId)
  }

  /**
   * Decodes a state variable at a specific step in the transaction execution.
   * State variables are contract-level storage variables that persist between function calls.
   *
   * @param {number} variableId - The unique identifier of the state variable to decode
   * @param {number} [stepIndex] - Optional step index in the trace; defaults to current step if not provided
   * @returns {Promise<any|null>} The decoded variable value and metadata, or null if debugger backend is not initialized
   */
  async decodeStateVariable (variableId: number, stepIndex?: number) {
    if (!this.debuggerBackend) return null
    return await this.debuggerBackend.debugger.decodeStateVariableById(stepIndex || this.debuggerBackend.step_manager.currentStepIndex, variableId)
  }

  /**
   * Retrieves the global execution context for the transaction being debugged.
   * This includes blockchain context (block), message context (msg), and transaction context (tx)
   * similar to Solidity's global variables.
   *
   * @returns {Promise<{block: object|null, msg: object|null, tx: object|null}>} An object containing:
   *   - block: Block context including chainid, coinbase, difficulty, gaslimit, number, timestamp, and optionally basefee
   *   - msg: Message context with sender address, function signature, and value in Wei
   *   - tx: Transaction context with origin address
   *   Returns null values if the API context is not available
   */
  async globalContext () {
    if (this.api?.globalContext) {
      const { tx, block } = await this.api.globalContext()
      const blockContext = {
        'chainid': tx.chainId,
        'coinbase': block.miner,
        'difficulty': block.difficulty,
        'gaslimit': block.gasLimit,
        'number': block.number,
        'timestamp': block.timestamp,
      }
      if (block.baseFeePerGas) {
        blockContext['basefee'] = BigInt(block.baseFeePerGas).toString(10) + ` Wei (${block.baseFeePerGas})`
      }
      const msg = {
        'sender': tx.from,
        'sig': tx.input.substring(0, 10),
        'value': tx.value + ' Wei'
      }

      const txOrigin = {
        'origin': tx.from
      }

      return {
        block: blockContext,
        msg,
        tx: txOrigin
      }
    } else {
      return {
        block: null,
        msg: null,
        tx: null
      }
    }
  }

  /**
   * Retrieves a valid source location from a VM trace step index.
   * Similar to sourceLocationFromVMTraceIndex but ensures the location is valid (non-empty).
   *
   * @param {string} address - Contract address
   * @param {number} stepIndex - VM trace step index
   * @returns {Promise<any|null>} Valid source location object with file, start, and length information, or null if debugger backend is not initialized
   */
  async getValidSourceLocationFromVMTraceIndex (address: string, stepIndex: number) {
    if (!this.debuggerBackend) return null
    return await this.debuggerBackend.debugger.getValidSourceLocationFromVMTraceIndex(address, stepIndex)
  }

  /**
   * Retrieves the source location from an instruction index (bytecode position).
   *
   * @param {string} address - Contract address
   * @param {number} instIndex - Instruction index in the bytecode
   * @returns {Promise<any|null>} Source location object with file, start, and length information, or null if debugger backend is not initialized
   */
  async sourceLocationFromInstructionIndex (address: string, instIndex: number) {
    if (!this.debuggerBackend) return null
    return await this.debuggerBackend.debugger.sourceLocationFromInstructionIndex(address, instIndex)
  }

  /**
   * Extracts the scope information (local variables context) at a specific execution step.
   *
   * @param {number} step - Execution step index
   * @returns {any|null} Scope information containing local variables for the given step, or null if debugger backend is not initialized
   */
  async extractLocalsAt (step: number) {
    if (!this.debuggerBackend) return null
    return this.debuggerBackend.debugger.extractLocalsAt(step)
  }

  /**
   * Decodes all local variables at a specific execution step and source location.
   * Uses the EVM stack, memory, storage, and calldata to reconstruct variable values.
   *
   * @param {number} step - Execution step index
   * @param {any} sourceLocation - Source code location for context
   * @param {Function} callback - Callback function with signature (error, locals)
   * @returns {Promise<void>} Calls callback with decoded locals or error
   */
  async decodeLocalsAt (step: number, sourceLocation: any, callback: (error: any, locals?: any) => void) {
    if (!this.debuggerBackend) return callback('Debugger backend is not initialized')
    return await this.debuggerBackend.debugger.decodeLocalsAt(step, sourceLocation, callback)
  }

  /**
   * Extracts all state variables at a specific execution step.
   * Returns metadata about the state variables without decoding their values.
   *
   * @param {number} step - Execution step index
   * @returns {Promise<any|null>} Array of state variable metadata objects, or null if debugger backend is not initialized
   */
  async extractStateAt (step: number) {
    if (!this.debuggerBackend) return null
    return await this.debuggerBackend.debugger.extractStateAt(step)
  }

  /**
   * Decodes the values of specified state variables at a specific execution step.
   * Retrieves values from contract storage and decodes them according to their types.
   *
   * @param {number} step - Execution step index
   * @param {any[]} stateVars - Array of state variable metadata to decode
   * @param {Function} [callback] - Optional callback function receiving the result or error
   * @returns {Promise<any|null>} Object mapping variable names to their decoded values, or null if debugger backend is not initialized
   */
  async decodeStateAt (step: number, stateVars: any[], callback?: (result: any) => void) {
    if (!this.debuggerBackend) return null
    return await this.debuggerBackend.debugger.decodeStateAt(step, stateVars, callback)
  }

  /**
   * Creates a StorageViewer instance for inspecting contract storage at a specific step.
   *
   * @param {number} step - Execution step index
   * @param {string} address - Contract address whose storage to view
   * @returns {any|null} StorageViewer instance configured for the given step and address, or null if debugger backend is not initialized
   */
  async storageViewAt (step: number, address: string) {
    if (!this.debuggerBackend) return null
    return this.debuggerBackend.debugger.storageViewAt(step, address)
  }
}
