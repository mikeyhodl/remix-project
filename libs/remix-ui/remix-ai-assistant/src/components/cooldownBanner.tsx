import React, { useEffect, useState } from 'react'

/**
 * CooldownBanner
 *
 * Sticky alert rendered above the chat input when the AI assistant is
 * rate-limited or terminally blocked. Driven by the `CooldownDisplay`
 * snapshot the assistant-state plugin exposes via `getCooldownDisplay()`.
 *
 *  - For RATE_LIMITED / RATE_LIMITED_GLOBAL we show a live mm:ss countdown
 *    and the human "resets at HH:MM" timestamp.
 *  - For IP_BLOCKED / ABUSE_BLOCKED we show a terminal banner — no timer,
 *    no auto-clear.
 *
 * The component re-renders itself once a second purely for the countdown;
 * the underlying `display` object is refreshed by the plugin's stateChanged
 * event, so we don't need to keep refetching.
 */
export interface CooldownBannerDisplay {
  active: boolean
  isTerminal: boolean
  remainingMs: number
  remainingSec: number
  expiresAt: number | null
  feature: string | null
  limit: number | null
  window: string | null
  message: string
  code: string
}

interface CooldownBannerProps {
  display: CooldownBannerDisplay
}

function formatCountdown(seconds: number): string {
  if (!isFinite(seconds)) return '—'
  if (seconds <= 0) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s.toString().padStart(2, '0')}s`
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

function formatExpiresAt(expiresAt: number | null): string | null {
  if (!expiresAt) return null
  try {
    const d = new Date(expiresAt)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return null
  }
}

export const CooldownBanner: React.FC<CooldownBannerProps> = ({ display }) => {
  // Local 1s tick — the plugin already re-emits stateChanged every second
  // while a rate-limit is active, but we tick locally too so the UI stays
  // smooth even if the plugin's interval drifts.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (display.isTerminal) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [display.isTerminal])

  const remaining = display.isTerminal
    ? Number.POSITIVE_INFINITY
    : Math.max(0, Math.ceil(((display.expiresAt ?? Date.now()) - Date.now()) / 1000))

  const isTerminal = display.isTerminal
  const isGlobal = display.code === 'RATE_LIMITED_GLOBAL'
  const expiresAtText = formatExpiresAt(display.expiresAt)

  const title = isTerminal
    ? 'Access blocked'
    : isGlobal
      ? 'Slow down'
      : 'Rate limit reached'

  const icon = isTerminal ? 'fa-ban' : isGlobal ? 'fa-gauge-high' : 'fa-hourglass-half'

  return (
    <div
      className={`alert mb-1 mx-2 py-2 px-3 d-flex align-items-start gap-2 ${
        isTerminal ? 'alert-danger' : 'alert-warning'
      }`}
      role="alert"
      data-id="ai-cooldown-banner"
      style={{ borderRadius: 8, fontSize: '0.85rem' }}
    >
      <i className={`fa-solid ${icon} mt-1`} aria-hidden="true" />
      <div className="flex-grow-1">
        <div className="fw-bold">{title}</div>
        <div className="small">{display.message}</div>
        {!isTerminal && (
          <div className="small mt-1 d-flex flex-wrap gap-2">
            <span data-id="ai-cooldown-countdown">
              <i className="fa-regular fa-clock me-1" />
              Try again in <strong>{formatCountdown(remaining)}</strong>
            </span>
            {expiresAtText && (
              <span className="text-muted">
                · resets at {expiresAtText}
              </span>
            )}
            {display.limit && display.window && (
              <span className="text-muted">
                · limit {display.limit}/{display.window}
              </span>
            )}
            {display.feature && (
              <span className="text-muted">
                · {display.feature}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
