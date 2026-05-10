import { ChatAnthropic } from '@langchain/anthropic'
import { ChatMistralAI } from '@langchain/mistralai'
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
  if (auth.Authorization && !headers.has('Authorization')) {
    headers.set('Authorization', auth.Authorization)
  }
  return fetch(input as any, { ...init, headers })
}

/**
 * HTTPClient (Mistral SDK) with a beforeRequest hook that injects the user's
 * Remix bearer token — evaluated per-request so login state stays in sync.
 */
function createAuthedMistralHttpClient(): HTTPClient {
  const client = new HTTPClient()
  client.addHook('beforeRequest', (req) => {
    const auth = getRemixAuthHeader()
    if (auth.Authorization && !req.headers.has('Authorization')) {
      const next = new Request(req, { headers: new Headers(req.headers) })
      next.headers.set('Authorization', auth.Authorization)
      return next
    }
    return req
  })
  return client
}

export function createModelInstance(
  modelSelection: ModelSelection,
  maxTokens: number = DAPP_MAX_TOKENS
): BaseChatModel {
  const { provider, modelId } = modelSelection

  switch (provider) {
  case 'mistralai': {
    console.log(`[ModelFactory] Creating MistralAI model: ${modelId}`)
    return new ChatMistralAI({
      apiKey: 'proxy-handled',
      model: modelId,
      temperature: 0.7,
      maxTokens: maxTokens,
      streaming: true,
      serverURL: `${endpointUrls.langchain}/mistral`,
      httpClient: createAuthedMistralHttpClient()
    })
  }

  case 'anthropic':
  default: {
    console.log(`[ModelFactory] Creating Anthropic model: ${modelId}`)
    return new ChatAnthropic({
      apiKey: 'proxy-handled',
      model: modelId,
      temperature: 0.7,
      maxTokens: maxTokens,
      streaming: true,
      clientOptions: {
        baseURL: endpointUrls.langchain,
        fetch: authedFetch
      }
    })
  }
  }
}
