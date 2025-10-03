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
  isClick?: boolean; // Pre-defined by event builders - distinguishes click events from other interactions
}

// Type-Safe Constants - Access categories and actions via types instead of string literals
export const MatomoCategories = {
  FILE_EXPLORER: 'fileExplorer' as const,
  COMPILER: 'compiler' as const, 
  HOME_TAB: 'hometab' as const,
  AI: 'AI' as const,
  UDAPP: 'udapp' as const,
  GIT: 'git' as const,
  WORKSPACE: 'workspace' as const,
  XTERM: 'xterm' as const,
  LAYOUT: 'layout' as const,
  REMIX_AI: 'remixAI' as const,
  SETTINGS: 'settings' as const,
  SOLIDITY: 'solidity' as const
}

export const FileExplorerActions = {
  CONTEXT_MENU: 'contextMenu' as const,
  WORKSPACE_MENU: 'workspaceMenu' as const, 
  FILE_ACTION: 'fileAction' as const,
  DRAG_DROP: 'dragDrop' as const
}

export const CompilerActions = {
  COMPILED: 'compiled' as const,
  ERROR: 'error' as const,
  WARNING: 'warning' as const
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
  | GitEvent
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
    | 'downloadDesktopApp'
    | 'click';
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

export interface GitEvent extends MatomoEventBase {
  category: 'git';
  action: 
    | 'INIT'
    | 'COMMIT' 
    | 'PUSH'
    | 'PULL'
    | 'ADDREMOTE'
    | 'RMREMOTE'
    | 'CLONE'
    | 'FETCH'
    | 'ADD'
    | 'ADD_ALL'
    | 'RM'
    | 'CHECKOUT'
    | 'CHECKOUT_LOCAL_BRANCH'
    | 'CHECKOUT_REMOTE_BRANCH'
    | 'DIFF'
    | 'BRANCH'
    | 'CREATEBRANCH'
    | 'GET_GITHUB_DEVICECODE'
    | 'GET_GITHUB_DEVICECODE_SUCCESS'
    | 'GET_GITHUB_DEVICECODE_FAIL'
    | 'DEVICE_CODE_AUTH'
    | 'DEVICE_CODE_AUTH_SUCCESS'
    | 'DEVICE_CODE_AUTH_FAIL'
    | 'CONNECT_TO_GITHUB'
    | 'CONNECT_TO_GITHUB_BUTTON'
    | 'DISCONNECT_FROM_GITHUB'
    | 'SAVE_MANUAL_GITHUB_CREDENTIALS'
    | 'LOAD_REPOSITORIES_FROM_GITHUB'
    | 'COPY_GITHUB_DEVICE_CODE'
    | 'CONNECT_TO_GITHUB_SUCCESS'
    | 'CONNECT_TO_GITHUB_FAIL'
    | 'OPEN_LOGIN_MODAL'
    | 'LOGIN_MODAL_FAIL'
    | 'OPEN_PANEL'
    | 'ADD_MANUAL_REMOTE'
    | 'SET_DEFAULT_REMOTE'
    | 'SET_LOCAL_BRANCH_IN_COMMANDS'
    | 'SET_REMOTE_IN_COMMANDS'
    | 'REFRESH'
    | 'ERROR'
    | 'LOAD_GITHUB_USER_SUCCESS';
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

export interface XTERMEvent extends MatomoEventBase {
  category: 'xterm';
  action: 
    | 'terminal';
}

export interface LayoutEvent extends MatomoEventBase {
  category: 'layout';
  action: 
    | 'pinToRight'
    | 'pinToLeft';
}

export interface SettingsEvent extends MatomoEventBase {
  category: 'settings';
  action: 
    | 'change';
}

export interface SolidityEvent extends MatomoEventBase {
  category: 'solidity';
  action: 
    | 'compile'
    | 'analyze';
}

export interface TabEvent extends MatomoEventBase {
  category: 'tab';
  action: 
    | 'switch'
    | 'close'
    | 'pin';
}

export interface TestRunnerEvent extends MatomoEventBase {
  category: 'testRunner';
  action: 
    | 'runTests'
    | 'createTest';
}

export interface VMEvent extends MatomoEventBase {
  category: 'vm';
  action: 
    | 'deploy'
    | 'call';
}

export interface WalletConnectEvent extends MatomoEventBase {
  category: 'walletConnect';
  action: 
    | 'connect'
    | 'disconnect';
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

// ================== TYPED EVENT BUILDERS ==================

/**
 * File Explorer Events - Type-safe builders
 */
export const FileExplorerEvents = {
  contextMenu: (name?: string, value?: string | number): FileExplorerEvent => ({
    category: 'fileExplorer',
    action: 'contextMenu',
    name,
    value,
    isClick: true // Context menu selections are click interactions
  }),
  
  workspaceMenu: (name?: string, value?: string | number): FileExplorerEvent => ({
    category: 'fileExplorer',
    action: 'workspaceMenu', 
    name,
    value,
    isClick: true // Workspace menu selections are click interactions
  }),
  
  fileAction: (name?: string, value?: string | number): FileExplorerEvent => ({
    category: 'fileExplorer',
    action: 'fileAction',
    name,
    value,
    isClick: true // File actions like double-click to open are click interactions
  }),
  
  deleteKey: (name?: string, value?: string | number): FileExplorerEvent => ({
    category: 'fileExplorer',
    action: 'deleteKey',
    name,
    value,
    isClick: false // Keyboard delete key is not a click interaction
  }),
  
  osxDeleteKey: (name?: string, value?: string | number): FileExplorerEvent => ({
    category: 'fileExplorer',
    action: 'osxDeleteKey',
    name,
    value,
    isClick: false // macOS delete key is not a click interaction
  }),
  
  f2ToRename: (name?: string, value?: string | number): FileExplorerEvent => ({
    category: 'fileExplorer',
    action: 'f2ToRename',
    name,
    value,
    isClick: false // F2 key to rename is not a click interaction
  }),
  
  copyCombo: (name?: string, value?: string | number): FileExplorerEvent => ({
    category: 'fileExplorer',
    action: 'copyCombo',
    name,
    value,
    isClick: false // Ctrl+C/Cmd+C keyboard shortcut is not a click interaction
  }),
  
  cutCombo: (name?: string, value?: string | number): FileExplorerEvent => ({
    category: 'fileExplorer',
    action: 'cutCombo',
    name,
    value,
    isClick: false // Ctrl+X/Cmd+X keyboard shortcut is not a click interaction
  }),
  
  pasteCombo: (name?: string, value?: string | number): FileExplorerEvent => ({
    category: 'fileExplorer',
    action: 'pasteCombo',
    name,
    value,
    isClick: false // Ctrl+V/Cmd+V keyboard shortcut is not a click interaction
  })
} as const;

/**
 * Compiler Events - Type-safe builders  
 */
export const CompilerEvents = {
  compiled: (name?: string, value?: string | number): CompilerEvent => ({
    category: 'compiler',
    action: 'compiled',
    name,
    value,
    isClick: false // Compilation completion is a system event, not a click
  }),
  
  runCompile: (name?: string, value?: string | number): CompilerEvent => ({
    category: 'compiler', 
    action: 'runCompile',
    name,
    value,
    isClick: true // User clicks compile button to trigger compilation
  }),
  
  compilerDetails: (name?: string, value?: string | number): CompilerEvent => ({
    category: 'compiler',
    action: 'compilerDetails', 
    name,
    value,
    isClick: true // User clicks to view compiler details
  })
} as const;

/**
 * Home Tab Events - Type-safe builders
 */
export const HomeTabEvents = {
  titleCard: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'titleCard',
    name,
    value,
    isClick: true // User clicks on title cards in home tab
  }),
  
  filesSection: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'filesSection',
    name,
    value,
    isClick: true // User clicks on items in files section
  }),
  
  header: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'header',
    name,
    value,
    isClick: true // User clicks on header elements
  }),
  
  featuredSection: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'featuredSection',
    name,
    value,
    isClick: true // User clicks on featured section items
  }),
  
  scamAlert: (name?: string, value?: string | number): HomeTabEvent => ({
    category: 'hometab',
    action: 'scamAlert',
    name,
    value,
    isClick: true // User clicks on scam alert actions
  })
} as const;

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
  
  vulnerabilityCheck: (name?: string, value?: string | number): AIEvent => ({
    category: 'ai',
    action: 'vulnerability_check_pasted_code',
    name,
    value,
    isClick: true // User clicks to request AI vulnerability check
  })
} as const;

