/*
  Matomo tracking loader
  Goals:
  - Support 2 user modes: 'cookie' (full) and 'anon' (no cookies). Tracking is always active.
    - Persist preference in existing config localStorage blob
    - Respect & apply consent before tracking
    - Expose tracking mode to Matomo via a custom dimension (configure in Matomo UI)
    - Maintain backward compatibility with legacy boolean 'settings/matomo-analytics'

  Custom Dimension Setup (Matomo):
    Create a Visit-scope custom dimension named e.g. `tracking_mode` and set its ID below.
    Values sent: 'cookie' | 'anon'. (No events sent for 'none').
*/

// Matomo custom dimension IDs (Visit scope)
// 1: Tracking Mode (cookie|anon)
const MATOMO_TRACKING_MODE_DIMENSION_ID = 1;
const TRACKING_CONFIG_KEY = 'config-v0.8:.remix.config';
// Legacy keys retained for backward compatibility but no longer authoritative.
const LEGACY_BOOL_KEY = 'settings/matomo-analytics';
const MODE_KEY = 'settings/matomo-analytics-mode'; // deprecated explicit mode storage (now derived from perf flag)

// Single source of truth for Matomo site ids (on-prem tracking only).
// Exposed globally so application code (e.g. app.ts) can reuse without duplicating.
const domainsOnPrem = {
  'alpha.remix.live': 1,
  'beta.remix.live': 2,
  'remix.ethereum.org': 3,
  // Electron / desktop on-prem build
  'localhost': 4,
  // Browser local dev (distinct site id for noise isolation)
  '127.0.0.1': 5
};
try { window.__MATOMO_SITE_IDS__ = domainsOnPrem } catch (e) { /* ignore */ }

// Special site id reserved for localhost web dev (non-electron) testing when opt-in flag set.
// Distinctions:
//   On-prem / desktop electron: site id 4 (see domainsOnPrem localhost entry)
//   Packaged desktop build (cloud mapping): site id 35
//   Localhost web development (browser) test mode: site id 5 (this constant)
const LOCALHOST_WEB_DEV_SITE_ID = 5;

// Debug flag: enable verbose Matomo instrumentation logs.
// Activate by setting localStorage.setItem('matomo-debug','true') (auto-on for localhost if flag present).
function matomoDebugEnabled () {
  try {
    // Allow enabling via localStorage OR debug_matatomo=1 query param for quick inspection.
    const qp = new URLSearchParams(window.location.search)
    const hash = window.location.hash || ''
    if (qp.get('debug_matatomo') === '1') return true
    if (/debug_matatomo=1/.test(hash)) return true
    return window.localStorage.getItem('matomo-debug') === 'true'
  } catch (e) { return false }
}

let domainOnPremToTrack = domainsOnPrem[window.location.hostname];

// Derived mode helper: cookie if performance analytics enabled, else anon.
function deriveTrackingModeFromPerf () {
  try {
    const raw = window.localStorage.getItem(TRACKING_CONFIG_KEY);
    if (!raw) return 'anon';
    const parsed = JSON.parse(raw);
    const perf = !!parsed['settings/matomo-perf-analytics'];
    return perf ? 'cookie' : 'anon';
  } catch (e) { return 'anon'; }
}


function initMatomoArray (paqName) {
  const existing = window[paqName];
  if (existing) return existing;
  const arr = [];
  // Wrap push for debug visibility.
  arr.push = function (...args) { Array.prototype.push.apply(this, args); if (matomoDebugEnabled()) console.debug('[Matomo][queue]', ...args); return this.length }
  window[paqName] = arr;
  return arr;
}

function baseMatomoConfig (_paq) {
  _paq.push(['setExcludedQueryParams', ['code', 'gist']]);
  _paq.push(['setExcludedReferrers', ['etherscan.io']]);
  _paq.push(['enableJSErrorTracking']);
  _paq.push(['enableLinkTracking']);
  _paq.push(['enableHeartBeatTimer']);
  _paq.push(['trackEvent', 'loader', 'load']);
}

