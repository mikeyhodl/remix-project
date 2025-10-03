/**
 * AI Events - AI and Copilot related tracking events
 * 
 * This file contains all AI-related Matomo events including RemixAI interactions,
 * Ollama local AI, and code completion features.
 */

import { MatomoEventBase } from '../core/base-types';

export interface AIEvent extends MatomoEventBase {
  category: 'ai';
  action: 
    | 'remixAI'
    | 'error_explaining_SolidityError'
    | 'vulnerability_check_pasted_code'
    | 'generateDocumentation'
    | 'explainFunction'
    | 'Copilot_Completion_Accepted'
    | 'code_generation'
    | 'code_insertion'
    | 'code_completion'
    | 'AddingAIContext'
    | 'ollama_host_cache_hit'
    | 'ollama_port_check'
    | 'ollama_host_discovered_success'
    | 'ollama_port_connection_failed'
    | 'ollama_host_discovery_failed'
    | 'ollama_availability_check'
    | 'ollama_availability_result'
    | 'ollama_list_models_start'
    | 'ollama_list_models_failed'
    | 'ollama_reset_host'
    | 'ollama_pull_model_start'
    | 'ollama_pull_model_failed'
    | 'ollama_pull_model_success'
    | 'ollama_pull_model_error'
    | 'ollama_get_best'
    | 'ollama_get_best_model_error'
    | 'ollama_initialize_failed'
    | 'ollama_host_discovered'
    | 'ollama_models_found'
    | 'ollama_model_auto_selected'
    | 'ollama_initialize_success'
    | 'ollama_model_selection_error'
    | 'ollama_fim_native'
    | 'ollama_fim_token_based'
    | 'ollama_completion_no_fim'
    | 'ollama_suffix_overlap_removed'
    | 'ollama_code_completion_complete'
    | 'ollama_code_insertion'
    | 'ollama_generate_contract'
    | 'ollama_generate_workspace'
    | 'ollama_chat_answer'
    | 'ollama_code_explaining'
    | 'ollama_error_explaining'
    | 'ollama_vulnerability_check'
    | 'ollama_provider_selected'
    | 'ollama_fallback_to_provider'
    | 'ollama_default_model_selected'
    | 'ollama_unavailable'
    | 'ollama_connection_error'
    | 'ollama_model_selected'
    | 'ollama_model_set_backend_success'
    | 'ollama_model_set_backend_failed';
}

/**
 * AI Events - Type-safe builders
 */
export const AIEvents = {
  remixAI: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'remixAI',
    name,
    value,
    isClick: true // User clicks to interact with RemixAI
  }),
  
  explainFunction: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'explainFunction',
    name,
    value,
    isClick: true // User clicks to request function explanation from AI
  }),
  
  generateDocumentation: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'generateDocumentation',
    name,
    value,
    isClick: true // User clicks to request AI documentation generation
  }),
  
  vulnerabilityCheckPastedCode: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'vulnerability_check_pasted_code',
    name,
    value,
    isClick: true // User requests AI vulnerability check on pasted code
  }),
  
  copilotCompletionAccepted: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'Copilot_Completion_Accepted',
    name,
    value,
    isClick: true // User accepts AI copilot completion
  }),
  
  codeGeneration: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'code_generation',
    name,
    value,
    isClick: false // AI generates code automatically
  }),
  
  codeInsertion: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'code_insertion',
    name,
    value,
    isClick: false // AI inserts code automatically
  }),
  
  codeCompletion: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'code_completion',
    name,
    value,
    isClick: false // AI completes code automatically
  }),
  
  AddingAIContext: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'AddingAIContext',
    name,
    value,
    isClick: true // User adds AI context
  }),
  
  ollamaProviderSelected: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'ollama_provider_selected',
    name,
    value,
    isClick: false // System selects provider
  }),
  
  ollamaModelSelected: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'ollama_model_selected',
    name,
    value,
    isClick: true // User selects model
  }),
  
  ollamaUnavailable: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'ollama_unavailable',
    name,
    value,
    isClick: false // System detects unavailability
  }),
  
  ollamaConnectionError: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'ollama_connection_error',
    name,
    value,
    isClick: false // System connection error
  }),
  
  ollamaFallbackToProvider: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'ollama_fallback_to_provider',
    name,
    value,
    isClick: false // System falls back to provider
  }),
  
  ollamaDefaultModelSelected: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'ollama_default_model_selected',
    name,
    value,
    isClick: false // System selects default model
  }),
  
  ollamaModelSetBackendSuccess: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'ollama_model_set_backend_success',
    name,
    value,
    isClick: false // Backend successfully set model
  }),
  
  ollamaModelSetBackendFailed: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'ollama_model_set_backend_failed',
    name,
    value,
    isClick: false // Backend failed to set model
  })
} as const;

/**
 * RemixAI Events - Specific to RemixAI interactions
 */
export interface RemixAIEvent extends MatomoEventBase {
  category: 'remixAI';
  action:
    | 'ModeSwitch'
    | 'GenerateNewAIWorkspaceFromEditMode'
    | 'SetAIProvider'
    | 'SetOllamaModel'
    | 'GenerateNewAIWorkspaceFromModal';
}

/**
 * RemixAI Events - Type-safe builders
 */
export const RemixAIEvents = {
  ModeSwitch: (name?: string, value?: string | number): RemixAIEvent => ({
    category: 'remixAI',
    action: 'ModeSwitch',
    name,
    value,
    isClick: true // User switches AI mode
  }),
  
  GenerateNewAIWorkspaceFromEditMode: (name?: string, value?: string | number): RemixAIEvent => ({
    category: 'remixAI',
    action: 'GenerateNewAIWorkspaceFromEditMode',
    name,
    value,
    isClick: true // User generates workspace from edit mode
  }),
  
  SetAIProvider: (name?: string, value?: string | number): RemixAIEvent => ({
    category: 'remixAI',
    action: 'SetAIProvider',
    name,
    value,
    isClick: true // User sets AI provider
  }),
  
  SetOllamaModel: (name?: string, value?: string | number): RemixAIEvent => ({
    category: 'remixAI',
    action: 'SetOllamaModel',
    name,
    value,
    isClick: true // User sets Ollama model
  }),
  
  GenerateNewAIWorkspaceFromModal: (name?: string, value?: string | number): RemixAIEvent => ({
    category: 'remixAI',
    action: 'GenerateNewAIWorkspaceFromModal',
    name,
    value,
    isClick: true // User generates workspace from modal
  })
} as const;

/**
 * RemixAI Assistant Events - Specific to assistant interactions
 */
export interface RemixAIAssistantEvent extends MatomoEventBase {
  category: 'remixAIAssistant';
  action:
    | 'likeResponse'
    | 'dislikeResponse';
}

/**
 * RemixAI Assistant Events - Type-safe builders
 */
export const RemixAIAssistantEvents = {
  likeResponse: (name?: string, value?: string | number): RemixAIAssistantEvent => ({
    category: 'remixAIAssistant',
    action: 'likeResponse',
    name,
    value,
    isClick: true // User likes AI response
  }),
  
  dislikeResponse: (name?: string, value?: string | number): RemixAIAssistantEvent => ({
    category: 'remixAIAssistant',
    action: 'dislikeResponse',
    name,
    value,
    isClick: true // User dislikes AI response
  })
} as const;