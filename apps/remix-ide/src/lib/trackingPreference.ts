// Central helper for Matomo tracking mode preference
// Single source of truth to avoid duplicating key names & migration logic.

export type TrackingMode = 'cookie' | 'anon'

export const TRACKING_CONFIG_KEY = 'config-v0.8:.remix.config'
export const LEGACY_BOOL_KEY = 'settings/matomo-analytics'
export const MODE_KEY = 'settings/matomo-analytics-mode'

export function readTrackingMode(): TrackingMode {
  if (typeof window === 'undefined') return 'anon'
  const raw = window.localStorage.getItem(TRACKING_CONFIG_KEY)
  if (!raw) return 'anon'
  try {
    const parsed = JSON.parse(raw)
    const modeVal = parsed[MODE_KEY]
  if (modeVal === 'cookie' || modeVal === 'anon') return modeVal
  if (modeVal === 'none') return 'anon' // migrate deprecated 'none' to 'anon'
  if (typeof parsed[LEGACY_BOOL_KEY] === 'boolean') return parsed[LEGACY_BOOL_KEY] ? 'cookie' : 'anon'
  } catch (e) {}
  return 'anon'
}

export function persistTrackingMode(mode: TrackingMode) {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(TRACKING_CONFIG_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    parsed[MODE_KEY] = mode
  parsed[LEGACY_BOOL_KEY] = mode === 'cookie'
    window.localStorage.setItem(TRACKING_CONFIG_KEY, JSON.stringify(parsed))
  } catch (e) {}
}

export function migrateLegacyPreference() {
  if (typeof window === 'undefined') return
  const raw = window.localStorage.getItem(TRACKING_CONFIG_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    if (parsed[MODE_KEY]) return
    if (typeof parsed[LEGACY_BOOL_KEY] === 'boolean') {
  persistTrackingMode(parsed[LEGACY_BOOL_KEY] ? 'cookie' : 'anon')
    }
  } catch (e) {}
}
