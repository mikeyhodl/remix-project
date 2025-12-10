/**
 * Alchemy MCP Tool Handlers for Remix MCP Server
 * Provides blockchain querying capabilities via Alchemy API
 */

import { IMCPToolResult } from '../../types/mcp';
import { BaseToolHandler } from '../registry/RemixToolRegistry';
import {
  ToolCategory,
  RemixToolDefinition
} from '../types/mcpTools';
import { Plugin } from '@remixproject/engine';

/**
 * Base class for Alchemy API handlers
 */
abstract class AlchemyBaseHandler extends BaseToolHandler {
  protected apiKey: string | undefined;

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey;
  }

  protected async callAlchemyApi(endpoint: string, method: string, params: any): Promise<any> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      throw new Error('Alchemy API key not configured. Please set ALCHEMY_API_KEY in your configuration.');
    }

    const url = `https://api.g.alchemy.com/prices/v1/${apiKey}/${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params
        })
      });

      if (!response.ok) {
        throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`Alchemy API error: ${data.error.message}`);
      }

      return data.result;
    } catch (error) {
      throw new Error(`Failed to call Alchemy API: ${error.message}`);
    }
  }
}

/**
 * Fetch Token Price by Symbol
 */
export class FetchTokenPriceBySymbolHandler extends AlchemyBaseHandler {
  name = 'alchemy_fetch_token_price_by_symbol';
  description = 'Get current token price by ticker symbol';
  inputSchema = {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Token symbol (e.g., ETH, BTC, USDC)'
      },
      network: {
        type: 'string',
        description: 'Blockchain network',
        enum: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'],
        default: 'ethereum'
      }
    },
    required: ['symbol']
  };

  getPermissions(): string[] {
    return ['alchemy:price:read'];
  }

  validate(args: any): boolean | string {
    const required = this.validateRequired(args, ['symbol']);
    if (required !== true) return required;

    const types = this.validateTypes(args, {
      symbol: 'string',
      network: 'string'
    });
    if (types !== true) return types;

    return true;
  }

  async execute(args: any, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await this.callAlchemyApi(
        'fetchTokenPriceBySymbol',
        'alchemy_fetchTokenPriceBySymbol',
        {
          symbol: args.symbol,
          network: args.network || 'ethereum'
        }
      );

      return this.createSuccessResult({
        success: true,
        symbol: args.symbol,
        network: args.network || 'ethereum',
        price: result.price,
        currency: result.currency || 'USD',
        lastUpdated: result.lastUpdated
      });
    } catch (error) {
      return this.createErrorResult(`Failed to fetch token price: ${error.message}`);
    }
  }
}

/**
 * Fetch Token Price by Address
 */
export class FetchTokenPriceByAddressHandler extends AlchemyBaseHandler {
  name = 'alchemy_fetch_token_price_by_address';
  description = 'Get current token price by contract address';
  inputSchema = {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'Token contract address',
        pattern: '^0x[a-fA-F0-9]{40}$'
      },
      network: {
        type: 'string',
        description: 'Blockchain network',
        enum: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'],
        default: 'ethereum'
      }
    },
    required: ['address']
  };

  getPermissions(): string[] {
    return ['alchemy:price:read'];
  }

  validate(args: any): boolean | string {
    const required = this.validateRequired(args, ['address']);
    if (required !== true) return required;

    if (!args.address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return 'Invalid contract address format';
    }

    return true;
  }

  async execute(args: any, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await this.callAlchemyApi(
        'fetchTokenPriceByAddress',
        'alchemy_fetchTokenPriceByAddress',
        {
          address: args.address,
          network: args.network || 'ethereum'
        }
      );

      return this.createSuccessResult({
        success: true,
        address: args.address,
        network: args.network || 'ethereum',
        price: result.price,
        currency: result.currency || 'USD',
        lastUpdated: result.lastUpdated
      });
    } catch (error) {
      return this.createErrorResult(`Failed to fetch token price: ${error.message}`);
    }
  }
}

/**
 * Fetch Token Price History by Symbol
 */
export class FetchTokenPriceHistoryBySymbolHandler extends AlchemyBaseHandler {
  name = 'alchemy_fetch_token_price_history_by_symbol';
  description = 'Get historical token price data by symbol';
  inputSchema = {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Token symbol (e.g., ETH, BTC)'
      },
      startDate: {
        type: 'string',
        description: 'Start date (ISO 8601 format)',
        pattern: '^\\d{4}-\\d{2}-\\d{2}'
      },
      endDate: {
        type: 'string',
        description: 'End date (ISO 8601 format)',
        pattern: '^\\d{4}-\\d{2}-\\d{2}'
      },
      network: {
        type: 'string',
        description: 'Blockchain network',
        default: 'ethereum'
      }
    },
    required: ['symbol', 'startDate', 'endDate']
  };

  getPermissions(): string[] {
    return ['alchemy:price:read'];
  }

  validate(args: any): boolean | string {
    const required = this.validateRequired(args, ['symbol', 'startDate', 'endDate']);
    if (required !== true) return required;

    return true;
  }

  async execute(args: any, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await this.callAlchemyApi(
        'fetchTokenPriceHistoryBySymbol',
        'alchemy_fetchTokenPriceHistoryBySymbol',
        {
          symbol: args.symbol,
          startDate: args.startDate,
          endDate: args.endDate,
          network: args.network || 'ethereum'
        }
      );

      return this.createSuccessResult({
        success: true,
        symbol: args.symbol,
        network: args.network || 'ethereum',
        startDate: args.startDate,
        endDate: args.endDate,
        data: result.data,
        count: result.data?.length || 0
      });
    } catch (error) {
      return this.createErrorResult(`Failed to fetch price history: ${error.message}`);
    }
  }
}

/**
 * Fetch Tokens Owned by Multichain Addresses
 */
export class FetchTokensOwnedHandler extends AlchemyBaseHandler {
  name = 'alchemy_fetch_tokens_owned';
  description = 'Get token balances across multiple chains for given addresses';
  inputSchema = {
    type: 'object',
    properties: {
      addresses: {
        type: 'array',
        description: 'Array of wallet addresses',
        items: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$'
        }
      },
      networks: {
        type: 'array',
        description: 'Networks to query',
        items: {
          type: 'string',
          enum: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base']
        },
        default: ['ethereum']
      }
    },
    required: ['addresses']
  };

  getPermissions(): string[] {
    return ['alchemy:balance:read'];
  }

  validate(args: any): boolean | string {
    const required = this.validateRequired(args, ['addresses']);
    if (required !== true) return required;

    if (!Array.isArray(args.addresses) || args.addresses.length === 0) {
      return 'addresses must be a non-empty array';
    }

    for (const addr of args.addresses) {
      if (!addr.match(/^0x[a-fA-F0-9]{40}$/)) {
        return `Invalid address format: ${addr}`;
      }
    }

    return true;
  }

  async execute(args: any, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await this.callAlchemyApi(
        'fetchTokensOwnedByMultichainAddresses',
        'alchemy_fetchTokensOwnedByMultichainAddresses',
        {
          addresses: args.addresses,
          networks: args.networks || ['ethereum']
        }
      );

      return this.createSuccessResult({
        success: true,
        addresses: args.addresses,
        networks: args.networks || ['ethereum'],
        tokens: result.tokens,
        totalValue: result.totalValue
      });
    } catch (error) {
      return this.createErrorResult(`Failed to fetch tokens: ${error.message}`);
    }
  }
}

/**
 * Fetch NFTs Owned by Multichain Addresses
 */
export class FetchNftsOwnedHandler extends AlchemyBaseHandler {
  name = 'alchemy_fetch_nfts_owned';
  description = 'Get NFTs owned across multiple chains for given addresses';
  inputSchema = {
    type: 'object',
    properties: {
      addresses: {
        type: 'array',
        description: 'Array of wallet addresses',
        items: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$'
        }
      },
      networks: {
        type: 'array',
        description: 'Networks to query',
        items: {
          type: 'string',
          enum: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base']
        },
        default: ['ethereum']
      },
      includeMetadata: {
        type: 'boolean',
        description: 'Include NFT metadata',
        default: false
      }
    },
    required: ['addresses']
  };

  getPermissions(): string[] {
    return ['alchemy:nft:read'];
  }

  validate(args: any): boolean | string {
    const required = this.validateRequired(args, ['addresses']);
    if (required !== true) return required;

    if (!Array.isArray(args.addresses) || args.addresses.length === 0) {
      return 'addresses must be a non-empty array';
    }

    return true;
  }

  async execute(args: any, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await this.callAlchemyApi(
        'fetchNftsOwnedByMultichainAddresses',
        'alchemy_fetchNftsOwnedByMultichainAddresses',
        {
          addresses: args.addresses,
          networks: args.networks || ['ethereum'],
          includeMetadata: args.includeMetadata || false
        }
      );

      return this.createSuccessResult({
        success: true,
        addresses: args.addresses,
        networks: args.networks || ['ethereum'],
        nfts: result.nfts,
        totalCount: result.totalCount
      });
    } catch (error) {
      return this.createErrorResult(`Failed to fetch NFTs: ${error.message}`);
    }
  }
}

/**
 * Fetch Address Transaction History
 */
export class FetchTransactionHistoryHandler extends AlchemyBaseHandler {
  name = 'alchemy_fetch_transaction_history';
  description = 'Get transaction history for an address';
  inputSchema = {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'Wallet address',
        pattern: '^0x[a-fA-F0-9]{40}$'
      },
      network: {
        type: 'string',
        description: 'Blockchain network',
        enum: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'],
        default: 'ethereum'
      },
      fromBlock: {
        type: 'number',
        description: 'Starting block number'
      },
      toBlock: {
        type: 'number',
        description: 'Ending block number'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of transactions to return',
        default: 100,
        maximum: 1000
      }
    },
    required: ['address']
  };

  getPermissions(): string[] {
    return ['alchemy:transaction:read'];
  }

  validate(args: any): boolean | string {
    const required = this.validateRequired(args, ['address']);
    if (required !== true) return required;

    if (!args.address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return 'Invalid address format';
    }

    return true;
  }

  async execute(args: any, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await this.callAlchemyApi(
        'fetchAddressTransactionHistory',
        'alchemy_fetchAddressTransactionHistory',
        {
          address: args.address,
          network: args.network || 'ethereum',
          fromBlock: args.fromBlock,
          toBlock: args.toBlock,
          limit: args.limit || 100
        }
      );

      return this.createSuccessResult({
        success: true,
        address: args.address,
        network: args.network || 'ethereum',
        transactions: result.transactions,
        count: result.transactions?.length || 0
      });
    } catch (error) {
      return this.createErrorResult(`Failed to fetch transaction history: ${error.message}`);
    }
  }
}

/**
 * Fetch Asset Transfers
 */
export class FetchTransfersHandler extends AlchemyBaseHandler {
  name = 'alchemy_fetch_transfers';
  description = 'Get asset transfer details with filtering';
  inputSchema = {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'Wallet address',
        pattern: '^0x[a-fA-F0-9]{40}$'
      },
      network: {
        type: 'string',
        description: 'Blockchain network',
        default: 'ethereum'
      },
      fromBlock: {
        type: 'string',
        description: 'Starting block (hex or decimal)'
      },
      toBlock: {
        type: 'string',
        description: 'Ending block (hex or decimal)'
      },
      category: {
        type: 'array',
        description: 'Transfer categories to include',
        items: {
          type: 'string',
          enum: ['external', 'internal', 'erc20', 'erc721', 'erc1155']
        }
      }
    },
    required: ['address']
  };

  getPermissions(): string[] {
    return ['alchemy:transfer:read'];
  }

  validate(args: any): boolean | string {
    const required = this.validateRequired(args, ['address']);
    if (required !== true) return required;

    if (!args.address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return 'Invalid address format';
    }

    return true;
  }

  async execute(args: any, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await this.callAlchemyApi(
        'fetchTransfers',
        'alchemy_fetchTransfers',
        {
          address: args.address,
          network: args.network || 'ethereum',
          fromBlock: args.fromBlock,
          toBlock: args.toBlock,
          category: args.category
        }
      );

      return this.createSuccessResult({
        success: true,
        address: args.address,
        network: args.network || 'ethereum',
        transfers: result.transfers,
        count: result.transfers?.length || 0
      });
    } catch (error) {
      return this.createErrorResult(`Failed to fetch transfers: ${error.message}`);
    }
  }
}

/**
 * Fetch NFT Contract Data
 */
export class FetchNftContractDataHandler extends AlchemyBaseHandler {
  name = 'alchemy_fetch_nft_contract_data';
  description = 'Get NFT collection information by contract address';
  inputSchema = {
    type: 'object',
    properties: {
      contractAddress: {
        type: 'string',
        description: 'NFT contract address',
        pattern: '^0x[a-fA-F0-9]{40}$'
      },
      network: {
        type: 'string',
        description: 'Blockchain network',
        enum: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'],
        default: 'ethereum'
      }
    },
    required: ['contractAddress']
  };

  getPermissions(): string[] {
    return ['alchemy:nft:read'];
  }

  validate(args: any): boolean | string {
    const required = this.validateRequired(args, ['contractAddress']);
    if (required !== true) return required;

    if (!args.contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return 'Invalid contract address format';
    }

    return true;
  }

  async execute(args: any, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const result = await this.callAlchemyApi(
        'fetchNftContractDataByMultichainAddress',
        'alchemy_fetchNftContractDataByMultichainAddress',
        {
          contractAddress: args.contractAddress,
          network: args.network || 'ethereum'
        }
      );

      return this.createSuccessResult({
        success: true,
        contractAddress: args.contractAddress,
        network: args.network || 'ethereum',
        name: result.name,
        symbol: result.symbol,
        totalSupply: result.totalSupply,
        tokenType: result.tokenType,
        metadata: result.metadata
      });
    } catch (error) {
      return this.createErrorResult(`Failed to fetch NFT contract data: ${error.message}`);
    }
  }
}

/**
 * Create and export Alchemy tool definitions
 */
export function createAlchemyTools(apiKey?: string): RemixToolDefinition[] {
  return [
    {
      name: 'alchemy_fetch_token_price_by_symbol',
      description: 'Get current token price by ticker symbol',
      inputSchema: new FetchTokenPriceBySymbolHandler(apiKey).inputSchema,
      category: ToolCategory.DEPLOYMENT,
      permissions: ['alchemy:price:read'],
      handler: new FetchTokenPriceBySymbolHandler(apiKey)
    },
    {
      name: 'alchemy_fetch_token_price_by_address',
      description: 'Get current token price by contract address',
      inputSchema: new FetchTokenPriceByAddressHandler(apiKey).inputSchema,
      category: ToolCategory.DEPLOYMENT,
      permissions: ['alchemy:price:read'],
      handler: new FetchTokenPriceByAddressHandler(apiKey)
    },
    {
      name: 'alchemy_fetch_token_price_history_by_symbol',
      description: 'Get historical token price data by symbol',
      inputSchema: new FetchTokenPriceHistoryBySymbolHandler(apiKey).inputSchema,
      category: ToolCategory.DEPLOYMENT,
      permissions: ['alchemy:price:read'],
      handler: new FetchTokenPriceHistoryBySymbolHandler(apiKey)
    },
    {
      name: 'alchemy_fetch_tokens_owned',
      description: 'Get token balances across multiple chains for given addresses',
      inputSchema: new FetchTokensOwnedHandler(apiKey).inputSchema,
      category: ToolCategory.DEPLOYMENT,
      permissions: ['alchemy:balance:read'],
      handler: new FetchTokensOwnedHandler(apiKey)
    },
    {
      name: 'alchemy_fetch_nfts_owned',
      description: 'Get NFTs owned across multiple chains for given addresses',
      inputSchema: new FetchNftsOwnedHandler(apiKey).inputSchema,
      category: ToolCategory.DEPLOYMENT,
      permissions: ['alchemy:nft:read'],
      handler: new FetchNftsOwnedHandler(apiKey)
    },
    {
      name: 'alchemy_fetch_transaction_history',
      description: 'Get transaction history for an address',
      inputSchema: new FetchTransactionHistoryHandler(apiKey).inputSchema,
      category: ToolCategory.DEPLOYMENT,
      permissions: ['alchemy:transaction:read'],
      handler: new FetchTransactionHistoryHandler(apiKey)
    },
    {
      name: 'alchemy_fetch_transfers',
      description: 'Get asset transfer details with filtering',
      inputSchema: new FetchTransfersHandler(apiKey).inputSchema,
      category: ToolCategory.DEPLOYMENT,
      permissions: ['alchemy:transfer:read'],
      handler: new FetchTransfersHandler(apiKey)
    },
    {
      name: 'alchemy_fetch_nft_contract_data',
      description: 'Get NFT collection information by contract address',
      inputSchema: new FetchNftContractDataHandler(apiKey).inputSchema,
      category: ToolCategory.DEPLOYMENT,
      permissions: ['alchemy:nft:read'],
      handler: new FetchNftContractDataHandler(apiKey)
    }
  ];
}
