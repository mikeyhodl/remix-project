/**
 * Compilation Resource Provider - Provides access to compilation results and artifacts
 */

import { ICustomRemixApi } from '@remix-api';
import { MCPResource, MCPResourceContent } from '../../types/mcp';
import { BaseResourceProvider } from '../registry/RemixResourceProviderRegistry';
import { ResourceCategory } from '../types/mcpResources';

export class CompilationResourceProvider extends BaseResourceProvider {
  name = 'compilation';
  description = 'Provides access to compilation results, artifacts, and contract metadata';

  async getResources(remixApi: ICustomRemixApi): Promise<MCPResource[]> {
    const resources: MCPResource[] = [];

    try {
      // Add compilation results
      resources.push(
        this.createResource(
          'compilation://latest',
          'Latest Compilation Result',
          'Most recent compilation output with contracts and errors',
          'application/json',
          { 
            category: ResourceCategory.COMPILATION,
            tags: ['compilation', 'latest', 'results'],
            priority: 9
          }
        )
      );

      resources.push(
        this.createResource(
          'compilation://contracts',
          'Compiled Contracts',
          'All successfully compiled contracts with metadata',
          'application/json',
          {
            category: ResourceCategory.COMPILATION,
            tags: ['contracts', 'abi', 'bytecode'],
            priority: 8
          }
        )
      );

      resources.push(
        this.createResource(
          'compilation://errors',
          'Compilation Errors',
          'Latest compilation errors and warnings',
          'application/json',
          {
            category: ResourceCategory.COMPILATION,
            tags: ['errors', 'warnings', 'diagnostics'],
            priority: 7
          }
        )
      );

      resources.push(
        this.createResource(
          'compilation://artifacts',
          'Build Artifacts',
          'Compilation artifacts and build outputs',
          'application/json',
          {
            category: ResourceCategory.COMPILATION,
            tags: ['artifacts', 'build', 'output'],
            priority: 6
          }
        )
      );

      resources.push(
        this.createResource(
          'compilation://dependencies',
          'Compilation Dependencies',
          'Contract dependencies and import graph',
          'application/json',
          {
            category: ResourceCategory.COMPILATION,
            tags: ['dependencies', 'imports', 'graph'],
            priority: 5
          }
        )
      );

      resources.push(
        this.createResource(
          'compilation://config',
          'Compiler Configuration',
          'Current compiler settings and configuration',
          'application/json',
          {
            category: ResourceCategory.COMPILATION,
            tags: ['config', 'compiler', 'settings'],
            priority: 5
          }
        )
      );

      // Add individual contract resources if available
      await this.addContractResources(remixApi, resources);

    } catch (error) {
      console.warn('Failed to get compilation resources:', error);
    }

    return resources;
  }

  async getResourceContent(uri: string, remixApi: ICustomRemixApi): Promise<MCPResourceContent> {
    if (uri === 'compilation://latest') {
      return this.getLatestCompilationResult(remixApi);
    }

    if (uri === 'compilation://contracts') {
      return this.getCompiledContracts(remixApi);
    }

    if (uri === 'compilation://errors') {
      return this.getCompilationErrors(remixApi);
    }

    if (uri === 'compilation://artifacts') {
      return this.getBuildArtifacts(remixApi);
    }

    if (uri === 'compilation://dependencies') {
      return this.getCompilationDependencies(remixApi);
    }

    if (uri === 'compilation://config') {
      return this.getCompilerConfig(remixApi);
    }

    if (uri.startsWith('contract://')) {
      return this.getContractDetails(uri, remixApi);
    }

    throw new Error(`Unsupported compilation resource URI: ${uri}`);
  }

  canHandle(uri: string): boolean {
    return uri.startsWith('compilation://') || uri.startsWith('contract://');
  }

  private async addContractResources(remixApi: ICustomRemixApi, resources: MCPResource[]): Promise<void> {
    try {
      // TODO: Get actual compilation result from Remix API
      const mockContracts = ['MyToken', 'TokenSale', 'Ownable']; // Mock data
      
      for (const contractName of mockContracts) {
        resources.push(
          this.createResource(
            `contract://${contractName}`,
            `${contractName} Contract`,
            `Detailed information about ${contractName} contract`,
            'application/json',
            {
              category: ResourceCategory.COMPILATION,
              tags: ['contract', contractName.toLowerCase(), 'details'],
              contractName,
              priority: 4
            }
          )
        );
      }
    } catch (error) {
      console.warn('Failed to add contract resources:', error);
    }
  }

