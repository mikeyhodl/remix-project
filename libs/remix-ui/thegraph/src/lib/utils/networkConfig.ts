// Network configuration for The Graph supported networks
import { SupportedNetwork } from '../types'

/**
 * Network configuration interface
 */
export interface NetworkConfig {
  name: string
  chainId: number
  explorerUrl: string
  explorerName: string
  graphStudioUrl: string
  nativeCurrency: string
  isTestnet: boolean
}

/**
 * Supported networks configuration
 */
export const NETWORK_CONFIG: Record<SupportedNetwork, NetworkConfig> = {
  'mainnet': {
    name: 'Ethereum',
    chainId: 1,
    explorerUrl: 'https://etherscan.io',
    explorerName: 'Etherscan',
    graphStudioUrl: 'https://api.studio.thegraph.com/query',
    nativeCurrency: 'ETH',
    isTestnet: false
  },
  'arbitrum-one': {
    name: 'Arbitrum One',
    chainId: 42161,
    explorerUrl: 'https://arbiscan.io',
    explorerName: 'Arbiscan',
    graphStudioUrl: 'https://api.studio.thegraph.com/query',
    nativeCurrency: 'ETH',
    isTestnet: false
  },
  'avalanche': {
    name: 'Avalanche',
    chainId: 43114,
    explorerUrl: 'https://snowtrace.io',
    explorerName: 'Snowtrace',
    graphStudioUrl: 'https://api.studio.thegraph.com/query',
    nativeCurrency: 'AVAX',
    isTestnet: false
  },
  'base': {
    name: 'Base',
    chainId: 8453,
    explorerUrl: 'https://basescan.org',
    explorerName: 'Basescan',
    graphStudioUrl: 'https://api.studio.thegraph.com/query',
    nativeCurrency: 'ETH',
    isTestnet: false
  },
  'bsc': {
    name: 'BNB Smart Chain',
    chainId: 56,
    explorerUrl: 'https://bscscan.com',
    explorerName: 'BscScan',
    graphStudioUrl: 'https://api.studio.thegraph.com/query',
    nativeCurrency: 'BNB',
    isTestnet: false
  },
  'optimism': {
    name: 'Optimism',
    chainId: 10,
    explorerUrl: 'https://optimistic.etherscan.io',
    explorerName: 'Optimism Explorer',
    graphStudioUrl: 'https://api.studio.thegraph.com/query',
    nativeCurrency: 'ETH',
    isTestnet: false
  },
  'polygon': {
    name: 'Polygon',
    chainId: 137,
    explorerUrl: 'https://polygonscan.com',
    explorerName: 'Polygonscan',
    graphStudioUrl: 'https://api.studio.thegraph.com/query',
    nativeCurrency: 'MATIC',
    isTestnet: false
  },
  'unichain': {
    name: 'Unichain',
    chainId: 1301,
    explorerUrl: 'https://unichain.blockscout.com',
    explorerName: 'Unichain Explorer',
    graphStudioUrl: 'https://api.studio.thegraph.com/query',
    nativeCurrency: 'ETH',
    isTestnet: false
  },
  'sepolia': {
    name: 'Sepolia',
    chainId: 11155111,
    explorerUrl: 'https://sepolia.etherscan.io',
    explorerName: 'Sepolia Etherscan',
    graphStudioUrl: 'https://api.studio.thegraph.com/query',
    nativeCurrency: 'ETH',
    isTestnet: true
  },
  'goerli': {
    name: 'Goerli',
    chainId: 5,
    explorerUrl: 'https://goerli.etherscan.io',
    explorerName: 'Goerli Etherscan',
    graphStudioUrl: 'https://api.studio.thegraph.com/query',
    nativeCurrency: 'ETH',
    isTestnet: true
  }
}

/**
 * Get network configuration by network ID
 */
export const getNetworkConfig = (network: SupportedNetwork): NetworkConfig => {
  return NETWORK_CONFIG[network]
}

/**
 * Get network name for display
 */
export const getNetworkName = (network: SupportedNetwork): string => {
  return NETWORK_CONFIG[network]?.name || network
}

/**
 * Get block explorer URL for an address
 */
export const getExplorerAddressUrl = (address: string, network: SupportedNetwork): string => {
  const config = NETWORK_CONFIG[network]
  if (!config) return ''
  return `${config.explorerUrl}/address/${address}`
}

/**
 * Get block explorer URL for a transaction
 */
export const getExplorerTxUrl = (txHash: string, network: SupportedNetwork): string => {
  const config = NETWORK_CONFIG[network]
  if (!config) return ''
  return `${config.explorerUrl}/tx/${txHash}`
}

/**
 * Get Graph Studio endpoint URL for a subgraph
 */
export const getGraphStudioUrl = (subgraphId: string, apiKey: string): string => {
  return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`
}

/**
 * Get all supported networks
 */
export const getSupportedNetworks = (): SupportedNetwork[] => {
  return Object.keys(NETWORK_CONFIG) as SupportedNetwork[]
}

/**
 * Get mainnet networks only (no testnets)
 */
export const getMainnetNetworks = (): SupportedNetwork[] => {
  return Object.entries(NETWORK_CONFIG)
    .filter(([_, config]) => !config.isTestnet)
    .map(([network]) => network as SupportedNetwork)
}

/**
 * Get testnet networks only
 */
export const getTestnetNetworks = (): SupportedNetwork[] => {
  return Object.entries(NETWORK_CONFIG)
    .filter(([_, config]) => config.isTestnet)
    .map(([network]) => network as SupportedNetwork)
}

/**
 * Check if a network is supported
 */
export const isNetworkSupported = (network: string): network is SupportedNetwork => {
  return network in NETWORK_CONFIG
}

/**
 * Get network by chain ID
 */
export const getNetworkByChainId = (chainId: number): SupportedNetwork | undefined => {
  const entry = Object.entries(NETWORK_CONFIG).find(([_, config]) => config.chainId === chainId)
  return entry ? entry[0] as SupportedNetwork : undefined
}
