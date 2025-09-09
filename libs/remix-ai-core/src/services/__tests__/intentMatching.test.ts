/**
 * Tests for intent matching and resource scoring functionality
 */

import { IntentAnalyzer } from '../intentAnalyzer';
import { ResourceScoring } from '../resourceScoring';
import { MCPResource, UserIntent, EnhancedMCPProviderParams } from '../../types/mcp';

describe('Intent Matching System', () => {
  let intentAnalyzer: IntentAnalyzer;
  let resourceScoring: ResourceScoring;

  beforeEach(() => {
    intentAnalyzer = new IntentAnalyzer();
    resourceScoring = new ResourceScoring();
  });

  describe('IntentAnalyzer', () => {
    it('should detect coding intent for code-related queries', async () => {
      const query = "How to create a smart contract function for token transfer?";
      const intent = await intentAnalyzer.analyzeIntent(query);

      expect(intent.type).toBe('coding');
      expect(intent.confidence).toBeGreaterThan(0.5);
      expect(intent.domains).toContain('solidity');
      expect(intent.keywords).toContain('smart');
      expect(intent.keywords).toContain('contract');
      expect(intent.keywords).toContain('function');
    });

    it('should detect documentation intent for explanation queries', async () => {
      const query = "What is a smart contract and how does it work?";
      const intent = await intentAnalyzer.analyzeIntent(query);

      expect(intent.type).toBe('documentation');
      expect(intent.confidence).toBeGreaterThan(0.5);
      expect(intent.domains).toContain('solidity');
    });

    it('should detect debugging intent for error-related queries', async () => {
      const query = "My contract deployment is failing with gas estimation error";
      const intent = await intentAnalyzer.analyzeIntent(query);

      expect(intent.type).toBe('debugging');
      expect(intent.confidence).toBeGreaterThan(0.5);
    });

    it('should determine query complexity correctly', async () => {
      const simpleQuery = "What is a variable?";
      const complexQuery = "How to implement a complex multi-signature wallet with upgradeable proxy pattern and gas optimization for enterprise production deployment?";

      const simpleIntent = await intentAnalyzer.analyzeIntent(simpleQuery);
      const complexIntent = await intentAnalyzer.analyzeIntent(complexQuery);

      expect(simpleIntent.complexity).toBe('low');
      expect(complexIntent.complexity).toBe('high');
    });

    it('should expand queries with synonyms', () => {
      const query = "Create a function";
      const expandedQueries = intentAnalyzer.expandQuery(query, 5);

      expect(expandedQueries.length).toBeGreaterThan(1);
      expect(expandedQueries).toContain(query);
      // Should include synonyms for 'create' and 'function'
      expect(expandedQueries.some(q => q.includes('make') || q.includes('method'))).toBe(true);
    });
  });

  describe('ResourceScoring', () => {
    const mockResources: Array<{ resource: MCPResource; serverName: string }> = [
      {
        resource: {
          uri: 'file://docs/smart-contracts.md',
          name: 'Smart Contract Documentation',
          description: 'Complete guide to Solidity smart contract development',
          mimeType: 'text/markdown',
          annotations: { priority: 8 }
        },
        serverName: 'docs-server'
      },
      {
        resource: {
          uri: 'file://examples/token.sol',
          name: 'ERC20 Token Example',
          description: 'Example implementation of ERC20 token contract',
          mimeType: 'text/solidity',
          annotations: { priority: 6 }
        },
        serverName: 'examples-server'
      },
      {
        resource: {
          uri: 'file://api/web3.md',
          name: 'Web3 API Reference',
          description: 'Web3.js API documentation and usage examples',
          mimeType: 'text/markdown',
          annotations: { priority: 4 }
        },
        serverName: 'api-server'
      }
    ];

    it('should score resources based on intent relevance', async () => {
      const intent: UserIntent = {
        type: 'coding',
        confidence: 0.9,
        keywords: ['smart', 'contract', 'solidity', 'token'],
        domains: ['solidity'],
        complexity: 'medium',
        originalQuery: 'How to create a Solidity smart contract for token management?'
      };

      const params: EnhancedMCPProviderParams = {
        relevanceThreshold: 0.1
      };

      const scoredResources = await resourceScoring.scoreResources(mockResources, intent, params);

      expect(scoredResources).toHaveLength(3);
      expect(scoredResources[0].score).toBeGreaterThan(scoredResources[1].score);

      // Smart contract documentation should score highest for this query
      expect(scoredResources[0].resource.name).toBe('Smart Contract Documentation');
    });

    it('should filter resources by relevance threshold', async () => {
      const intent: UserIntent = {
        type: 'documentation',
        confidence: 0.8,
        keywords: ['api', 'reference'],
        domains: ['javascript'],
        complexity: 'low',
        originalQuery: 'API reference documentation'
      };

      const params: EnhancedMCPProviderParams = {
        relevanceThreshold: 0.5 // High threshold
      };

      const scoredResources = await resourceScoring.scoreResources(mockResources, intent, params);

      // Only highly relevant resources should pass the threshold
      expect(scoredResources.length).toBeLessThanOrEqual(2);
    });

    it('should select resources using hybrid strategy', async () => {
      const intent: UserIntent = {
        type: 'coding',
        confidence: 0.9,
        keywords: ['smart', 'contract'],
        domains: ['solidity'],
        complexity: 'medium',
        originalQuery: 'Smart contract development'
      };

      const params: EnhancedMCPProviderParams = {};
      const scoredResources = await resourceScoring.scoreResources(mockResources, intent, params);

      const selectedResources = resourceScoring.selectResources(scoredResources, 2, 'hybrid');

      expect(selectedResources).toHaveLength(2);
      // Should prefer diversity - different servers
      const serverNames = selectedResources.map(r => r.serverName);
      expect(new Set(serverNames).size).toBeGreaterThan(1);
    });

    it('should provide reasoning for resource selection', async () => {
      const intent: UserIntent = {
        type: 'coding',
        confidence: 0.9,
        keywords: ['token', 'erc20'],
        domains: ['solidity'],
        complexity: 'medium',
        originalQuery: 'ERC20 token implementation'
      };

      const params: EnhancedMCPProviderParams = {};
      const scoredResources = await resourceScoring.scoreResources(mockResources, intent, params);

      expect(scoredResources[0].reasoning).toBeTruthy();
      expect(typeof scoredResources[0].reasoning).toBe('string');
      expect(scoredResources[0].reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('Integration', () => {
    it('should work together to analyze intent and score resources', async () => {
      const query = "I need to create a secure ERC20 token with minting functionality";
      
      const intent = await intentAnalyzer.analyzeIntent(query);
      expect(intent.type).toBe('coding');
      expect(intent.domains).toContain('solidity');

      const mockResources: Array<{ resource: MCPResource; serverName: string }> = [
        {
          resource: {
            uri: 'file://examples/secure-token.sol',
            name: 'Secure ERC20 Token',
            description: 'Secure ERC20 token implementation with minting and access control',
            mimeType: 'text/solidity',
            annotations: { priority: 9 }
          },
          serverName: 'security-examples'
        }
      ];

      const scoredResources = await resourceScoring.scoreResources(mockResources, intent, {});
      
      expect(scoredResources).toHaveLength(1);
      expect(scoredResources[0].score).toBeGreaterThan(0.5);
      expect(scoredResources[0].resource.name).toBe('Secure ERC20 Token');
    });
  });
});