function applyTrackingMode (_paq, mode) {
  if (mode === 'cookie') {
    // Cookie (full) mode: properly set up cookie consent
    _paq.push(['requireCookieConsent'])
    _paq.push(['rememberCookieConsentGiven']) // Give AND remember cookie consent
    _paq.push(['setCustomDimension', MATOMO_TRACKING_MODE_DIMENSION_ID, 'cookie'])
  } else {
    // Anonymous mode:
    //  - Prevent any Matomo cookies from being created (disableCookies)
    //  - Do NOT call consent APIs (keeps semantics clear: no cookie consent granted)
    //  - Hits are still sent; visits will be per reload unless SPA navigation adds more actions
    _paq.push(['disableCookies'])
    _paq.push(['disableBrowserFeatureDetection']);
    _paq.push(['setCustomDimension', MATOMO_TRACKING_MODE_DIMENSION_ID, 'anon'])
    if (matomoDebugEnabled()) _paq.push(['trackEvent', 'debug', 'anon_mode_active'])
  }
}

function loadMatomoScript (u) {
  const d = document; const g = d.createElement('script'); const s = d.getElementsByTagName('script')[0];
  g.async = true; g.src = u + 'matomo.js'; s.parentNode.insertBefore(g, s);
}

function loadMatomoDebugPlugin() {
  // Load the debug plugin script
  const d = document; 
  const g = d.createElement('script'); 
  const s = d.getElementsByTagName('script')[0];
  g.async = true; 
  g.src = 'assets/js/matomo-debug-plugin.js';
  g.onload = function() {
    // Initialize the plugin once loaded
    if (typeof window.initMatomoDebugPlugin === 'function') {
      window.initMatomoDebugPlugin();
    }
  };
  s.parentNode.insertBefore(g, s);
}


function trackDomain (domainToTrack, u, paqName, mode) {
  const _paq = initMatomoArray(paqName);
  // Must set tracker url & site id early but after mode-specific cookie disabling
  applyTrackingMode(_paq, mode);
  _paq.push(['setTrackerUrl', u + 'matomo.php']);
  _paq.push(['setSiteId', domainToTrack]);
  if (matomoDebugEnabled()) {
    console.debug('[Matomo] init trackDomain', { siteId: domainToTrack, mode });
  }
  // Performance preference dimension (on|off) read from config before base config
  // Performance dimension removed: mode alone now indicates cookie vs anon state.
  baseMatomoConfig(_paq);
  // Page view AFTER all config (consent / custom dimensions)
  _paq.push(['trackPageView']);
  
  // Load debug plugin (conditional based on localStorage flags)
  loadMatomoDebugPlugin();

  loadMatomoScript(u);
}

const trackingMode = deriveTrackingModeFromPerf();
// Write back deprecated mode keys for any legacy code still reading them (non-authoritative)
try {
  const raw = window.localStorage.getItem(TRACKING_CONFIG_KEY);
  const parsed = raw ? JSON.parse(raw) : {};
  parsed[MODE_KEY] = trackingMode; // keep string mode in sync for compatibility
  parsed[LEGACY_BOOL_KEY] = (trackingMode === 'cookie');
  window.localStorage.setItem(TRACKING_CONFIG_KEY, JSON.stringify(parsed));
} catch (e) { /* ignore */ }

