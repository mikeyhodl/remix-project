import { endpointUrls } from '@remix-endpoints-helper';

const safeScriptJson = (value: any): string => JSON.stringify(value).replace(/<\//g, '<\\/');

export const getZkCircuitConfig = (activeDapp: any): any | null => {
  return activeDapp?.zkCircuit || null;
};

export const hasZkCircuit = (activeDapp: any): boolean => {
  const zkCircuit = getZkCircuitConfig(activeDapp);
  return !!zkCircuit && zkCircuit.provingScheme === 'groth16';
};

const getZkVerifyEndpoint = (): string => {
  return endpointUrls.zkverify;
};

const getRemixAccessToken = (): string => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('remix_access_token') || '' : '';
  } catch {
    return '';
  }
};

const getZkVerifyApiKey = async (plugin: any): Promise<string> => {
  try {
    return await plugin.call('config', 'getAppParameter', 'settings/zkverify-api-key') || '';
  } catch {
    return '';
  }
};

const getZkVerifyNetwork = async (plugin: any): Promise<'testnet' | 'mainnet'> => {
  try {
    const network = await plugin.call('config', 'getAppParameter', 'settings/zkverify-network');
    return network === 'mainnet' ? 'mainnet' : 'testnet';
  } catch {
    return 'testnet';
  }
};

/**
 * Create a sealed proxy token for zkVerify verification.
 * This allows deployed DApps to verify proofs without exposing API keys.
 */
const createZkVerifyProxyToken = async (
  apiKey: string,
  network: 'testnet' | 'mainnet'
): Promise<string> => {
  if (!apiKey) throw new Error('zkVerify API key is required to deploy this ZK DApp.');

  const authToken = getRemixAccessToken();
  const zkverifyEndpoint = getZkVerifyEndpoint();

  const response = await fetch(`${zkverifyEndpoint}/seal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    body: JSON.stringify({
      apiKey,
      network
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Could not prepare zkVerify proxy token: ${errorText}`);
  }

  const data = await response.json();
  if (!data?.token) throw new Error('Could not prepare zkVerify proxy token.');
  return data.token;
};

export interface ZkRuntimeConfig {
  circuitName: string;
  provingScheme: 'groth16';
  primeValue: 'bn128' | 'bls12381';
  signalInputs: string[];
  zkArtifacts: {
    wasmPath: string;
    zkeyPath: string;
    vkeyPath: string;
  };
  zkVerify: {
    network: 'testnet' | 'mainnet';
    apiKey?: string;
    proxyEndpoint?: string;
    proxyToken?: string;
  };
}

/**
 * Build the ZK DApp runtime configuration script.
 * Injected into the HTML as window.__ZK_DAPP_CONFIG__
 */
export const buildZkRuntimeConfigScript = async (
  plugin: any,
  activeDapp: any,
  options: { includeApiKey: boolean; target: 'preview' | 'ipfs-deploy' }
): Promise<string> => {
  const zkCircuit = getZkCircuitConfig(activeDapp);
  if (!zkCircuit) return '';

  const network = zkCircuit.zkVerifyConfig?.network || await getZkVerifyNetwork(plugin);
  let apiKey = await getZkVerifyApiKey(plugin);
  let proxyToken: string | undefined;
  let proxyEndpoint: string | undefined;

  // For deployment, create a sealed proxy token instead of exposing the API key
  const zkverifyEndpoint = getZkVerifyEndpoint();

  if (!options.includeApiKey && apiKey) {
    try {
      proxyToken = await createZkVerifyProxyToken(apiKey, network);
      proxyEndpoint = `${zkverifyEndpoint}/submit-proof`;
      apiKey = ''; // Clear API key for deployed version
    } catch (error: any) {
      // Continue without proxy token - DApp will need manual API key
    }
  }

  // For IPFS deployment, use root-level paths since IPFS endpoint doesn't support subdirectories
  // For preview, use the paths from the config (which include zk/ or frontend/zk/ prefix)
  const useRootPaths = options.target === 'ipfs-deploy';

  const runtimeConfig: ZkRuntimeConfig = {
    circuitName: zkCircuit.circuitName,
    provingScheme: zkCircuit.provingScheme,
    primeValue: zkCircuit.primeValue,
    signalInputs: zkCircuit.signalInputs || [],
    zkArtifacts: useRootPaths
      ? {
        wasmPath: 'circuit.wasm',
        zkeyPath: 'circuit.zkey',
        vkeyPath: 'verification_key.json'
      }
      : {
        wasmPath: zkCircuit.zkArtifacts?.wasmPath || 'zk/circuit.wasm',
        zkeyPath: zkCircuit.zkArtifacts?.zkeyPath || 'zk/circuit.zkey',
        vkeyPath: zkCircuit.zkArtifacts?.vkeyPath || 'zk/verification_key.json'
      },
    zkVerify: {
      network,
      ...(options.includeApiKey && apiKey ? { apiKey } : {}),
      ...(proxyEndpoint ? { proxyEndpoint } : {}),
      ...(proxyToken ? { proxyToken } : {})
    }
  };

  return `<script>window.__ZK_DAPP_CONFIG__=${safeScriptJson(runtimeConfig)};</script>`;
};

/**
 * Get zkVerify-related sources from a DApp config for display purposes.
 */
export const getZkDappSummary = (activeDapp: any): {
  hasZkCircuit: boolean;
  circuitName?: string;
  provingScheme?: string;
  signalCount?: number;
} => {
  const zkCircuit = getZkCircuitConfig(activeDapp);
  if (!zkCircuit) {
    return { hasZkCircuit: false };
  }

  return {
    hasZkCircuit: true,
    circuitName: zkCircuit.circuitName,
    provingScheme: zkCircuit.provingScheme,
    signalCount: zkCircuit.signalInputs?.length || 0
  };
};