/**
 * Solidity Compiler Events - Type-safe builders
 */
export const SolidityCompilerEvents = {
  runStaticAnalysis: (name?: string, value?: string | number): SolidityCompilerEvent => ({
    category: 'solidityCompiler',
    action: 'runStaticAnalysis',
    name,
    value,
    isClick: true // User clicks to run static analysis
  }),
  
  solidityScan: (name?: string, value?: string | number): SolidityCompilerEvent => ({
    category: 'solidityCompiler',
    action: 'solidityScan',
    name,
    value,
    isClick: true // User interacts with Solidity scan features
  }),
  
  staticAnalysis: (name?: string, value?: string | number): SolidityCompilerEvent => ({
    category: 'solidityCompiler',
    action: 'staticAnalysis',
    name,
    value,
    isClick: false // Analysis completion is a system event
  }),
  
  initiate: (name?: string, value?: string | number): SolidityCompilerEvent => ({
    category: 'solidityCompiler',
    action: 'initiate',
    name,
    value,
    isClick: false // System initialization event
  })
} as const;

/**
 * Workspace Events - Type-safe builders
 */
export const WorkspaceEvents = {
  switchWorkspace: (name?: string, value?: string | number): WorkspaceEvent => ({
    category: 'Workspace',
    action: 'switchWorkspace',
    name,
    value,
    isClick: true // User clicks to switch workspace
  }),
  
  GIT: (name?: string, value?: string | number): WorkspaceEvent => ({
    category: 'Workspace',
    action: 'GIT',
    name,
    value,
    isClick: true // User clicks Git-related actions in workspace
  })
} as const;

