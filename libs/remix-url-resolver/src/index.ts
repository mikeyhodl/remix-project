export { RemixURLResolver } from './resolve'
export { githubFolderResolver } from './github-folder-resolver'

type EndpointUrls = {
    ipfsGateway: string;
    ghfolderpull: string;
};

const defaultUrls: EndpointUrls = {
  ipfsGateway: 'https://api.remix.live/endpoints/jqgt',
  ghfolderpull: 'https://api.remix.live/endpoints/ghfolderpull',
};

const endpointPathMap: Record<keyof EndpointUrls, string> = {
  ipfsGateway: 'jqgt',
  ghfolderpull: 'ghfolderpull',
};

const prefix = null;

console.error('@remix-url-resolver DEFAULT: ', JSON.stringify(defaultUrls))

const resolvedUrls: EndpointUrls = prefix
  ? Object.fromEntries(
    Object.entries(defaultUrls).map(([key, _]) => [
      key,
      `${prefix}/${endpointPathMap[key as keyof EndpointUrls]}`,
    ])
  ) as EndpointUrls
  : defaultUrls;

  console.error('@remix-url-resolver RESOLVED: ', JSON.stringify(resolvedUrls))
export const endpointUrls = resolvedUrls;
