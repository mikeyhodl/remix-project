import { endpointUrls } from '@remix-endpoints-helper';

const safeScriptJson = (value: any): string => JSON.stringify(value).replace(/<\//g, '<\\/');

export const getQuickDappGraphSources = (activeDapp: any): any[] => {
  const sources = activeDapp?.dataSources?.theGraph;
  return Array.isArray(sources) ? sources : [];
};

export const hasTheGraphGatewaySources = (activeDapp: any): boolean =>
  getQuickDappGraphSources(activeDapp).some(source => source?.endpointKind === 'thegraph-gateway' || source?.endpointNeedsApiKey === true);

const getGraphSourceId = (source: any): string =>
  source?.filePath || source?.subgraphId || source?.operationName || 'thegraph-source';

const needsGatewayKey = (source: any): boolean =>
  source?.endpointKind === 'thegraph-gateway' || source?.endpointNeedsApiKey === true;

const getQuickdappGraphEndpoint = (): string => {
  const baseUrl = process.env.NX_ENDPOINTS_URL;
  return baseUrl ? `${baseUrl.replace(/\/$/, '')}/quickdapp-graph` : endpointUrls.quickdappGraph;
};

const getRemixAccessToken = (): string => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('remix_access_token') || '' : '';
  } catch {
    return '';
  }
};

const getTheGraphApiKey = async (plugin: any): Promise<string> => {
  try {
    return await plugin.call('config', 'getAppParameter', 'settings/thegraph-access-token') || '';
  } catch {
    return '';
  }
};

const createProxyToken = async (source: any, apiKey: string): Promise<string> => {
  if (!source?.subgraphId) throw new Error('The Graph subgraph ID is required to deploy this DApp.');
  if (!source?.query) throw new Error('The Graph query is required to deploy this DApp.');

  const authToken = getRemixAccessToken();
  const response = await fetch(`${getQuickdappGraphEndpoint()}/seal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    body: JSON.stringify({
      subgraphId: source.subgraphId,
      apiKey,
      query: source.query,
      operationName: source.operationName,
      defaultVariables: source.variables || {}
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Could not prepare The Graph proxy token: ${errorText}`);
  }

  const data = await response.json();
  if (!data?.token) throw new Error('Could not prepare The Graph proxy token.');
  return data.token;
};

export const buildGraphRuntimeConfigScript = async (
  plugin: any,
  activeDapp: any,
  options: { includeApiKey: boolean; target: 'preview' | 'ipfs-deploy' | 'base-ipfs-deploy' }
): Promise<string> => {
  const graphSources = getQuickDappGraphSources(activeDapp);
  if (graphSources.length === 0) return '';

  const gatewaySources = graphSources.filter(needsGatewayKey);
  const needsApiKey = gatewaySources.length > 0;
  let apiKey = needsApiKey ? await getTheGraphApiKey(plugin) : '';
  const proxyTokens: Record<string, string> = {};

  if (needsApiKey && !options.includeApiKey) {
    if (!apiKey) {
      throw new Error('Add The Graph API key in Remix settings before deploying this DApp.');
    }

    await Promise.all(gatewaySources.map(async source => {
      proxyTokens[getGraphSourceId(source)] = await createProxyToken(source, apiKey);
    }));
    apiKey = '';
  }

  const runtimeConfig: any = {
    ...(apiKey ? { apiKey } : {}),
    ...(needsApiKey && !options.includeApiKey ? { proxyEndpoint: `${getQuickdappGraphEndpoint()}/query` } : {}),
    sources: graphSources.map(source => ({
      id: getGraphSourceId(source),
      filePath: source?.filePath,
      endpointKind: source?.endpointKind,
      endpointNeedsApiKey: source?.endpointNeedsApiKey === true,
      apiKeySource: options.includeApiKey ? source?.apiKeySource : 'none',
      subgraphId: source?.subgraphId,
      operationName: source?.operationName,
      proxyToken: proxyTokens[getGraphSourceId(source)]
    }))
  };

  return `<script>window.__QUICK_DAPP_GRAPH_CONFIG__=${safeScriptJson(runtimeConfig)};</script>`;
};
