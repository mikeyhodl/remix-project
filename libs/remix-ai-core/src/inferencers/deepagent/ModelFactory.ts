import { ChatAnthropic } from '@langchain/anthropic'
import { ChatMistralAI } from '@langchain/mistralai'
import { ChatOpenAI } from '@langchain/openai'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { HTTPClient } from '@mistralai/mistralai/lib/http.js'
import { endpointUrls } from '@remix-endpoints-helper'
import { ModelSelection } from '../../types/deepagent'
import { DAPP_MAX_TOKENS } from './constants'
import { getRemixAuthHeader } from '../auth'

/**
 * fetch wrapper that injects the user's Remix bearer token on every request.
 * Reads the token fresh from localStorage so login/logout takes effect
 * without rebuilding the cached ChatAnthropic instance.
 */
const authedFetch: typeof fetch = (input, init = {}) => {
  const headers = new Headers(init.headers || {})
  const auth = getRemixAuthHeader()
  if (auth.Authorization) {
    // Always overwrite: the langchain client may have stamped a placeholder
    // 'Authorization: Bearer proxy-handled' from the dummy apiKey we pass in.
    headers.set('Authorization', auth.Authorization)
  }
  return fetch(input as any, { ...init, headers })
}

/**
 * HTTPClient (Mistral SDK) with a beforeRequest hook that injects the user's
 * Remix bearer token — evaluated per-request so login state stays in sync.
 *
 * Also dumps the outbound request body when AI_DEBUG is enabled, so we can
 * see exactly which message blocks trigger
 *   `Mistral only supports types "text" or "image_url" for complex message types.`
 */
const AI_DEBUG = (() => {
  try { return typeof window !== 'undefined' && window.localStorage?.getItem('AI_DEBUG') === 'true' } catch { return false }
})()

async function dumpMistralRequest(req: Request): Promise<void> {
  try {
    const cloned = req.clone()
    const text = await cloned.text()
    let parsed: any = text
    try { parsed = JSON.parse(text) } catch { /* not json */ }
    // Print the messages array — that's where the offending content blocks live.
    const msgs = parsed?.messages
    console.groupCollapsed(`[Mistral→] ${req.method} ${req.url}`)
    if (Array.isArray(msgs)) {
      msgs.forEach((m: any, i: number) => {
        const c = m?.content
        const shape = typeof c === 'string'
          ? `string(${c.length})`
          : Array.isArray(c)
            ? `array[${c.length}]: ${c.map((b: any) => b?.type ?? typeof b).join(',')}`
            : typeof c
        console.log(`  msg[${i}] role=${m?.role} content=${shape}`)
        if (Array.isArray(c)) {
          c.forEach((b: any, j: number) => {
            if (b?.type !== 'text' && b?.type !== 'image_url') {
              console.warn(`    ⚠ block[${j}] OFFENDING type=${b?.type}`, b)
            }
          })
        }
      })
    }
    console.log('full body:', parsed)
    console.groupEnd()
  } catch (e) {
    console.warn('[Mistral→] failed to dump request', e)
  }
}

function createAuthedMistralHttpClient(): HTTPClient {
  const client = new HTTPClient()
  client.addHook('beforeRequest', (req) => {
    const auth = getRemixAuthHeader()
    let next: Request = req
    if (auth.Authorization) {
      // Always overwrite: the Mistral SDK stamps a placeholder
      // 'Authorization: Bearer proxy-handled' from the dummy apiKey, which
      // would shadow the real Remix bearer token if we only set-when-missing.
      next = new Request(req, { headers: new Headers(req.headers) })
      next.headers.set('Authorization', auth.Authorization)
    }
    if (AI_DEBUG) void dumpMistralRequest(next)
    return next
  })
  return client
}

function summarizeMessages(label: string, messages: any): void {
  try {
    const arr: any[] = Array.isArray(messages)
      ? messages
      : (messages?.messages && Array.isArray(messages.messages) ? messages.messages : [])
    console.groupCollapsed(`[ModelInput ${label}] ${arr.length} message(s)`)
    arr.forEach((m, i) => {
      const role = m?._getType?.() || m?.role || m?.constructor?.name || 'unknown'
      const c = m?.content
      let shape: string
      if (typeof c === 'string') shape = `string(${c.length})`
      else if (Array.isArray(c)) shape = `array[${c.length}]: ${c.map((b: any) => b?.type ?? typeof b).join(',')}`
      else shape = typeof c
      console.log(`  [${i}] role=${role} content=${shape}`)
      if (Array.isArray(c)) {
        c.forEach((b: any, j: number) => {
          if (b?.type !== 'text' && b?.type !== 'image_url') {
            console.warn(`     ⚠ block[${j}] OFFENDING-FOR-MISTRAL type=${b?.type}`, b)
          }
        })
      }
    })
    console.log('full messages:', messages)
    console.groupEnd()
  } catch (e) {
    console.warn(`[ModelInput ${label}] dump failed`, e)
  }
}

