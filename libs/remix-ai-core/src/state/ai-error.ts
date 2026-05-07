/**
 * AIError envelope parser.
 *
 * Source of truth: services/ai/docs/ERROR_CODES.md (upstream `remix-api` repo).
 *
 *   {
 *     "error": {
 *       "code": "RATE_LIMITED",
 *       "message": "Rate limit exceeded. Try again later.",
 *       "status": 429,
 *       "retryAfter": 30,
 *       "resetAt": "2026-05-07T12:34:56.000Z",
 *       "details": { "feature": "ai:solcoder" }
 *     }
 *   }
 *
 * For SSE endpoints (solcoder streaming, dapp/figma generators), errors
 * raised AFTER the response stream has started are emitted as a single
 * frame: `data: {"type":"error","error":{...}}`.
 *
 * The machine never sees raw HTTP responses — the wrapping plugin runs
 * one of these parsers and dispatches `ERROR_RECEIVED` with the result.
 */

import type { AIError } from './assistant-machine'

const FALLBACK_CODE = 'INTERNAL_ERROR'

/** Parse a JSON error body returned by an AI endpoint. */
export function parseAIErrorEnvelope(body: unknown, httpStatus: number): AIError {
  if (body && typeof body === 'object' && 'error' in body) {
    const raw = (body as { error: unknown }).error
    if (raw && typeof raw === 'object') {
      return normalize(raw as Partial<AIError>, httpStatus)
    }
  }
  // Some upstream errors come back as a bare string or unstructured object —
  // we still need a normalized shape so the machine doesn't have to special-case.
  return {
    code: FALLBACK_CODE,
    message: typeof body === 'string' ? body : 'Unexpected response from AI service',
    status: httpStatus
  }
}

/**
 * Parse a single SSE frame body. Returns null if the frame isn't an error
 * (so the caller can keep streaming) or an AIError if it is.
 */
export function parseAISSEErrorFrame(frameJson: unknown): AIError | null {
  if (!frameJson || typeof frameJson !== 'object') return null
  const f = frameJson as { type?: string; error?: unknown }
  if (f.type !== 'error' || !f.error || typeof f.error !== 'object') return null
  return normalize(f.error as Partial<AIError>, 500)
}

function normalize(raw: Partial<AIError>, fallbackStatus: number): AIError {
  return {
    code: typeof raw.code === 'string' && raw.code.length > 0 ? raw.code : FALLBACK_CODE,
    message: typeof raw.message === 'string' ? raw.message : 'AI service error',
    status: typeof raw.status === 'number' ? raw.status : fallbackStatus,
    retryAfter: typeof raw.retryAfter === 'number' ? raw.retryAfter : undefined,
    resetAt: typeof raw.resetAt === 'string' ? raw.resetAt : null,
    details: raw.details && typeof raw.details === 'object' ? raw.details : undefined
  }
}

/**
 * Catch-all wrapper for fetch failures (network down, CORS, JSON.parse) —
 * keeps the error shape uniform so the machine sees AIError every time.
 */
export function aiErrorFromException(e: unknown): AIError {
  const message = e instanceof Error ? e.message : String(e)
  return {
    code: FALLBACK_CODE,
    message,
    status: 0
  }
}
