/**
 * Tools Events - Developer tools and utilities tracking events
 * 
 * This file contains events for debugger, editor, testing, and other developer tools.
 */

import { MatomoEventBase } from '../core/base-types';

export interface DebuggerEvent extends MatomoEventBase {
  category: 'debugger';
  action: 
    | 'start'
    | 'step'
    | 'breakpoint'
    | 'startDebugging';
}

export interface EditorEvent extends MatomoEventBase {
  category: 'editor';
  action: 
    | 'open'
    | 'save'
    | 'format'
    | 'autocomplete'
    | 'publishFromEditor'
    | 'runScript'
    | 'runScriptWithEnv'
    | 'clickRunFromEditor'
    | 'onDidPaste';
}

export interface SolidityUnitTestingEvent extends MatomoEventBase {
  category: 'solidityUnitTesting';
  action: 
    | 'runTest'
    | 'generateTest'
    | 'testPassed'
    | 'hardhat'
    | 'runTests';
}

export interface SolidityStaticAnalyzerEvent extends MatomoEventBase {
  category: 'solidityStaticAnalyzer';
  action: 
    | 'analyze'
    | 'warningFound';
}

export interface DesktopDownloadEvent extends MatomoEventBase {
  category: 'desktopDownload';
  action: 
    | 'download'
    | 'click';
}

export interface GridViewEvent extends MatomoEventBase {
  category: 'gridView';
  action: 
    | 'toggle'
    | 'resize'
    | 'rearrange'
    | 'filterWithTitle';
}

export interface XTERMEvent extends MatomoEventBase {
  category: 'xterm';
  action: 
    | 'terminal'
    | 'command';
}

export interface SolidityScriptEvent extends MatomoEventBase {
  category: 'solidityScript';
  action: 
    | 'execute'
    | 'deploy'
    | 'run'
    | 'compile';
}

export interface RemixGuideEvent extends MatomoEventBase {
  category: 'remixGuide';
  action: 
    | 'start'
    | 'step'
    | 'complete'
    | 'skip'
    | 'navigate'
    | 'playGuide';
}

export interface TemplateSelectionEvent extends MatomoEventBase {
  category: 'templateSelection';
  action: 
    | 'selectTemplate'
    | 'createWorkspace'
    | 'cancel'
    | 'addToCurrentWorkspace';
}

export interface ScriptExecutorEvent extends MatomoEventBase {
  category: 'scriptExecutor';
  action: 
    | 'execute'
    | 'deploy'
    | 'run'
    | 'compile'
    | 'compileAndRun';
}

/**
 * Debugger Events - Type-safe builders
 */
export const DebuggerEvents = {
  start: (name?: string, value?: string | number): DebuggerEvent => ({
    category: 'debugger',
    action: 'start',
    name,
    value,
    isClick: true // User starts debugging
  }),
  
  step: (name?: string, value?: string | number): DebuggerEvent => ({
    category: 'debugger',
    action: 'step',
    name,
    value,
    isClick: true // User steps through code
  }),
  
  breakpoint: (name?: string, value?: string | number): DebuggerEvent => ({
    category: 'debugger',
    action: 'breakpoint',
    name,
    value,
    isClick: true // User sets/removes breakpoint
  }),
  
  startDebugging: (name?: string, value?: string | number): DebuggerEvent => ({
    category: 'debugger',
    action: 'startDebugging',
    name,
    value,
    isClick: true // User starts debugging session
  })
} as const;

/**
 * Editor Events - Type-safe builders
 */
export const EditorEvents = {
  open: (name?: string, value?: string | number): EditorEvent => ({
    category: 'editor',
    action: 'open',
    name,
    value,
    isClick: true // User opens file
  }),
  
  save: (name?: string, value?: string | number): EditorEvent => ({
    category: 'editor',
    action: 'save',
    name,
    value,
    isClick: true // User saves file
  }),
  
  format: (name?: string, value?: string | number): EditorEvent => ({
    category: 'editor',
    action: 'format',
    name,
    value,
    isClick: true // User formats code
  }),
  
  autocomplete: (name?: string, value?: string | number): EditorEvent => ({
    category: 'editor',
    action: 'autocomplete',
    name,
    value,
    isClick: false // Autocomplete is often automatic
  }),
  
  publishFromEditor: (name?: string, value?: string | number): EditorEvent => ({
    category: 'editor',
    action: 'publishFromEditor',
    name,
    value,
    isClick: true // User publishes from editor
  }),
  
  runScript: (name?: string, value?: string | number): EditorEvent => ({
    category: 'editor',
    action: 'runScript',
    name,
    value,
    isClick: true // User runs script from editor
  }),
  
  runScriptWithEnv: (name?: string, value?: string | number): EditorEvent => ({
    category: 'editor',
    action: 'runScriptWithEnv',
    name,
    value,
    isClick: true // User runs script with specific environment
  }),
  
  clickRunFromEditor: (name?: string, value?: string | number): EditorEvent => ({
    category: 'editor',
    action: 'clickRunFromEditor',
    name,
    value,
    isClick: true // User clicks run button in editor
  }),
  
  onDidPaste: (name?: string, value?: string | number): EditorEvent => ({
    category: 'editor',
    action: 'onDidPaste',
    name,
    value,
    isClick: false // Paste event is system-triggered
  })
} as const;

