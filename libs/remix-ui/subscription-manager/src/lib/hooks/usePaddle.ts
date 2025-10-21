import { useEffect, useState } from 'react'
import { initializePaddle, Paddle } from '@paddle/paddle-js'

interface UsePaddleOptions {
  clientToken?: string
  environment?: 'sandbox' | 'production'
  enabled?: boolean
}

interface UsePaddleResult {
  paddle: Paddle | null
  loading: boolean
  error: string | null
}

/**
 * Hook to initialize Paddle once for the entire app
 * Only initializes if clientToken is provided and enabled is true
 */
export const usePaddle = ({
  clientToken,
  environment = 'sandbox',
  enabled = true
}: UsePaddleOptions): UsePaddleResult => {
  const [paddle, setPaddle] = useState<Paddle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Don't initialize if disabled or no token
    if (!enabled || !clientToken) {
      return
    }

    // StrictMode-safe singleton: cache instances/promises on globalThis keyed by env+token
    type Cache = {
      instances: Record<string, Paddle>
      promises: Record<string, Promise<Paddle>>
    }
  const normEnv = String(environment || '').toLowerCase().trim()
  const normToken = String(clientToken || '').trim()
  const key = `${normEnv}:${normToken}`
    const g = globalThis as unknown as { __paddleCache?: Cache }
    if (!g.__paddleCache) g.__paddleCache = { instances: {}, promises: {} }
    const cache = g.__paddleCache

    let mounted = true
    setLoading(true)

  const waitForPaddle = (timeoutMs = 10000, intervalMs = 50): Promise<Paddle> => {
      const start = Date.now()
      return new Promise((resolve, reject) => {
        const tick = () => {
          const w = globalThis as unknown as { Paddle?: Paddle }
          if (w.Paddle) return resolve(w.Paddle)
          if (Date.now() - start >= timeoutMs) return reject(new Error('Paddle.js not available'))
          setTimeout(tick, intervalMs)
        }
        tick()
      })
    }

    const ensure = async (): Promise<Paddle> => {
      // Instance already available
      if (cache.instances[key]) return cache.instances[key]
      // In-flight init exists
      if (cache.promises[key]) return cache.promises[key]

      // Start initialization once
  console.log('[Paddle] initialize once for key', key)
      cache.promises[key] = initializePaddle({
        environment,
        token: clientToken,
        eventCallback: (event) => {
          // Keep logging minimal; rely on consumer-specific listeners if needed
          if (event.name === 'checkout.error') {
            // Surface an error in console to aid debugging, but do not spam
            console.error('[Paddle] checkout.error', event.data)
          }
        }
      })
        .then(async (instance) => {
          // Some environments may attach to window asynchronously; fall back to polling
          const resolved = instance ?? (await waitForPaddle().catch(() => undefined))
          if (!resolved) throw new Error('Paddle.js not available')
          cache.instances[key] = resolved
          return resolved
        })
        .catch((e) => {
          // Allow retries by clearing failed promise
          delete cache.promises[key]
          throw e
        })

      return cache.promises[key]
    }

    ensure()
      .then((instance) => {
        if (mounted) setPaddle(instance)
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to initialize Paddle')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [clientToken, environment, enabled])

  return { paddle, loading, error }
}
