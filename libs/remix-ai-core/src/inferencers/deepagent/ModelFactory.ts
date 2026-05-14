import { ChatAnthropic } from '@langchain/anthropic'
import { ChatMistralAI } from '@langchain/mistralai'
import { ChatOpenAI } from '@langchain/openai'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { endpointUrls } from '@remix-endpoints-helper'
import { ModelSelection, IUserApiKeyConfig } from '../../types/deepagent'
import { DAPP_MAX_TOKENS } from './constants'

export function createModelInstance(
  modelSelection: ModelSelection,
  maxTokens: number = DAPP_MAX_TOKENS,
  userApiKeys?: IUserApiKeyConfig
): BaseChatModel {
  const { provider, modelId } = modelSelection

  switch (provider) {
  case 'mistralai': {
    const useDirectApi = userApiKeys?.useOwnKeys && userApiKeys?.mistralApiKey
    console.log(`[ModelFactory] Creating MistralAI model: ${modelId}${useDirectApi ? ' (direct API)' : ' (proxy)'}`)
    return new ChatMistralAI({
      apiKey: useDirectApi ? userApiKeys.mistralApiKey : 'proxy-handled',
      model: modelId,
      temperature: 0.7,
      maxTokens: maxTokens,
      streaming: true,
      ...(useDirectApi ? {} : { serverURL: `${endpointUrls.langchain}/mistral` })
    })
  }

  case 'openai': {
    const useDirectApi = userApiKeys?.useOwnKeys && userApiKeys?.openaiApiKey
    console.log(`[ModelFactory] Creating OpenAI model: ${modelId}${useDirectApi ? ' (direct API)' : ' (proxy)'}`)
    return new ChatOpenAI({
      apiKey: useDirectApi ? userApiKeys.openaiApiKey : 'proxy-handled',
      model: modelId,
      temperature: 0.7,
      maxTokens: maxTokens,
      streaming: true,
      ...(useDirectApi ? {} : {
        configuration: { baseURL: `${endpointUrls.langchain}/openai` }
      })
    })
  }

  case 'anthropic':
  default: {
    const useDirectApi = userApiKeys?.useOwnKeys && userApiKeys?.anthropicApiKey
    console.log(`[ModelFactory] Creating Anthropic model: ${modelId}${useDirectApi ? ' (direct API)' : ' (proxy)'}`)
    return new ChatAnthropic({
      apiKey: useDirectApi ? userApiKeys.anthropicApiKey : 'proxy-handled',
      model: modelId,
      temperature: 0.7,
      maxTokens: maxTokens,
      streaming: true,
      ...(useDirectApi ? {} : { clientOptions: { baseURL: endpointUrls.langchain } })
    })
  }
  }
}