/**
 * Git Events - Type-safe builders
 */
export const GitEvents = {
  INIT: (name?: string, value?: string | number): GitEvent => ({
    category: 'git',
    action: 'INIT',
    name,
    value,
    isClick: true // User clicks to initialize git
  }),
  
  COMMIT: (name?: string, value?: string | number): GitEvent => ({
    category: 'git',
    action: 'COMMIT',
    name,
    value,
    isClick: true // User clicks to commit changes
  }),
  
  PUSH: (name?: string, value?: string | number): GitEvent => ({
    category: 'git',
    action: 'PUSH',
    name,
    value,
    isClick: true // User clicks to push changes
  }),
  
  PULL: (name?: string, value?: string | number): GitEvent => ({
    category: 'git',
    action: 'PULL',
    name,
    value,
    isClick: true // User clicks to pull changes
  }),
  
  CLONE: (name?: string, value?: string | number): GitEvent => ({
    category: 'git',
    action: 'CLONE',
    name,
    value,
    isClick: true // User clicks to clone repository
  }),
  
  CHECKOUT: (name?: string, value?: string | number): GitEvent => ({
    category: 'git',
    action: 'CHECKOUT',
    name,
    value,
    isClick: true // User clicks to checkout branch
  }),
  
  BRANCH: (name?: string, value?: string | number): GitEvent => ({
    category: 'git',
    action: 'BRANCH',
    name,
    value,
    isClick: true // User clicks branch-related actions
  }),
  
  OPEN_PANEL: (name?: string, value?: string | number): GitEvent => ({
    category: 'git',
    action: 'OPEN_PANEL',
    name,
    value,
    isClick: true // User clicks to open git panel
  }),
  
  CONNECT_TO_GITHUB: (name?: string, value?: string | number): GitEvent => ({
    category: 'git',
    action: 'CONNECT_TO_GITHUB',
    name,
    value,
    isClick: true // User clicks to connect to GitHub
  })
} as const;

/**
 * Udapp Events - Type-safe builders
 */