/**
 * Solidity Unit Testing Events - Type-safe builders
 */
export const SolidityUnitTestingEvents = {
  runTest: (name?: string, value?: string | number): SolidityUnitTestingEvent => ({
    category: 'solidityUnitTesting',
    action: 'runTest',
    name,
    value,
    isClick: true // User runs test
  }),
  
  generateTest: (name?: string, value?: string | number): SolidityUnitTestingEvent => ({
    category: 'solidityUnitTesting',
    action: 'generateTest',
    name,
    value,
    isClick: true // User generates test
  }),
  
  testPassed: (name?: string, value?: string | number): SolidityUnitTestingEvent => ({
    category: 'solidityUnitTesting',
    action: 'testPassed',
    name,
    value,
    isClick: false // Test passing is a system event
  }),
  
  hardhat: (name?: string, value?: string | number): SolidityUnitTestingEvent => ({
    category: 'solidityUnitTesting',
    action: 'hardhat',
    name,
    value,
    isClick: true // User uses Hardhat features
  }),
  
  runTests: (name?: string, value?: string | number): SolidityUnitTestingEvent => ({
    category: 'solidityUnitTesting',
    action: 'runTests',
    name,
    value,
    isClick: true // User runs multiple tests
  })
} as const;

/**
 * Static Analyzer Events - Type-safe builders
 */
export const SolidityStaticAnalyzerEvents = {
  analyze: (name?: string, value?: string | number): SolidityStaticAnalyzerEvent => ({
    category: 'solidityStaticAnalyzer',
    action: 'analyze',
    name,
    value,
    isClick: true // User starts analysis
  }),
  
  warningFound: (name?: string, value?: string | number): SolidityStaticAnalyzerEvent => ({
    category: 'solidityStaticAnalyzer',
    action: 'warningFound',
    name,
    value,
    isClick: false // Warning detection is system event
  })
} as const;

/**
 * Desktop Download Events - Type-safe builders
 */
export const DesktopDownloadEvents = {
  download: (name?: string, value?: string | number): DesktopDownloadEvent => ({
    category: 'desktopDownload',
    action: 'download',
    name,
    value,
    isClick: true // User downloads desktop app
  }),
  
  click: (name?: string, value?: string | number): DesktopDownloadEvent => ({
    category: 'desktopDownload',
    action: 'click',
    name,
    value,
    isClick: true // User clicks on desktop download
  })
} as const;

/**
 * Terminal Events - Type-safe builders
 */
export const XTERMEvents = {
  terminal: (name?: string, value?: string | number): XTERMEvent => ({
    category: 'xterm',
    action: 'terminal',
    name,
    value,
    isClick: true // User interacts with terminal
  }),
  
  command: (name?: string, value?: string | number): XTERMEvent => ({
    category: 'xterm',
    action: 'command',
    name,
    value,
    isClick: false // Command execution is system event
  })
} as const;

/**
 * Solidity Script Events - Type-safe builders
 */
export const SolidityScriptEvents = {
  execute: (name?: string, value?: string | number): SolidityScriptEvent => ({
    category: 'solidityScript',
    action: 'execute',
    name,
    value,
    isClick: true // User executes Solidity script
  }),
  
  deploy: (name?: string, value?: string | number): SolidityScriptEvent => ({
    category: 'solidityScript',
    action: 'deploy',
    name,
    value,
    isClick: true // User deploys through script
  }),
  
  run: (name?: string, value?: string | number): SolidityScriptEvent => ({
    category: 'solidityScript',
    action: 'run',
    name,
    value,
    isClick: true // User runs script
  }),
  
  compile: (name?: string, value?: string | number): SolidityScriptEvent => ({
    category: 'solidityScript',
    action: 'compile',
    name,
    value,
    isClick: true // User compiles through script
  })
} as const;

