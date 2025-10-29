// Translate supported import schemes into concrete HTTP(S) URLs for fetching.
// - http(s) passthrough
// - npm ("@scope/pkg@ver/path" or "pkg/path") → https://cdn.jsdelivr.net/npm/<path> (overridable)
// - ipfs://<hash>/<path> → https://ipfs.io/ipfs/<hash>/<path> (overridable)
// - bzz://... or bzz-raw://... → https://swarm-gateways.net/bzz(-raw):/<...> (overridable)

type RuntimeConfig = { npmURL?: string; ipfsGateway?: string; swarmGateway?: string }

function getRuntimeConfig(): RuntimeConfig | undefined {
  try {
    // Prefer browser window; fallback to globalThis.window if present in tests
    const w: any = (typeof window !== 'undefined' ? (window as any) : (globalThis as any)?.window)
    const cfg = w?.__REMIX_COMPILER_URLS__ || w?.REMIX_COMPILER_URLS
    if (cfg && typeof cfg === 'object') return cfg as RuntimeConfig
  } catch {}
  return undefined
}

function isHttp(url: string) {
  return url.startsWith('http://') || url.startsWith('https://')
}

function toNpmCdn(url: string) {
  // Map bare npm path like "@scope/pkg@1.2.3/file" or "@scope/pkg/file" to CDN
  const runtime = getRuntimeConfig()
  const base = (runtime?.npmURL ? runtime.npmURL.replace(/\/+$/, '') : 'https://cdn.jsdelivr.net/npm')
  return `${base}/${url}`
}

function toIpfsGateway(url: string) {
  // ipfs://[ipfs/]<hash>/<path?> → https://ipfs.io/ipfs/<hash>/<path?>
  const m = url.match(/^ipfs:\/\/(?:ipfs\/)?([^/]+)(?:\/(.*))?$/)
  if (!m) return url
  const hash = m[1]
  const path = m[2] ? `/${m[2]}` : ''
  const runtime = getRuntimeConfig()
  const base = (runtime?.ipfsGateway ? runtime.ipfsGateway.replace(/\/+$/, '') : 'https://ipfs.io/ipfs')
  return `${base}/${hash}${path}`
}

function toSwarmGateway(url: string) {
  // bzz://<hash>/<path?> or bzz-raw://<hash>/<path?> → swarm gateways
  const raw = url.startsWith('bzz-raw://')
  const clean = url.replace(/^bzz-raw:\/\//, '').replace(/^bzz:\/\//, '')
  const prefix = raw ? 'bzz-raw:/' : 'bzz:/'
  const runtime = getRuntimeConfig()
  const base = (runtime?.swarmGateway ? runtime.swarmGateway.replace(/\/+$/, '') : 'https://swarm-gateways.net')
  return `${base}/${prefix}${clean}`
}

export function toHttpUrl(url: string): string {
  if (isHttp(url)) return url
  if (url.startsWith('ipfs://')) return toIpfsGateway(url)
  if (url.startsWith('bzz://') || url.startsWith('bzz-raw://')) return toSwarmGateway(url)
  // Fallback: treat as npm path
  return toNpmCdn(url)
}
