'use strict'
import { toNumber, ethers } from 'ethers'


export function loadWeb3 (url = 'http://localhost:8545') {
  const provider = new ethers.JsonRpcProvider(url)
  extendWeb3(provider)
  return provider
}

export function extendWeb3 (provider) { // Provider should be ethers.js provider

  provider.debug.preimage = (key, cb) => {
    this.send('debug_preimage', [key])
      .then(result => cb(null, result))
      .catch(error => cb(error))
  }

  provider.debug.traceTransaction = (txHash, options, cb) => {
    this.send('debug_traceTransaction', [txHash, options])
      .then(result => cb(null, result))
      .catch(error => cb(error))
  }

  provider.debug.storageRangeAt = (txBlockHash, txIndex, address, start, maxSize, cb) => {
    this.send('debug_storageRangeAt', [txBlockHash, toNumber(txIndex), address, start, maxSize])
      .then(result => cb(null, result))
      .catch(error => cb(error))
  }
}
