const safeScriptJson = (value: any): string => JSON.stringify(value).replace(/<\//g, '<\\/');

export const getQuickDappGraphSources = (activeDapp: any): any[] => {
  const sources = activeDapp?.dataSources?.theGraph;
  return Array.isArray(sources) ? sources : [];
};

export const hasTheGraphGatewaySources = (activeDapp: any): boolean =>
  getQuickDappGraphSources(activeDapp).some(source => source?.endpointKind === 'thegraph-gateway' || source?.endpointNeedsApiKey === true);

export const buildGraphRuntimeConfigScript = async (
  plugin: any,
  activeDapp: any,
  options: { includeApiKey: boolean; target: 'preview' | 'ipfs-deploy' | 'base-ipfs-deploy' }
): Promise<string> => {
  const graphSources = getQuickDappGraphSources(activeDapp);
  if (graphSources.length === 0) return '';

  const needsApiKey = graphSources.some(source => source?.endpointNeedsApiKey === true);
  let apiKey = '';

  if (needsApiKey && options.includeApiKey) {
    try {
      apiKey = await plugin.call('config', 'getAppParameter', 'settings/thegraph-access-token') || '';
    } catch {
      // Preview can still render; generated DApps provide a runtime key fallback.
    }
  }

  const runtimeConfig = {
    apiKey,
    sources: graphSources.map(source => ({
      id: source?.filePath || source?.subgraphId || source?.operationName || 'thegraph-source',
      filePath: source?.filePath,
      endpointKind: source?.endpointKind,
      endpointNeedsApiKey: source?.endpointNeedsApiKey === true,
      apiKeySource: options.includeApiKey ? source?.apiKeySource : 'runtime-input',
      subgraphId: source?.subgraphId,
      operationName: source?.operationName
    }))
  };

  return `<script>window.__QUICK_DAPP_GRAPH_CONFIG__=${safeScriptJson(runtimeConfig)};</script>`;
};