/**
 * Remix Guide Events - Type-safe builders
 */
export const RemixGuideEvents = {
  start: (name?: string, value?: string | number): RemixGuideEvent => ({
    category: 'remixGuide',
    action: 'start',
    name,
    value,
    isClick: true // User starts guide
  }),
  
  step: (name?: string, value?: string | number): RemixGuideEvent => ({
    category: 'remixGuide',
    action: 'step',
    name,
    value,
    isClick: true // User navigates to guide step
  }),
  
  complete: (name?: string, value?: string | number): RemixGuideEvent => ({
    category: 'remixGuide',
    action: 'complete',
    name,
    value,
    isClick: true // User completes guide
  }),
  
  skip: (name?: string, value?: string | number): RemixGuideEvent => ({
    category: 'remixGuide',
    action: 'skip',
    name,
    value,
    isClick: true // User skips guide step
  }),
  
  navigate: (name?: string, value?: string | number): RemixGuideEvent => ({
    category: 'remixGuide',
    action: 'navigate',
    name,
    value,
    isClick: true // User navigates within guide
  }),
  
  playGuide: (name?: string, value?: string | number): RemixGuideEvent => ({
    category: 'remixGuide',
    action: 'playGuide',
    name,
    value,
    isClick: true // User plays/starts a specific guide
  })
} as const;

/**
 * Template Selection Events - Type-safe builders
 */
export const TemplateSelectionEvents = {
  selectTemplate: (name?: string, value?: string | number): TemplateSelectionEvent => ({
    category: 'templateSelection',
    action: 'selectTemplate',
    name,
    value,
    isClick: true // User selects a template
  }),
  
  createWorkspace: (name?: string, value?: string | number): TemplateSelectionEvent => ({
    category: 'templateSelection',
    action: 'createWorkspace',
    name,
    value,
    isClick: true // User creates workspace from template
  }),
  
  cancel: (name?: string, value?: string | number): TemplateSelectionEvent => ({
    category: 'templateSelection',
    action: 'cancel',
    name,
    value,
    isClick: true // User cancels template selection
  }),
  
  addToCurrentWorkspace: (name?: string, value?: string | number): TemplateSelectionEvent => ({
    category: 'templateSelection',
    action: 'addToCurrentWorkspace',
    name,
    value,
    isClick: true // User adds template to current workspace
  })
} as const;

/**
 * Script Executor Events - Type-safe builders
 */
export const ScriptExecutorEvents = {
  execute: (name?: string, value?: string | number): ScriptExecutorEvent => ({
    category: 'scriptExecutor',
    action: 'execute',
    name,
    value,
    isClick: true // User executes script
  }),
  
  deploy: (name?: string, value?: string | number): ScriptExecutorEvent => ({
    category: 'scriptExecutor',
    action: 'deploy',
    name,
    value,
    isClick: true // User deploys through script executor
  }),
  
  run: (name?: string, value?: string | number): ScriptExecutorEvent => ({
    category: 'scriptExecutor',
    action: 'run',
    name,
    value,
    isClick: true // User runs script executor
  }),
  
  compile: (name?: string, value?: string | number): ScriptExecutorEvent => ({
    category: 'scriptExecutor',
    action: 'compile',
    name,
    value,
    isClick: true // User compiles through script executor
  }),
  
  compileAndRun: (name?: string, value?: string | number): ScriptExecutorEvent => ({
    category: 'scriptExecutor',
    action: 'compileAndRun',
    name,
    value,
    isClick: true // User compiles and runs script
  })
} as const;

/**
 * Grid View Events - Type-safe builders
 */
export const GridViewEvents = {
  toggle: (name?: string, value?: string | number): GridViewEvent => ({
    category: 'gridView',
    action: 'toggle',
    name,
    value,
    isClick: true // User toggles grid view
  }),
  
  resize: (name?: string, value?: string | number): GridViewEvent => ({
    category: 'gridView',
    action: 'resize',
    name,
    value,
    isClick: false // User resizes grid view
  }),
  
  rearrange: (name?: string, value?: string | number): GridViewEvent => ({
    category: 'gridView',
    action: 'rearrange',
    name,
    value,
    isClick: true // User rearranges grid view items
  }),
  
  filterWithTitle: (name?: string, value?: string | number): GridViewEvent => ({
    category: 'gridView',
    action: 'filterWithTitle',
    name,
    value,
    isClick: true // User filters grid view with title
  })
} as const;