  private async getLatestCompilationResult(remixApi: ICustomRemixApi): Promise<MCPResourceContent> {
    try {
      // TODO: Get actual compilation result from Remix API
      const compilationResult = {
        status: 'success',
        timestamp: new Date().toISOString(),
        compiler: {
          version: '0.8.19',
          settings: {
            optimizer: {
              enabled: true,
              runs: 200
            },
            evmVersion: 'london'
          }
        },
        contracts: {
          'contracts/MyToken.sol:MyToken': {
            abi: [
              {
                inputs: [],
                name: 'totalSupply',
                outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
                stateMutability: 'view',
                type: 'function'
              }
            ],
            bytecode: '0x608060405234801561001057600080fd5b50...',
            deployedBytecode: '0x608060405234801561001057600080fd5b50...',
            metadata: {
              compiler: { version: '0.8.19+commit.7dd6d404' },
              language: 'Solidity',
              output: {
                abi: [],
                devdoc: { kind: 'dev', methods: {}, version: 1 },
                userdoc: { kind: 'user', methods: {}, version: 1 }
              }
            }
          }
        },
        sources: {
          'contracts/MyToken.sol': {
            id: 0,
            ast: {}
          }
        },
        errors: [],
        warnings: []
      };

      return this.createJsonContent('compilation://latest', compilationResult);
    } catch (error) {
      return this.createTextContent('compilation://latest', `Error getting compilation result: ${error.message}`);
    }
  }