export const UdappEvents = {
  providerChanged: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'providerChanged',
    name,
    value,
    isClick: true // User clicks to change provider
  }),
  
  sendTransaction: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'sendTransaction-from-udapp',
    name,
    value,
    isClick: true // User clicks to send transaction
  }),
  
  hardhat: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'hardhat',
    name,
    value,
    isClick: true // User clicks Hardhat-related actions
  }),
  
  sendTx: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'sendTx',
    name,
    value,
    isClick: true // User clicks to send transaction
  }),
  
  syncContracts: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'syncContracts',
    name,
    value,
    isClick: true // User clicks to sync contracts
  }),
  
  pinContracts: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'pinContracts',
    name,
    value,
    isClick: true // User clicks to pin/unpin contracts
  }),
  
  safeSmartAccount: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'safeSmartAccount',
    name,
    value,
    isClick: true // User interacts with Safe Smart Account features
  }),
  
  contractDelegation: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'contractDelegation',
    name,
    value,
    isClick: true // User interacts with contract delegation
  }),
  
  signUsingAccount: (name?: string, value?: string | number): UdappEvent => ({
    category: 'udapp',
    action: 'signUsingAccount',
    name,
    value,
    isClick: false // Signing action is typically system-triggered
  })
} as const;

/**
 * Editor Events - Type-safe builders
 */
export const EditorEvents = {
  publishFromEditor: (name?: string, value?: string | number): EditorEvent => ({
    category: 'editor',
    action: 'publishFromEditor',
    name,
    value,
    isClick: true // User clicks to publish from editor
  }),
  
  runScript: (name?: string, value?: string | number): EditorEvent => ({
    category: 'editor',
    action: 'runScript',
    name,
    value,
    isClick: true // User clicks to run script
  }),
  
  runScriptWithEnv: (name?: string, value?: string | number): EditorEvent => ({
    category: 'editor',
    action: 'runScriptWithEnv',
    name,
    value,
    isClick: true // User clicks to run script with environment
  }),
  
  clickRunFromEditor: (name?: string, value?: string | number): EditorEvent => ({
    category: 'editor',
    action: 'clickRunFromEditor',
    name,
    value,
    isClick: true // User clicks run button from editor
  }),
  
  onDidPaste: (name?: string, value?: string | number): EditorEvent => ({
    category: 'editor',
    action: 'onDidPaste',
    name,
    value,
    isClick: false // Paste action is not a click
  })
} as const;

/**
 * Layout Events - Type-safe builders
 */
export const LayoutEvents = {
  pinToRight: (name?: string, value?: string | number): PluginPanelEvent => ({
    category: 'PluginPanel',
    action: 'pinToRight',
    name,
    value,
    isClick: true // User clicks to pin panel to right
  }),
  
  pinToLeft: (name?: string, value?: string | number): PluginPanelEvent => ({
    category: 'PluginPanel',
    action: 'pinToLeft',
    name,
    value,
    isClick: true // User clicks to pin panel to left
  })
} as const;

/**
 * Settings Events - Type-safe builders
 */
export const SettingsEvents = {
  switchThemeTo: (name?: string, value?: string | number): ThemeModuleEvent => ({
    category: 'themeModule',
    action: 'switchThemeTo',
    name,
    value,
    isClick: true // User clicks to switch theme
  }),
  
  switchTo: (name?: string, value?: string | number): LocaleModuleEvent => ({
    category: 'localeModule',
    action: 'switchTo',
    name,
    value,
    isClick: true // User clicks to switch locale
  })
} as const;

/**
 * Template Selection Events - Type-safe builders
 */
export const TemplateSelectionEvents = {
  createWorkspace: (name?: string, value?: string | number): TemplateSelectionEvent => ({
    category: 'template-selection',
    action: 'createWorkspace',
    name,
    value,
    isClick: true // User clicks to create workspace from template
  }),
  
  addToCurrentWorkspace: (name?: string, value?: string | number): TemplateSelectionEvent => ({
    category: 'template-selection',
    action: 'addToCurrentWorkspace',
    name,
    value,
    isClick: true // User clicks to add template to current workspace
  })
} as const;

/**
 * Plugin Manager Events - Type-safe builders
 */
