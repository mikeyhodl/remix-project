import { screen, app } from 'electron';
import { isPackaged, isE2E, isMatomoDev, isMatomoDebug } from '../main';
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/*
  Desktop Matomo tracking utility (fetch-based)
  Goals parity with web:
    - Site ID: 6 (desktop test domain)
    - tracking_mode dimension (ID 1) -> 'cookie' | 'anon'
    - Cookie mode: persistent visitorId across launches
    - Anon mode: ephemeral visitorId per app session (no persistence)
    - cookie=1/0 flag tells Matomo about tracking mode
    - Let Matomo handle visit aggregation based on visitor ID and timing

  NOTE: We use fetch-based tracking but let Matomo manage visit detection.
*/

// Site IDs:
// 4 -> Standard packaged / on-prem desktop (mirrors localhost on-prem mapping)
// 6 -> Development override when started with --matomo-dev-track
const SITE_ID = isMatomoDev ? '6' : '4';
const DIM_TRACKING_MODE_ID = 1; // custom dimension id (visit scope)
const STORAGE_FILE = 'matomo.json';

type TrackerState = {
  visitorId: string;
  lastHit: number;
};

let state: TrackerState | null = null;
let mode: 'cookie' | 'anon' = 'cookie';
let sessionVisitorId: string | null = null; // for anon ephemeral
let sessionLastHit: number = 0; // for anon mode visit continuity
let initialized = false; // true after initDesktopMatomo completes
// Queue events before initial pageview so they join same visit
type Queued = { type: 'pv' | 'ev'; name?: string; category?: string; action?: string; label?: string; value?: number };
const preInitQueue: Queued[] = [];

function loadState(filePath: string): TrackerState | null {
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as TrackerState;
  } catch { return null; }
}

function saveState(filePath: string, s: TrackerState) {
  try { writeFileSync(filePath, JSON.stringify(s), 'utf-8'); } catch { /* ignore */ }
}

function generateVisitorId() {
  return randomBytes(8).toString('hex'); // 16 hex chars
}

function debugLog(message: string, ...args: any[]) {
  if (isMatomoDebug) {
    console.log(`[Matomo][desktop] ${message}`, ...args);
  }
}

export function initDesktopMatomo(trackingMode: 'cookie' | 'anon') {
  mode = trackingMode;
  if (!isMatomoDev && (!(process.env.NODE_ENV === 'production' || isPackaged) || isE2E)) {
    debugLog('init skipped (env gate)', { isPackaged, NODE_ENV: process.env.NODE_ENV, isE2E, isMatomoDev });
    return; // noop in dev/e2e unless dev override
  }
  const userData = app.getPath('userData');
  const filePath = join(userData, STORAGE_FILE);
  if (mode === 'cookie') {
    state = loadState(filePath);
    if (!state) {
      state = { visitorId: generateVisitorId(), lastHit: 0 };
    }
  } else { // anon
    sessionVisitorId = generateVisitorId();
  }
  initialized = true;
  
  // Debug: show queue contents before flushing
  debugLog('init complete', { mode, siteId: SITE_ID, state, sessionVisitorId, queued: preInitQueue.length });
  debugLog('queue contents:', preInitQueue.map(q => 
    q.type === 'pv' ? `pageview: ${q.name}` : `event: ${q.category}:${q.action}`
  ));
  
  // Flush queued events: send pageviews first, then events
  const pvs = preInitQueue.filter(q => q.type === 'pv');
  const evs = preInitQueue.filter(q => q.type === 'ev');
  preInitQueue.length = 0;
  
  debugLog('flushing queue - pageviews:', pvs.length, 'events:', evs.length);
  
  // Guarantee pageviews go first
  for (const pv of pvs) {
    debugLog('flushing pageview:', pv.name);
    trackDesktopPageView(pv.name || 'App:Page');
  }
  for (const ev of evs) {
    if (ev.category && ev.action) {
      debugLog('flushing event:', `${ev.category}:${ev.action}`);
      trackDesktopEvent(ev.category, ev.action, ev.label, ev.value);
    }
  }
}

// Removed computeNewVisit - let Matomo handle visit aggregation based on visitor ID and timing

function getVisitorId(): string {
  if (mode === 'cookie') {
    if (!state) {
      state = { visitorId: generateVisitorId(), lastHit: 0 };
    }
    return state.visitorId;
  }
  if (!sessionVisitorId) sessionVisitorId = generateVisitorId();
  return sessionVisitorId;
}