if (window.electronAPI) {
  // Desktop (Electron). We still respect modes.
  window.electronAPI.canTrackMatomo().then((canTrack) => {
    if (!canTrack) {
      console.log('Matomo tracking is disabled on Dev mode');
      return;
    }
    // Sync initial tracking mode with desktop main process (which defaulted to anon).
    if (typeof window.electronAPI.setTrackingMode === 'function') {
      try {
        window.electronAPI.setTrackingMode(trackingMode);
        if (matomoDebugEnabled()) console.debug('[Matomo][electron] initial setTrackingMode sent', trackingMode);
      } catch (e) {
        console.warn('[Matomo][electron] failed to send initial setTrackingMode', e);
      }
    }
    // We emulate _paq queue and forward each push to the electron layer.
    const queue = [];
    window._paq = {
      // Accept either style:
      //   _paq.push(['trackEvent', cat, act, name, value])  (classic Matomo array tuple)
      //   _paq.push('trackEvent', cat, act, name, value)    (varargs – we normalize it)
      push: function (...args) {
        const tuple = (args.length === 1 && Array.isArray(args[0])) ? args[0] : args;
        queue.push(tuple);
        const isEvent = tuple[0] === 'trackEvent';
        if (matomoDebugEnabled()) console.log('[Matomo][electron] queue', tuple, queue.length, isEvent);
        try {
          if (isEvent && window.electronAPI.trackDesktopEvent) {
            window.electronAPI.trackDesktopEvent(tuple[1], tuple[2], tuple[3], tuple[4]);
            if (matomoDebugEnabled()) console.debug('[Matomo][electron] forwarded', { tuple, queueLength: queue.length, ts: Date.now() });
          }
        } catch (e) {
            console.warn('[Matomo][electron] failed to forward event', tuple, e);
        }
      }
    };
    // We perform a reduced configuration. Electron side can interpret commands similarly to Matomo's JS if needed.
    // NOTE: If electron side actually just forwards to a remote Matomo HTTP API, ensure parity with browser init logic.
    const proxy = { push: (...args) => window._paq.push(...args) };
    applyTrackingMode(proxy, trackingMode);
    // Performance dimension in electron
    // Performance dimension removed for electron path as well.
    baseMatomoConfig({ push: (...args) => window._paq.push(...args) });
    window._paq.push(['trackEvent', 'tracking_mode', trackingMode]);
    window._paq.push(['trackPageView']);
    if (matomoDebugEnabled()) console.debug('[Matomo] electron init complete');
  });
} else {
  // Web: previously excluded localhost. Allow opt-in for localhost testing via localStorage flag.
  const qp = new URLSearchParams(window.location.search)
  const hash = window.location.hash || ''
  const debugMatatomo = qp.get('debug_matatomo') === '1' || /debug_matatomo=1/.test(hash)
  const localhostEnabled = (() => {
    try { return window.localStorage.getItem('matomo-localhost-enabled') === 'true' } catch (e) { return false }
  })();
  if (window.location.hostname === 'localhost') {
    // If debug_matatomo=1, force enable localhost tracking temporarily without requiring localStorage toggle.
    if (localhostEnabled || debugMatatomo) {
      console.log('[Matomo] Localhost tracking enabled (' + (debugMatatomo ? 'query param' : 'localStorage flag') + ') site id ' + LOCALHOST_WEB_DEV_SITE_ID)
      trackDomain(LOCALHOST_WEB_DEV_SITE_ID, 'https://matomo.remix.live/matomo/', '_paq', trackingMode);
    } else {
      console.log('[Matomo] Localhost tracking disabled (use ?debug_matatomo=1 or set matomo-localhost-enabled=true to enable).')
    }
  } else if (domainOnPremToTrack) {
    trackDomain(domainOnPremToTrack, 'https://matomo.remix.live/matomo/', '_paq', trackingMode);
  }
}
function isElectron() {
  // Renderer process
  if (typeof window !== 'undefined' && typeof window.process === 'object' && window.process.type === 'renderer') {
    return true
  }

  // Main process
  if (typeof process !== 'undefined' && typeof process.versions === 'object' && !!process.versions.electron) {
    return true
  }

  // Detect the user agent when the `nodeIntegration` option is set to false
  if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
    return true
  }

  return false
}

const versionUrl = 'assets/version.json'
fetch(versionUrl, { cache: "no-store" }).then(response => {
  response.text().then(function (data) {
    const version = JSON.parse(data);
    console.log(`Loading Remix ${version.version}`);
  });
});
