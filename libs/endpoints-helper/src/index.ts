type EndpointUrls = {
    corsProxy: string;
    mcpCorsProxy: string;
    solidityScan: string;
    ipfsGateway: string;
    commonCorsProxy: string;
    github: string;
    solcoder: string;
    completion: string;
    ghfolderpull: string;
    embedly: string;
    gptChat: string;
    rag: string;
    vyper2: string;
    solidityScanWebSocket: string;
    gitHubLoginProxy: string;
    sso: string;
    ssoPlugin: string;
    billing: string;
    credits: string;
    audio;
};

const defaultUrls: EndpointUrls = {
  corsProxy: 'https://gitproxy.api.remix.live',
  mcpCorsProxy: "https://mcp.api.remix.live",
  solidityScan: 'https://solidityscan.api.remix.live',
  ipfsGateway: 'https://jqgt.api.remix.live',
  commonCorsProxy: 'https://common-corsproxy.api.remix.live',
  github: 'https://github.api.remix.live',
  solcoder: 'https://solcoder.api.remix.live',
  ghfolderpull: 'https://ghfolderpull.api.remix.live',
  embedly: 'https://embedly.api.remix.live',
  gptChat: 'https://gpt-chat.api.remix.live',
  rag: 'https://rag.api.remix.live',
  vyper2: 'https://vyper2.api.remix.live',
  completion: 'https://completion.api.remix.live',
  solidityScanWebSocket: 'wss://solidityscan.api.remix.live',
  gitHubLoginProxy: 'https://github-login-proxy.api.remix.live',
  sso: 'https://sso.api.remix.live',
  ssoPlugin: 'https://sso-plugin.api.remix.live',
  billing: 'https://billing.api.remix.live',
  credits: 'https://credits.api.remix.live',
  audio: 'https://audio.api.remix.live',
};

const endpointPathMap: Record<keyof EndpointUrls, string> = {
  corsProxy: 'corsproxy',
  mcpCorsProxy: 'mcp',
  solidityScan: 'solidityscan',
  ipfsGateway: 'jqgt',
  commonCorsProxy: 'common-corsproxy',
  github: 'github',
  solcoder: 'solcoder',
  completion: 'completion',
  ghfolderpull: 'ghfolderpull',
  embedly: 'embedly',
  gptChat: 'gpt-chat',
  rag: 'rag',
  vyper2: 'vyper2',
  solidityScanWebSocket: '',
  gitHubLoginProxy: 'github-login-proxy',
  sso: 'sso',
  ssoPlugin: 'sso-plugin',
  billing: 'billing',
  credits: 'credits',
  audio: 'audio',
};

const prefix = process.env.NX_ENDPOINTS_URL;

// Ngrok development URLs - Single domain with path routing (same as production)
const ngrokUrls: EndpointUrls = {
  corsProxy: 'https://api-remix-dev.ngrok.dev/corsproxy',
  mcpCorsProxy: 'https://api-remix-dev.ngrok.dev/mcp',
  solidityScan: 'https://api-remix-dev.ngrok.dev/solidityscan',
  ipfsGateway: 'https://api-remix-dev.ngrok.dev/jqgt',
  commonCorsProxy: 'https://api-remix-dev.ngrok.dev/common-corsproxy',
  github: 'https://api-remix-dev.ngrok.dev/github',
  solcoder: 'https://api-remix-dev.ngrok.dev/solcoder',
  ghfolderpull: 'https://api-remix-dev.ngrok.dev/ghfolderpull',
  embedly: 'https://api-remix-dev.ngrok.dev/embedly',
  gptChat: 'https://api-remix-dev.ngrok.dev/gpt-chat',
  rag: 'https://api-remix-dev.ngrok.dev/rag',
  vyper2: 'https://api-remix-dev.ngrok.dev/vyper2',
  completion: 'https://api-remix-dev.ngrok.dev/completion',
  solidityScanWebSocket: 'wss://api-remix-dev.ngrok.dev/solidityscan',
  gitHubLoginProxy: 'https://api-remix-dev.ngrok.dev/github-login-proxy',
  sso: 'https://api-remix-dev.ngrok.dev/sso',
  ssoPlugin: 'https://api-remix-dev.ngrok.dev/sso-plugin',
  billing: 'https://api-remix-dev.ngrok.dev/billing',
  credits: 'https://api-remix-dev.ngrok.dev/credits',
  audio: ''
};

// Microservices development URLs (individual service ports)
const localhostUrls: EndpointUrls = {
  // PROXY service (port 3005)
  corsProxy: 'http://localhost:3005/corsproxy',
  mcpCorsProxy: 'http://localhost:3005/mcp',
  commonCorsProxy: 'http://localhost:3005/common-corsproxy',
  github: 'http://localhost:3005/github',
  ghfolderpull: 'http://localhost:3005/ghfolderpull',
  gitHubLoginProxy: 'http://localhost:3005/github-login-proxy',
  
  // UTILITIES service (port 3007)
  solidityScan: 'http://localhost:3007/solidityscan',
  solidityScanWebSocket: 'ws://localhost:3007/solidityscan',
  
  // PLUGINS service (port 3006)
  ipfsGateway: 'http://localhost:3006/jqgt',
  embedly: 'http://localhost:3006/embedly',
  vyper2: 'http://localhost:3006/vyper2',
  
  // AI service (port 3003)
  solcoder: 'http://localhost:3003/solcoder',
  completion: 'http://localhost:3003/completion',
  gptChat: 'http://localhost:3003/gpt-chat',
  rag: 'http://localhost:3003/rag',
  
  // AUTH service (port 3001)
  sso: 'http://localhost:3001/sso',
  ssoPlugin: 'http://localhost:3001/sso-plugin',
  
  // BILLING service (port 3002)
  billing: 'http://localhost:3002/billing',
  credits: 'http://localhost:3002/credits',
  audio: 'http://localhost:3004/audio',
};

const resolvedUrls: EndpointUrls = prefix
  ? (prefix.includes('localhost')
      ? localhostUrls  // Use direct service ports for localhost
      : Object.fromEntries(  // Use prefix paths for production/ngrok
          Object.entries(defaultUrls).map(([key, _]) => [
            key,
            `${prefix}/${endpointPathMap[key as keyof EndpointUrls]}`,
          ])
        ) as EndpointUrls)
  : defaultUrls;

resolvedUrls.solidityScanWebSocket = resolvedUrls.solidityScan.replace(
  'http://',
  'ws://'
);

export const endpointUrls = resolvedUrls;