/**
 * Solidity UML Generation Events - Type-safe builders
 */
export interface SolidityUMLGenEvent extends MatomoEventBase {
  category: 'solidityUMLGen';
  action:
    | 'umlpngdownload'
    | 'umlpdfdownload'
    | 'generate'
    | 'export'
    | 'umlgenerated'
    | 'activated';
}

export const SolidityUMLGenEvents = {
  umlpngdownload: (name?: string, value?: string | number): SolidityUMLGenEvent => ({
    category: 'solidityUMLGen',
    action: 'umlpngdownload',
    name,
    value,
    isClick: true // User downloads UML as PNG
  }),
  
  umlpdfdownload: (name?: string, value?: string | number): SolidityUMLGenEvent => ({
    category: 'solidityUMLGen',
    action: 'umlpdfdownload',
    name,
    value,
    isClick: true // User downloads UML as PDF
  }),
  
  generate: (name?: string, value?: string | number): SolidityUMLGenEvent => ({
    category: 'solidityUMLGen',
    action: 'generate',
    name,
    value,
    isClick: true // User generates UML diagram
  }),
  
  export: (name?: string, value?: string | number): SolidityUMLGenEvent => ({
    category: 'solidityUMLGen',
    action: 'export',
    name,
    value,
    isClick: true // User exports UML diagram
  }),
  
  umlgenerated: (name?: string, value?: string | number): SolidityUMLGenEvent => ({
    category: 'solidityUMLGen',
    action: 'umlgenerated',
    name,
    value,
    isClick: false // UML generation completion is system event
  }),
  
  activated: (name?: string, value?: string | number): SolidityUMLGenEvent => ({
    category: 'solidityUMLGen',
    action: 'activated',
    name,
    value,
    isClick: true // User activates UML generation plugin
  })
} as const;

// Alias for compatibility
export const SolUmlGenEvents = SolidityUMLGenEvents;

/**
 * Circuit Compiler Events - Type-safe builders
 */
export interface CircuitCompilerEvent extends MatomoEventBase {
  category: 'circuitCompiler';
  action:
    | 'compile'
    | 'generateProof'
    | 'error'
    | 'generateR1cs'
    | 'computeWitness'
    | 'runSetupAndExport';
}

export const CircuitCompilerEvents = {
  compile: (name?: string, value?: string | number): CircuitCompilerEvent => ({
    category: 'circuitCompiler',
    action: 'compile',
    name,
    value,
    isClick: true // User compiles circuit
  }),
  
  generateProof: (name?: string, value?: string | number): CircuitCompilerEvent => ({
    category: 'circuitCompiler',
    action: 'generateProof',
    name,
    value,
    isClick: true // User generates proof
  }),
  
  error: (name?: string, value?: string | number): CircuitCompilerEvent => ({
    category: 'circuitCompiler',
    action: 'error',
    name,
    value,
    isClick: false // Compiler errors are system events
  }),
  
  generateR1cs: (name?: string, value?: string | number): CircuitCompilerEvent => ({
    category: 'circuitCompiler',
    action: 'generateR1cs',
    name,
    value,
    isClick: true // User generates R1CS
  }),
  
  computeWitness: (name?: string, value?: string | number): CircuitCompilerEvent => ({
    category: 'circuitCompiler',
    action: 'computeWitness',
    name,
    value,
    isClick: true // User computes witness
  }),
  
  runSetupAndExport: (name?: string, value?: string | number): CircuitCompilerEvent => ({
    category: 'circuitCompiler',
    action: 'runSetupAndExport',
    name,
    value,
    isClick: true // User runs setup and export
  })
} as const;

/**
 * Contract Verification Events - Type-safe builders
 */
export interface ContractVerificationEvent extends MatomoEventBase {
  category: 'contractVerification';
  action:
    | 'verify'
    | 'lookup';
}

export const ContractVerificationEvents = {
  verify: (name?: string, value?: string | number): ContractVerificationEvent => ({
    category: 'contractVerification',
    action: 'verify',
    name,
    value,
    isClick: true // User initiates contract verification
  }),
  
  lookup: (name?: string, value?: string | number): ContractVerificationEvent => ({
    category: 'contractVerification',
    action: 'lookup',
    name,
    value,
    isClick: true // User looks up contract verification
  })
} as const;

/**
 * Learneth Events - Type-safe builders
 */
