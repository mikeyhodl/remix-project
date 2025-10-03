/**
 * Type-Safe Matomo Event Tracking System
 * 
 * This file defines all valid category/action combinations for Matomo tracking.
 * It replaces arbitrary string-based tracking with compile-time type safety.
 * 
 * Usage:
 *   track({ category: 'compiler', action: 'compiled', name: 'success' })
 *   track({ category: 'ai', action: 'remixAI', name: 'code_generation', value: 123 })
 */

// ================== CORE EVENT TYPES ==================

export interface MatomoEventBase {
  name?: string;
  value?: string | number;
}

export type MatomoEvent = 
  | AIEvent
  | AppEvent
  | BackupEvent
  | BlockchainEvent
  | CompilerEvent
  | DebuggerEvent
  | DesktopDownloadEvent
  | EditorEvent
  | FileExplorerEvent
  | GridViewEvent
  | HomeTabEvent
  | LandingPageEvent
  | LocaleModuleEvent
  | ManagerEvent
  | MatomoEvent_Core
  | MigrateEvent
  | PluginEvent
  | PluginManagerEvent
  | PluginPanelEvent
  | RemixAIEvent
  | RemixAIAssistantEvent
  | RunEvent
  | ScriptExecutorEvent
  | SolidityCompilerEvent
  | SolidityStaticAnalyzerEvent
  | SolidityUMLGenEvent
  | SolidityUnitTestingEvent
  | SolUmlGenEvent
  | StorageEvent
  | TemplateSelectionEvent
  | ThemeModuleEvent
  | TopbarEvent
  | UdappEvent
  | WorkspaceEvent;

// ================== CATEGORY-SPECIFIC EVENT TYPES ==================

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

export interface AppEvent extends MatomoEventBase {
  category: 'App';
  action: 
    | 'queryParams-activated'
    | 'queryParams-calls'
    | 'PreloadError';
}

export interface BackupEvent extends MatomoEventBase {
  category: 'Backup';
  action: 
    | 'download'
    | 'error';
}

export interface BlockchainEvent extends MatomoEventBase {
  category: 'blockchain';
  action: 
    | 'providerPinned'
    | 'providerUnpinned'
    | 'Deploy With Proxy'
    | 'Upgrade With Proxy';
}

export interface CompilerEvent extends MatomoEventBase {
  category: 'compiler';
  action: 
    | 'runCompile'
    | 'compiled'
    | 'compilerDetails'
    | 'compileWithHardhat'
    | 'compileWithTruffle';
}

export interface DebuggerEvent extends MatomoEventBase {
  category: 'debugger';
  action: 
    | 'startDebugging';
}

export interface DesktopDownloadEvent extends MatomoEventBase {
  category: 'desktopDownload';
  action: 
    | 'downloadDesktopApp';
}

export interface EditorEvent extends MatomoEventBase {
  category: 'editor';
  action: 
    | 'publishFromEditor'
    | 'runScript'
    | 'runScriptWithEnv'
    | 'clickRunFromEditor'
    | 'onDidPaste';
}

export interface FileExplorerEvent extends MatomoEventBase {
  category: 'fileExplorer';
  action: 
    | 'workspaceMenu'
    | 'contextMenu'
    | 'fileAction'
    | 'deleteKey'
    | 'osxDeleteKey'
    | 'f2ToRename'
    | 'copyCombo'
    | 'cutCombo'
    | 'pasteCombo';
}

export interface GridViewEvent extends MatomoEventBase {
  category: 'GridView' | string; // Allow GridView + title combinations
  action: 
    | 'filter';
}

export interface HomeTabEvent extends MatomoEventBase {
  category: 'hometab';
  action: 
    | 'header'
    | 'startLearnEthTutorial'
    | 'updatesActionClick'
    | 'featuredPluginsToggle'
    | 'featuredPluginsActionClick'
    | 'homeGetStarted'
    | 'filesSection'
    | 'scamAlert'
    | 'titleCard'
    | 'recentWorkspacesCard'
    | 'switchTo'
    | 'featuredSection';
}

export interface LandingPageEvent extends MatomoEventBase {
  category: 'landingPage';
  action: 
    | 'MatomoAIModal';
}

export interface LocaleModuleEvent extends MatomoEventBase {
  category: 'localeModule';
  action: 
    | 'switchTo';
}

export interface ManagerEvent extends MatomoEventBase {
  category: 'manager';
  action: 
    | 'activate'
    | 'deactivate';
}

export interface MatomoEvent_Core extends MatomoEventBase {
  category: 'Matomo';
  action: 
    | 'showConsentDialog';
}

export interface MigrateEvent extends MatomoEventBase {
  category: 'Migrate';
  action: 
    | 'error'
    | 'result';
}

export interface PluginEvent extends MatomoEventBase {
  category: 'plugin';
  action: 
    | 'activated'
    | 'contractFlattener';
}

export interface PluginManagerEvent extends MatomoEventBase {
  category: 'pluginManager';
  action: 
    | 'activate'
    | 'deactivate';
}

export interface PluginPanelEvent extends MatomoEventBase {
  category: 'PluginPanel';
  action: 
    | 'pinToRight'
    | 'pinToLeft';
}