  private async getCompiledContracts(remixApi: ICustomRemixApi): Promise<MCPResourceContent> {
    try {
      // TODO: Get contracts from actual compilation result
      const contracts = {
        'MyToken': {
          name: 'MyToken',
          sourcePath: 'contracts/MyToken.sol',
          abi: [
            {
              inputs: [],
              name: 'totalSupply',
              outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function'
            },
            {
              inputs: [
                { internalType: 'address', name: 'to', type: 'address' },
                { internalType: 'uint256', name: 'amount', type: 'uint256' }
              ],
              name: 'transfer',
              outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
              stateMutability: 'nonpayable',
              type: 'function'
            }
          ],
          bytecode: {
            object: '0x608060405234801561001057600080fd5b50...',
            linkReferences: {},
            sourceMap: '58:2470:0:-:0;;;;;;;;;;;;;;;;;;'
          },
          deployedBytecode: {
            object: '0x608060405234801561001057600080fd5b50...',
            linkReferences: {},
            sourceMap: '58:2470:0:-:0;;;;;;;;;;;;;;;;;;'
          },
          gasEstimates: {
            creation: {
              codeDepositCost: '648600',
              executionCost: '674',
              totalCost: '649274'
            },
            external: {
              'totalSupply()': '2407',
              'transfer(address,uint256)': '46509'
            }
          },
          metadata: {
            compiler: { version: '0.8.19+commit.7dd6d404' },
            language: 'Solidity',
            settings: {
              optimizer: { enabled: true, runs: 200 },
              evmVersion: 'london'
            }
          }
        }
      };

      return this.createJsonContent('compilation://contracts', {
        contracts,
        count: Object.keys(contracts).length,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      return this.createTextContent('compilation://contracts', `Error getting contracts: ${error.message}`);
    }
  }

  private async getCompilationErrors(remixApi: ICustomRemixApi): Promise<MCPResourceContent> {
    try {
      // TODO: Get actual compilation errors
      const errors = {
        errors: [
          {
            severity: 'error',
            type: 'TypeError',
            component: 'general',
            errorCode: '2314',
            message: 'Wrong argument count for function call: expected 2, provided 1.',
            sourceLocation: {
              file: 'contracts/MyToken.sol',
              start: 442,
              end: 461
            },
            secondarySourceLocations: []
          }
        ],
        warnings: [
          {
            severity: 'warning',
            type: 'Warning',
            component: 'general',
            errorCode: '2018',
            message: 'Function state mutability can be restricted to pure',
            sourceLocation: {
              file: 'contracts/MyToken.sol',
              start: 234,
              end: 298
            }
          }
        ],
        summary: {
          errorCount: 1,
          warningCount: 1,
          lastCompilation: new Date().toISOString()
        }
      };

      return this.createJsonContent('compilation://errors', errors);
    } catch (error) {
      return this.createTextContent('compilation://errors', `Error getting compilation errors: ${error.message}`);
    }
  }

  private async getBuildArtifacts(remixApi: ICustomRemixApi): Promise<MCPResourceContent> {
    try {
      const artifacts = {
        buildInfo: {
          compiler: '0.8.19+commit.7dd6d404',
          compilationTarget: {
            'contracts/MyToken.sol': 'MyToken'
          },
          settings: {
            optimizer: { enabled: true, runs: 200 },
            evmVersion: 'london',
            libraries: {}
          },
          sources: ['contracts/MyToken.sol'],
          version: 1
        },
        artifacts: [
          {
            name: 'MyToken',
            file: 'contracts/MyToken.sol',
            size: {
              bytecode: 1234,
              deployedBytecode: 890
            },
            created: new Date().toISOString()
          }
        ],
        cache: {
          lastUpdate: new Date().toISOString(),
          files: ['contracts/MyToken.sol'],
          checksums: {
            'contracts/MyToken.sol': 'abc123def456'
          }
        }
      };

      return this.createJsonContent('compilation://artifacts', artifacts);
    } catch (error) {
      return this.createTextContent('compilation://artifacts', `Error getting build artifacts: ${error.message}`);
    }
  }

  private async getCompilationDependencies(remixApi: ICustomRemixApi): Promise<MCPResourceContent> {
    try {
      const dependencies = {
        imports: {
          'contracts/MyToken.sol': [
            '@openzeppelin/contracts/token/ERC20/ERC20.sol',
            '@openzeppelin/contracts/access/Ownable.sol'
          ]
        },
        dependencyGraph: {
          'contracts/MyToken.sol': {
            dependencies: ['@openzeppelin/contracts/token/ERC20/ERC20.sol'],
            dependents: []
          }
        },
        external: {
          '@openzeppelin/contracts': {
            version: '^4.8.0',
            resolved: true,
            files: [
              'token/ERC20/ERC20.sol',
              'access/Ownable.sol'
            ]
          }
        },
        analysis: {
          totalFiles: 3,
          externalDependencies: 1,
          circularDependencies: [],
          unusedImports: []
        }
      };

      return this.createJsonContent('compilation://dependencies', dependencies);
    } catch (error) {
      return this.createTextContent('compilation://dependencies', `Error getting dependencies: ${error.message}`);
    }
  }

  private async getCompilerConfig(remixApi: ICustomRemixApi): Promise<MCPResourceContent> {
    try {
      // Get compiler config from Remix API
      const configString = await remixApi.config.getAppParameter('solidity-compiler');
      let config: any;
      
      if (configString) {
        config = JSON.parse(configString);
      } else {
        config = {
          version: 'latest',
          optimize: true,
          runs: 200,
          evmVersion: 'london',
          language: 'Solidity'
        };
      }

      const fullConfig = {
        current: config,
        available: {
          versions: ['0.8.19', '0.8.18', '0.8.17', '0.8.16'],
          evmVersions: ['london', 'berlin', 'istanbul', 'petersburg'],
          languages: ['Solidity', 'Yul']
        },
        recommendations: {
          version: '0.8.19',
          evmVersion: 'london',
          optimizer: {
            enabled: true,
            runs: 200
          }
        },
        lastUpdated: new Date().toISOString()
      };

      return this.createJsonContent('compilation://config', fullConfig);
    } catch (error) {
      return this.createTextContent('compilation://config', `Error getting compiler config: ${error.message}`);
    }
  }

  private async getContractDetails(uri: string, remixApi: ICustomRemixApi): Promise<MCPResourceContent> {
    const contractName = uri.replace('contract://', '');
    
    try {
      // TODO: Get actual contract details from compilation result
      const contractDetails = {
        name: contractName,
        source: {
          file: `contracts/${contractName}.sol`,
          content: '// Contract source would be here...'
        },
        compilation: {
          compiler: '0.8.19',
          settings: { optimizer: { enabled: true, runs: 200 } }
        },
        abi: [
          {
            inputs: [],
            name: 'totalSupply',
            outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function'
          }
        ],
        bytecode: {
          object: '0x608060405234801561001057600080fd5b50...',
          sourceMap: '58:2470:0:-:0;;;;;;;;;;;;;;;;;;',
          linkReferences: {}
        },
        deployedBytecode: {
          object: '0x608060405234801561001057600080fd5b50...',
          sourceMap: '58:2470:0:-:0;;;;;;;;;;;;;;;;;;',
          linkReferences: {}
        },
        gasEstimates: {
          creation: { codeDepositCost: '648600', executionCost: '674' },
          external: { 'totalSupply()': '2407' }
        },
        analysis: {
          securityIssues: [],
          optimizationSuggestions: [],
          gasOptimizations: []
        },
        metadata: {
          compiler: { version: '0.8.19+commit.7dd6d404' },
          language: 'Solidity',
          createdAt: new Date().toISOString()
        }
      };

      return this.createJsonContent(uri, contractDetails);
    } catch (error) {
      return this.createTextContent(uri, `Error getting contract details: ${error.message}`);
    }
  }
}