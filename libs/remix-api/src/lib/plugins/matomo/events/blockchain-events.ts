/**
 * Blockchain Events - Blockchain interactions and UDAPP tracking events
 * 
 * This file contains all blockchain and universal dapp related Matomo events.
 */

import { MatomoEventBase } from '../core/base-types';

export interface BlockchainEvent extends MatomoEventBase {
  category: 'blockchain';
  action: 
    | 'providerChanged'
    | 'networkChanged'
    | 'accountChanged'
    | 'connectionError'
    | 'transactionSent'
    | 'transactionFailed'
    | 'providerPinned'
    | 'providerUnpinned'
    | 'deployWithProxy'
    | 'upgradeWithProxy';
}

export interface UdappEvent extends MatomoEventBase {
  category: 'udapp';
  action: 
    | 'providerChanged'
    | 'sendTransaction-from-plugin'
    | 'sendTransaction-from-gui'
    | 'safeSmartAccount'
    | 'hardhat'
    | 'sendTx'
    | 'syncContracts'
    | 'forkState'
    | 'deleteState'
    | 'pinContracts'
    | 'signUsingAccount'
    | 'contractDelegation'
    | 'useAtAddress'
    | 'DeployAndPublish'
    | 'DeployOnly'
    | 'DeployContractTo'
    | 'broadcastCompilationResult'
    | 'runTests';
}

export interface RunEvent extends MatomoEventBase {
  category: 'run';
  action: 
    | 'recorder'
    | 'deploy'
    | 'execute'
    | 'debug';
}

/**
 * Blockchain Events - Type-safe builders
 */
export const BlockchainEvents = {
  providerChanged: (name?: string, value?: string | number): BlockchainEvent => ({
    category: 'blockchain',
    action: 'providerChanged',
    name,
    value,
    isClick: true // User clicks to change provider
  }),
  
  networkChanged: (name?: string, value?: string | number): BlockchainEvent => ({
    category: 'blockchain',
    action: 'networkChanged',
    name,
    value,
    isClick: true // User changes network
  }),
  
  transactionSent: (name?: string, value?: string | number): BlockchainEvent => ({
    category: 'blockchain',
    action: 'transactionSent',
    name,
    value,
    isClick: false // Transaction sending is a system event
  }),
  
  providerPinned: (name?: string, value?: string | number): BlockchainEvent => ({
    category: 'blockchain',
    action: 'providerPinned',
    name,
    value,
    isClick: true // User pins a provider
  }),
  
  providerUnpinned: (name?: string, value?: string | number): BlockchainEvent => ({
    category: 'blockchain',
    action: 'providerUnpinned',
    name,
    value,
    isClick: true // User unpins a provider
  }),
  
  deployWithProxy: (name?: string, value?: string | number): BlockchainEvent => ({
    category: 'blockchain',
    action: 'deployWithProxy',
    name,
    value,
    isClick: true // User deploys contract with proxy
  }),
  
  upgradeWithProxy: (name?: string, value?: string | number): BlockchainEvent => ({
    category: 'blockchain',
    action: 'upgradeWithProxy',
    name,
    value,
    isClick: true // User upgrades contract with proxy
  })
} as const;

/**
 * Udapp Events - Type-safe builders
 */
export const UdappEvents = {
  providerChanged: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'providerChanged',
    name,
    value,
    isClick: true // User clicks to change provider
  }),
  
  sendTransactionFromPlugin: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'sendTransaction-from-plugin',
    name,
    value,
    isClick: true // User clicks to send transaction from plugin
  }),

  sendTransactionFromGui: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'sendTransaction-from-gui',
    name,
    value,
    isClick: true // User clicks to send transaction from GUI
  }),
  
  hardhat: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'hardhat',
    name,
    value,
    isClick: true // User clicks Hardhat-related actions
  }),
  
  sendTx: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'sendTx',
    name,
    value,
    isClick: true // User clicks to send transaction
  }),
  
  syncContracts: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'syncContracts',
    name,
    value,
    isClick: true // User clicks to sync contracts
  }),
  
  pinContracts: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'pinContracts',
    name,
    value,
    isClick: true // User clicks to pin/unpin contracts
  }),
  
  safeSmartAccount: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'safeSmartAccount',
    name,
    value,
    isClick: true // User interacts with Safe Smart Account features
  }),
  
  contractDelegation: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'contractDelegation',
    name,
    value,
    isClick: true // User interacts with contract delegation
  }),
  
  signUsingAccount: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'signUsingAccount',
    name,
    value,
    isClick: false // Signing action is typically system-triggered
  }),
  
  forkState: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'forkState',
    name,
    value,
    isClick: true // User clicks to fork state
  }),
  
  deleteState: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'deleteState',
    name,
    value,
    isClick: true // User clicks to delete state
  }),

  useAtAddress: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'useAtAddress',
    name,
    value,
    isClick: true // User uses existing contract at address
  }),
  
  DeployAndPublish: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'DeployAndPublish',
    name,
    value,
    isClick: true // User clicks to deploy and publish
  }),
  
  DeployOnly: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'DeployOnly',
    name,
    value,
    isClick: true // User clicks to deploy only
  }),
  
  deployContractTo: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'DeployContractTo',
    name,
    value,
    isClick: true // User deploys contract to specific address
  }),
  
  runTests: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'runTests',
    name,
    value,
    isClick: true // User clicks to run tests
  }),
  
  broadcastCompilationResult: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'broadcastCompilationResult',
    name,
    value,
    isClick: false // System broadcasts compilation result
  })
} as const;

/**
 * Run Events - Type-safe builders  
 */
export const RunEvents = {
  recorder: (name?: string, value?: string | number): RunEvent => ({
    category: 'run',
    action: 'recorder',
    name,
    value,
    isClick: true // User interacts with recorder functionality
  }),
  
  deploy: (name?: string, value?: string | number): RunEvent => ({
    category: 'run',
    action: 'deploy',
    name,
    value,
    isClick: true // User deploys contract
  }),
  
  execute: (name?: string, value?: string | number): RunEvent => ({
    category: 'run',
    action: 'execute',
    name,
    value,
    isClick: true // User executes function
  })
} as const;