/**
 * Wrap a chat model so every call to invoke/stream/streamEvents logs the
 * messages being passed in. Helps diagnose the
 *   `Mistral only supports types "text" or "image_url" ...`
 * error which is raised during message conversion (before any HTTP request).
 * Enable via `localStorage.setItem('AI_DEBUG', 'true')`.
 */
function wrapModelForDebug<T extends BaseChatModel>(model: T, label: string): T {
  if (!AI_DEBUG) return model
  const methodsToWrap = ['invoke', 'stream', 'streamEvents', '_generate', '_streamResponseChunks'] as const
  for (const method of methodsToWrap) {
    const original = (model as any)[method]
    if (typeof original !== 'function') continue
    ;(model as any)[method] = function (...args: any[]) {
      summarizeMessages(`${label}.${method}`, args[0])
      try {
        const result = original.apply(this, args)
        if (result && typeof result.then === 'function') {
          return result.catch((err: any) => {
            console.error(`[ModelInput ${label}.${method}] threw:`, err?.message || err)
            throw err
          })
        }
        return result
      } catch (err: any) {
        console.error(`[ModelInput ${label}.${method}] threw sync:`, err?.message || err)
        throw err
      }
    }
  }
  return model
}

export function createModelInstance(
  modelSelection: ModelSelection,
  maxTokens: number = DAPP_MAX_TOKENS
): BaseChatModel {
  const { provider, modelId } = modelSelection

  switch (provider) {
  case 'mistralai': {
    console.log(`[ModelFactory] Creating mistralai model: ${modelId}`)
    return wrapModelForDebug(new ChatMistralAI({
      apiKey: 'proxy-handled',
      model: modelId,
      temperature: 0.7,
      maxTokens: maxTokens,
      streaming: true,
      // Disable langchain's automatic retry. Otherwise a single user
      // turn produces 5-6 silent retries on 429 (or any 5xx), each
      // doubling the delay before the cooldown banner can show. We
      // want the FIRST envelope error to surface immediately so
      // assistantState can gate the next attempt.
      maxRetries: 0,
      serverURL: `${endpointUrls.langchain}/mistral`,
      httpClient: createAuthedMistralHttpClient()
    }), `mistralai/${modelId}`)
  }

  case 'moonshot': {
    console.log(`[ModelFactory] Creating moonshot model: ${modelId}`)
    // Moonshot (Kimi) speaks the OpenAI Chat Completions wire format, so we
    // use ChatOpenAI rather than the Mistral shim. The backend proxy is
    // mounted at `${endpointUrls.langchain}/moonshot`; the OpenAI SDK
    // appends `/chat/completions`, so the baseURL must include `/v1`.
    return wrapModelForDebug(new ChatOpenAI({
      apiKey: 'proxy-handled',
      model: modelId,
      // Moonshot recommends temperature=1 and currently enforces top_p=0.95.
      temperature: 1,
      topP: 0.95,
      maxTokens: maxTokens,
      streaming: true,
      maxRetries: 0,
      configuration: {
        baseURL: `${endpointUrls.langchain}/moonshot/v1`,
        fetch: authedFetch
      }
    }), `moonshot/${modelId}`)
  }

  case 'anthropic':
  default: {
    console.log(`[ModelFactory] Creating Anthropic model: ${modelId}`)
    return wrapModelForDebug(new ChatAnthropic({
      apiKey: 'proxy-handled',
      model: modelId,
      temperature: 0.7,
      maxTokens: maxTokens,
      streaming: true,
      // See note in mistralai branch — langchain auto-retry hides
      // 429s behind exponential backoff and produces a cluster of
      // red requests in DevTools before the user sees anything.
      maxRetries: 0,
      clientOptions: {
        baseURL: endpointUrls.langchain,
        fetch: authedFetch
      }
    }), `anthropic/${modelId}`)
  }
  }
}
