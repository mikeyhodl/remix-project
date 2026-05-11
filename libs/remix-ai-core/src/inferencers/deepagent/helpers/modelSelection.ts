import { IAutoModelConfig, ModelSelection } from '../../../types/deepagent'
import { analyzePromptForAutoSelection } from './promptAnalysis'
import { DEFAULT_MODEL_PROVIDER, DEFAULT_MODEL_ID } from '../constants'

/**
 * Select the optimal model based on prompt complexity and configuration
 */
export function selectOptimalModel(
  prompt: string,
  context?: string,
  autoModeConfig?: IAutoModelConfig,
  currentModelSelection?: ModelSelection,
  allowedModels: string[] = []
): ModelSelection {
  // If auto mode is disabled, use current selection
  if (!autoModeConfig?.enabled || !currentModelSelection) {
    return currentModelSelection || {
      provider: DEFAULT_MODEL_PROVIDER,
      modelId: DEFAULT_MODEL_ID
    }
  }

  const fullPrompt = context ? `${context}\n\n${prompt}` : prompt
  const complexity = analyzePromptForAutoSelection(fullPrompt)
  const securityKeywords = autoModeConfig.securityKeywords || [
    'security', 'audit', 'vulnerability', 'exploit', 'attack'
  ]

  const hasSecurityKeywords = securityKeywords.some(keyword =>
    fullPrompt.toLowerCase().includes(keyword)
  )

  console.log(`[DeepAgentInferencer] Auto selection analysis:`, {
    complexity,
    hasSecurityKeywords,
    promptLength: fullPrompt.length
  })

  // Decision logic: complex tasks or security-related → Claude, simple → Mistral.
  //
  // Mistral is only safe for "simple" routing when an Anthropic model is NOT
  // available, because the deepagents middleware injects Anthropic-flavored
  // content blocks (memory/skills/filesystem state, optional cache_control)
  // into the system message. The @langchain/mistralai adapter rejects any
  // content block whose `type` is not "text" or "image_url", which manifests
  // as: `Mistral only supports types "text" or "image_url" for complex
  // message types.` on the very first turn.
  //
  // So: prefer Sonnet whenever it's allowed, regardless of complexity, and
  // only fall back to Mistral when no Claude model is permitted for this user.
  const sonnetModelId = allowedModels.find(model => model.includes('sonnet'))
  if (sonnetModelId) {
    console.log(
      `[DeepAgentInferencer] Selected Anthropic Claude (${complexity}, security=${hasSecurityKeywords})`
    )
    return { provider: 'anthropic', modelId: sonnetModelId }
  }

  if (complexity === 'complex' || hasSecurityKeywords) {
    console.warn('[DeepAgentInferencer] Preferred Claude model not available, falling back to Mistral')
  } else {
    console.log('[DeepAgentInferencer] No Claude available, using Mistral for simple task')
  }
  return {
    provider: 'mistralai',
    modelId: allowedModels.find(model => model.includes('mistral-medium')) || DEFAULT_MODEL_ID
  }
}

export function getDefaultModelSelection(): ModelSelection {
  return {
    provider: DEFAULT_MODEL_PROVIDER,
    modelId: DEFAULT_MODEL_ID
  }
}
