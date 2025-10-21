import { initializePaddle, Paddle, PaddleEventData, CheckoutEventNames } from '@paddle/paddle-js'

type Env = 'sandbox' | 'production'

type Cache = {
  instance?: Paddle
  promise?: Promise<Paddle>
  key?: string
  listeners: Array<(event: PaddleEventData) => void>
}

const g = globalThis as unknown as { __paddleSingleton?: Cache }
if (!g.__paddleSingleton) g.__paddleSingleton = { listeners: [] }
const cache = g.__paddleSingleton

const buildKey = (env: Env, token: string) => `${String(env).toLowerCase().trim()}:${String(token).trim()}`

export function getPaddle(): Paddle | undefined {
  return cache.instance
}

export function getPaddlePromise(): Promise<Paddle> | undefined {
  return cache.promise
}

export function onPaddleEvent(listener: (event: PaddleEventData) => void) {
  if (!cache.listeners) cache.listeners = []
  cache.listeners.push(listener)
}

export function offPaddleEvent(listener: (event: PaddleEventData) => void) {
  if (!cache.listeners) return
  cache.listeners = cache.listeners.filter((l) => l !== listener)
}

export async function initPaddle(token: string, environment: Env = 'sandbox'): Promise<Paddle> {
  if (!token) throw new Error('Missing Paddle client token')
  const key = buildKey(environment, token)

  // Already initialized for this key
  if (cache.instance && cache.key === key) return cache.instance
  if (cache.promise && cache.key === key) return cache.promise

  // If key changed, allow re-init for new env/token (do not reuse old instance)
  cache.key = key
  console.log('[Paddle] init (singleton) for key', key)

  const logScriptTags = () => {
    try {
      const scripts = Array.from(document.getElementsByTagName('script'))
      const paddleScripts = scripts.filter(s => (s.src || '').toLowerCase().includes('paddle'))
      console.log(`[Paddle] script tags found: ${paddleScripts.length}`)
      paddleScripts.forEach((s, i) => console.log(`  [${i}]`, s.src))
    } catch {
      // ignore if document not available
    }
  }

  const debugStatus = () => {
    const w = globalThis as any
    const hasGlobal = !!w.Paddle
    console.log('[Paddle][debug] key:', cache.key, 'hasInstance:', !!cache.instance, 'hasPromise:', !!cache.promise, 'globalThis.Paddle:', hasGlobal)
    logScriptTags()
  }
  ;(globalThis as any).__paddleDebug = debugStatus
  debugStatus()

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

  cache.promise = initializePaddle({
    environment,
    token,
    eventCallback: (event: PaddleEventData) => {
      // Fan-out to all subscribers
      try {
        cache.listeners?.forEach((l) => l(event))
      } catch (e) {
        console.error('[Paddle] event listener error', e)
      }
      if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED) {
        console.log('[Paddle] checkout.completed')
      } else if (event.name === CheckoutEventNames.CHECKOUT_CLOSED) {
        console.log('[Paddle] checkout.closed')
      } else if (event.name === CheckoutEventNames.CHECKOUT_PAYMENT_FAILED) {
        console.warn('[Paddle] checkout.payment_failed', event.data)
      }
    }
  })
    .then(async (instance) => {
      const resolved = instance ?? (await waitForPaddle().catch(() => undefined))
      if (!resolved) throw new Error('Paddle.js not available')
      cache.instance = resolved
      console.log('[Paddle] instance ready')
      return resolved
    })
    .catch((e) => {
      // allow retry on next call
      cache.promise = undefined
      console.error('[Paddle] init failed:', e)
      throw e
    })

  return cache.promise
}