export interface LearnethEvent extends MatomoEventBase {
  category: 'learneth';
  action:
    | 'start'
    | 'complete'
    | 'lesson'
    | 'tutorial'
    | 'error'
    | 'displayFile'
    | 'displayFileError'
    | 'testStep'
    | 'testStepError'
    | 'showAnswer'
    | 'showAnswerError'
    | 'testSolidityCompiler'
    | 'testSolidityCompilerError';
}

export const LearnethEvents = {
  start: (name?: string, value?: string | number): LearnethEvent => ({
    category: 'learneth',
    action: 'start',
    name,
    value,
    isClick: true // User starts learning session
  }),
  
  complete: (name?: string, value?: string | number): LearnethEvent => ({
    category: 'learneth',
    action: 'complete',
    name,
    value,
    isClick: false // Lesson completion is system event
  }),
  
  lesson: (name?: string, value?: string | number): LearnethEvent => ({
    category: 'learneth',
    action: 'lesson',
    name,
    value,
    isClick: true // User interacts with lesson
  }),
  
  tutorial: (name?: string, value?: string | number): LearnethEvent => ({
    category: 'learneth',
    action: 'tutorial',
    name,
    value,
    isClick: true // User interacts with tutorial
  }),
  
  error: (name?: string, value?: string | number): LearnethEvent => ({
    category: 'learneth',
    action: 'error',
    name,
    value,
    isClick: false // Learning errors are system events
  }),
  
  displayFile: (name?: string, value?: string | number): LearnethEvent => ({
    category: 'learneth',
    action: 'displayFile',
    name,
    value,
    isClick: true // User displays file in learning context
  }),
  
  displayFileError: (name?: string, value?: string | number): LearnethEvent => ({
    category: 'learneth',
    action: 'displayFileError',
    name,
    value,
    isClick: false // Error displaying file
  }),
  
  testStep: (name?: string, value?: string | number): LearnethEvent => ({
    category: 'learneth',
    action: 'testStep',
    name,
    value,
    isClick: true // User executes test step
  }),
  
  testStepError: (name?: string, value?: string | number): LearnethEvent => ({
    category: 'learneth',
    action: 'testStepError',
    name,
    value,
    isClick: false // Error in test step
  }),
  
  showAnswer: (name?: string, value?: string | number): LearnethEvent => ({
    category: 'learneth',
    action: 'showAnswer',
    name,
    value,
    isClick: true // User shows answer
  }),
  
  showAnswerError: (name?: string, value?: string | number): LearnethEvent => ({
    category: 'learneth',
    action: 'showAnswerError',
    name,
    value,
    isClick: false // Error showing answer
  }),
  
  testSolidityCompiler: (name?: string, value?: string | number): LearnethEvent => ({
    category: 'learneth',
    action: 'testSolidityCompiler',
    name,
    value,
    isClick: true // User tests Solidity compiler
  }),
  
  testSolidityCompilerError: (name?: string, value?: string | number): LearnethEvent => ({
    category: 'learneth',
    action: 'testSolidityCompilerError',
    name,
    value,
    isClick: false // Error testing Solidity compiler
  })
} as const;

/**
 * Script Runner Plugin Events - Type-safe builders
 */
export interface ScriptRunnerPluginEvent extends MatomoEventBase {
  category: 'scriptRunnerPlugin';
  action:
    | 'loadScriptRunnerConfig'
    | 'error_reloadScriptRunnerConfig'
    | 'executeScript'
    | 'configChanged';
}

export const ScriptRunnerPluginEvents = {
  loadScriptRunnerConfig: (name?: string, value?: string | number): ScriptRunnerPluginEvent => ({
    category: 'scriptRunnerPlugin',
    action: 'loadScriptRunnerConfig',
    name,
    value,
    isClick: true // User loads script runner config
  }),
  
  error_reloadScriptRunnerConfig: (name?: string, value?: string | number): ScriptRunnerPluginEvent => ({
    category: 'scriptRunnerPlugin',
    action: 'error_reloadScriptRunnerConfig',
    name,
    value,
    isClick: false // Error reloading script runner config
  }),
  
  executeScript: (name?: string, value?: string | number): ScriptRunnerPluginEvent => ({
    category: 'scriptRunnerPlugin',
    action: 'executeScript',
    name,
    value,
    isClick: true // User executes script
  }),
  
  configChanged: (name?: string, value?: string | number): ScriptRunnerPluginEvent => ({
    category: 'scriptRunnerPlugin',
    action: 'configChanged',
    name,
    value,
    isClick: true // User changes script runner config
  })
} as const;