export const PluginManagerEvents = {
  activate: (name?: string, value?: string | number): PluginManagerEvent => ({
    category: 'pluginManager',
    action: 'activate',
    name,
    value,
    isClick: true // User clicks to activate plugin
  }),
  
  deactivate: (name?: string, value?: string | number): PluginManagerEvent => ({
    category: 'pluginManager',
    action: 'deactivate',
    name,
    value,
    isClick: true // User clicks to deactivate plugin
  })
} as const;

/**
 * Terminal Events - Type-safe builders
 */
export const TerminalEvents = {
  terminal: (name?: string, value?: string | number): XTERMEvent => ({
    category: 'xterm',
    action: 'terminal',
    name,
    value,
    isClick: false // Terminal events are typically system events
  })
} as const;

/**
 * TopBar Events - Type-safe builders
 */
export const TopBarEvents = {
  GIT: (name?: string, value?: string | number): TopbarEvent => ({
    category: 'topbar',
    action: 'GIT',
    name,
    value,
    isClick: true // User clicks Git actions in topbar
  }),
  
  header: (name?: string, value?: string | number): TopbarEvent => ({
    category: 'topbar',
    action: 'header',
    name,
    value,
    isClick: true // User clicks header items in topbar
  })
} as const;

/**
 * Landing Page Events - Type-safe builders
 */
export const LandingPageEvents = {
  MatomoAIModal: (name?: string, value?: string | number): LandingPageEvent => ({
    category: 'landingPage',
    action: 'MatomoAIModal',
    name,
    value,
    isClick: true // User interacts with Matomo AI modal
  })
} as const;

/**
 * Solidity Unit Testing Events - Type-safe builders
 */
export const SolidityUnitTestingEvents = {
  hardhat: (name?: string, value?: string | number): SolidityUnitTestingEvent => ({
    category: 'solidityUnitTesting',
    action: 'hardhat',
    name,
    value,
    isClick: true // User clicks Hardhat-related testing actions
  }),
  
  runTests: (name?: string, value?: string | number): SolidityUnitTestingEvent => ({
    category: 'solidityUnitTesting',
    action: 'runTests',
    name,
    value,
    isClick: true // User clicks to run tests
  })
} as const;

/**
 * Plugin Panel Events - Type-safe builders
 */
export const PluginPanelEvents = {
  pinToRight: (name?: string, value?: string | number): PluginPanelEvent => ({
    category: 'PluginPanel',
    action: 'pinToRight',
    name,
    value,
    isClick: true // User clicks to pin plugin to right panel
  }),
  
  pinToLeft: (name?: string, value?: string | number): PluginPanelEvent => ({
    category: 'PluginPanel',
    action: 'pinToLeft',
    name,
    value,
    isClick: true // User clicks to pin plugin to left panel
  })
} as const;

/**
 * Desktop Download Events - Type-safe builders
 */
export const DesktopDownloadEvents = {
  downloadDesktopApp: (name?: string, value?: string | number): DesktopDownloadEvent => ({
    category: 'desktopDownload',
    action: 'downloadDesktopApp',
    name,
    value,
    isClick: true // User clicks to download desktop app
  }),
  
  click: (name?: string, value?: string | number): DesktopDownloadEvent => ({
    category: 'desktopDownload',
    action: 'click',
    name,
    value,
    isClick: true // User clicks desktop download related items
  })
} as const;

/**
 * Solidity Static Analyzer Events - Type-safe builders
 */
export const SolidityStaticAnalyzerEvents = {
  analyze: (name?: string, value?: string | number): SolidityStaticAnalyzerEvent => ({
    category: 'solidityStaticAnalyzer',
    action: 'analyze',
    name,
    value,
    isClick: true // User triggers static analysis
  })
} as const;

/**
 * Universal Event Builder - For any category/action combination
 * Use this when you need to create events for categories not covered by specific builders
 */
export const UniversalEvents = {
  create: <T extends ValidCategories>(
    category: T,
    action: ValidActionsFor<T>,
    name?: string,
    value?: string | number,
    isClick: boolean = true
  ): Extract<MatomoEvent, { category: T }> => ({
    category,
    action,
    name,
    value,
    isClick
  }) as Extract<MatomoEvent, { category: T }>
} as const;