function baseParams(now: number, actionName: string) {
  const chromiumVersion = process.versions.chrome;
  const os = process.platform;
  const osVersion = process.getSystemVersion();
  const ua = `Mozilla/5.0 (${os === 'darwin' ? 'Macintosh' : os === 'win32' ? 'Windows NT' : os === 'linux' ? 'X11; Linux x86_64' : 'Unknown'}; ${osVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromiumVersion} Safari/537.36`;
  const res = `${screen.getPrimaryDisplay().size.width}x${screen.getPrimaryDisplay().size.height}`;
  const vid = getVisitorId();

  const p: Record<string, string> = {
    idsite: SITE_ID,
    rec: '1',
    action_name: actionName,
    url: 'https://remix.ethereum.org/desktop',
    rand: Math.random().toString(),
    res,
    ua,
    cookie: mode === 'cookie' ? '1' : '0', // Tell Matomo about cookie support
    // Custom dimension for tracking mode (visit scope)
    [`dimension${DIM_TRACKING_MODE_ID}`]: mode,
    _id: vid // explicit visitor id for continuity
  };
  return p;
}

function send(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  debugLog('sending', params);
  fetch(`https://matomo.remix.live/matomo/matomo.php?${qs}`, { method: 'GET' })
    .then(r => {
      if (!r.ok) console.error('[Matomo][desktop] failed', r.status);
      else debugLog('ok', r.status);
    })
    .catch(e => console.error('[Matomo][desktop] error', e));
}

export function trackDesktopPageView(name: string) {
  if (!initialized) {
    preInitQueue.push({ type: 'pv', name });
    debugLog('queued pageview (pre-init)', name);
    return;
  }
  if (!isMatomoDev && (!(process.env.NODE_ENV === 'production' || isPackaged) || isE2E)) {
    debugLog('pageview skipped (env gate)', { name });
    return;
  }
  const now = Date.now();
  const params = baseParams(now, name || 'App:Page');
  params.pv_id = randomBytes(3).toString('hex'); // page view id (optional)
  send(params);
  if (mode === 'cookie' && state) {
    state.lastHit = now;
    const userData = app.getPath('userData');
    saveState(join(userData, STORAGE_FILE), state);
  } else if (mode === 'anon') {
    sessionLastHit = now;
  }
  debugLog('pageview sent', { name, mode });
}

export function trackDesktopEvent(category: string, action: string, name?: string, value?: number) {
  if (!initialized) {
    preInitQueue.push({ type: 'ev', category, action, label: name, value });
    debugLog('queued event (pre-init)', { category, action, name, value });
    return;
  }
  if (!category || !action) return;
  if (!isMatomoDev && (!(process.env.NODE_ENV === 'production' || isPackaged) || isE2E)) {
    debugLog('event skipped (env gate)', { category, action, name, value });
    return;
  }
  const now = Date.now();
  const params = baseParams(now, `${category}:${action}`);
  params.e_c = category;
  params.e_a = action;
  if (name) params.e_n = name;
  if (typeof value === 'number' && !isNaN(value)) params.e_v = String(value);
  send(params);
  if (mode === 'cookie' && state) {
    state.lastHit = now;
    const userData = app.getPath('userData');
    saveState(join(userData, STORAGE_FILE), state);
  } else if (mode === 'anon') {
    sessionLastHit = now;
  }
  debugLog('event sent', { category, action, name, value, mode });
}

// Convenience starter: call at app launch
export function initAndTrackLaunch(trackingMode: 'cookie' | 'anon') {
  // Queue launch pageview before init so it becomes the first hit after init flush
  preInitQueue.push({ type: 'pv', name: 'App:Launch' });
  initDesktopMatomo(trackingMode);
}

// Allow runtime switching (e.g. user toggles performance analytics in settings UI)
export function setDesktopTrackingMode(newMode: 'cookie' | 'anon') {
  if (!isMatomoDev && (!(process.env.NODE_ENV === 'production' || isPackaged) || isE2E)) {
    debugLog('mode switch skipped (env gate)', { newMode });
    return;
  }
  if (newMode === mode) return;
  mode = newMode;
  if (mode === 'cookie') {
    const userData = app.getPath('userData');
    const filePath = join(userData, STORAGE_FILE);
    state = loadState(filePath);
    if (!state) state = { visitorId: generateVisitorId(), lastHit: 0 };
  } else {
    // Switch to anon: fresh ephemeral visitor id; do not persist previous state.
    sessionVisitorId = generateVisitorId();
    sessionLastHit = 0;
  }
  // Force next hit to be a new visit for clarity after mode change
  if (state) state.lastHit = 0;
  trackDesktopPageView(`App:ModeSwitch:${mode}`);
  debugLog('mode switched', { mode });
}