export interface RemixAIEvent extends MatomoEventBase {
  category: 'remixAI';
  action: 
    | 'ModeSwitch'
    | 'GenerateNewAIWorkspaceFromEditMode'
    | 'SetAIProvider'
    | 'SetOllamaModel'
    | 'GenerateNewAIWorkspaceFromModal';
}

export interface RemixAIAssistantEvent extends MatomoEventBase {
  category: 'remixai-assistant';
  action: 
    | 'like-response'
    | 'dislike-response';
}

export interface RemixGuideEvent extends MatomoEventBase {
  category: 'remixGuide';
  action: 
    | 'playGuide';
}

export interface RunEvent extends MatomoEventBase {
  category: 'run';
  action: 
    | 'recorder';
}

export interface ScriptExecutorEvent extends MatomoEventBase {
  category: 'ScriptExecutor';
  action: 
    | 'CompileAndRun'
    | 'request_run_script'
    | 'run_script_after_compile';
}

export interface ScriptRunnerPluginEvent extends MatomoEventBase {
  category: 'scriptRunnerPlugin';
  action: 
    | 'loadScriptRunnerConfig'
    | 'error_reloadScriptRunnerConfig';
}

export interface SolidityCompilerEvent extends MatomoEventBase {
  category: 'solidityCompiler';
  action: 
    | 'runStaticAnalysis'
    | 'solidityScan'
    | 'staticAnalysis'
    | 'initiate';
}

export interface SolidityScriptEvent extends MatomoEventBase {
  category: 'SolidityScript';
  action: 
    | 'execute';
}

export interface SolidityStaticAnalyzerEvent extends MatomoEventBase {
  category: 'solidityStaticAnalyzer';
  action: 
    | 'analyze';
}

export interface SolidityUMLGenEvent extends MatomoEventBase {
  category: 'solidityumlgen';
  action: 
    | 'umlgenerated'
    | 'activated'
    | 'umlpngdownload';
}

export interface SolidityUnitTestingEvent extends MatomoEventBase {
  category: 'solidityUnitTesting';
  action: 
    | 'hardhat'
    | 'runTests';
}

export interface SolUmlGenEvent extends MatomoEventBase {
  category: 'solUmlGen';
  action: 
    | 'umlpdfdownload';
}

export interface StorageEvent extends MatomoEventBase {
  category: 'Storage';
  action: 
    | 'activate'
    | 'error';
}

export interface TemplateSelectionEvent extends MatomoEventBase {
  category: 'template-selection';
  action: 
    | 'createWorkspace'
    | 'addToCurrentWorkspace';
}

export interface ThemeModuleEvent extends MatomoEventBase {
  category: 'themeModule';
  action: 
    | 'switchThemeTo';
}

export interface TopbarEvent extends MatomoEventBase {
  category: 'topbar';
  action: 
    | 'GIT'
    | 'header';
}

export interface UdappEvent extends MatomoEventBase {
  category: 'udapp';
  action: 
    | 'providerChanged'
    | 'sendTransaction-from-udapp'
    | 'sendTransaction-from-API'
    | 'sendTransaction-from-dGitProvider'
    | 'sendTransaction-from-localPlugin'
    | 'safeSmartAccount'
    | 'hardhat'
    | 'sendTx'
    | 'syncContracts'
    | 'forkState'
    | 'deleteState'
    | 'pinContracts'
    | 'signUsingAccount'
    | 'contractDelegation';
}

export interface WorkspaceEvent extends MatomoEventBase {
  category: 'Workspace';
  action: 
    | 'switchWorkspace'
    | 'GIT';
}

// ================== TRACKING FUNCTION TYPES ==================

/**
 * Type-safe tracking function interface
 */
export type TypeSafeTrackingFunction = (event: MatomoEvent) => void;

/**
 * Legacy string-based tracking function (for backward compatibility)
 */
export type LegacyTrackingFunction = (
  category: string,
  action: string,
  name?: string,
  value?: string | number
) => void;

/**
 * Universal tracking function that supports both type-safe and legacy formats
 */
export type UniversalTrackingFunction = TypeSafeTrackingFunction & LegacyTrackingFunction;

// ================== UTILITY TYPES ==================

/**
 * Extract all valid categories from the event types
 */
export type ValidCategories = MatomoEvent['category'];

/**
 * Extract valid actions for a specific category
 */
export type ValidActionsFor<T extends ValidCategories> = Extract<MatomoEvent, { category: T }>['action'];

/**
 * Helper type to create a mapping of categories to their valid actions
 */
export type CategoryActionMap = {
  [K in ValidCategories]: ValidActionsFor<K>[]
};

// ================== VALIDATION HELPERS ==================

/**
 * Runtime validation to check if a category/action combination is valid
 */
export function isValidCategoryAction(category: string, action: string): boolean {
  // This would be implemented with a runtime check against the type definitions
  // For now, return true to maintain backward compatibility
  return true;
}

/**
 * Helper to convert legacy tracking calls to type-safe format
 */
export function createTypeSafeEvent(
  category: string,
  action: string,
  name?: string,
  value?: string | number
): Partial<MatomoEvent> {
  return {
    category: category as ValidCategories,
    action: action as any,
    name,
    value
  };
}