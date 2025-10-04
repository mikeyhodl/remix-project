/**
 * Compiler Events - Solidity compilation and related tracking events
 * 
 * This file contains all compilation-related Matomo events.
 */

import { MatomoEventBase } from '../core/base-types';

export interface CompilerEvent extends MatomoEventBase {
  category: 'compiler';
  action: 
    | 'compiled'
    | 'error' 
    | 'warning'
    | 'compilerDetails';
}

export interface SolidityCompilerEvent extends MatomoEventBase {
  category: 'solidityCompiler';
  action: 
    | 'runStaticAnalysis'
    | 'solidityScan'
    | 'staticAnalysis'
    | 'initiate';
}

export interface CompilerContainerEvent extends MatomoEventBase {
  category: 'compilerContainer';
  action: 
    | 'compile'
    | 'compileAndRun'
    | 'autoCompile'
    | 'includeNightlies'
    | 'hideWarnings'
    | 'optimization'
    | 'useConfigurationFile'
    | 'compilerSelection'
    | 'languageSelection'
    | 'evmVersionSelection'
    | 'addCustomCompiler'
    | 'viewLicense'
    | 'advancedConfigToggle';
}

/**
 * Compiler Events - Type-safe builders
 */
export const CompilerEvents = {
  compiled: (name?: string, value?: string | number): CompilerEvent => ({
    category: 'compiler',
    action: 'compiled',
    name,
    value,
    isClick: false // Compilation is typically a system event
  }),
  
  error: (name?: string, value?: string | number): CompilerEvent => ({
    category: 'compiler',
    action: 'error',
    name,
    value,
    isClick: false // Error is a system event
  }),
  
  warning: (name?: string, value?: string | number): CompilerEvent => ({
    category: 'compiler',
    action: 'warning',
    name,
    value,
    isClick: false // Warning is a system event
  }),
  
  compilerDetails: (name?: string, value?: string | number): CompilerEvent => ({
    category: 'compiler',
    action: 'compilerDetails',
    name,
    value,
    isClick: true // User clicks to view/download compiler details
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
 * Compiler Container Events - Type-safe builders for UI interactions
 */
export const CompilerContainerEvents = {
  compile: (name?: string, value?: string | number): CompilerContainerEvent => ({
    category: 'compilerContainer',
    action: 'compile',
    name,
    value,
    isClick: true // User clicks compile button
  }),
  
  compileAndRun: (name?: string, value?: string | number): CompilerContainerEvent => ({
    category: 'compilerContainer',
    action: 'compileAndRun',
    name,
    value,
    isClick: true // User clicks compile and run button
  }),
  
  autoCompile: (name?: string, value?: string | number): CompilerContainerEvent => ({
    category: 'compilerContainer',
    action: 'autoCompile',
    name,
    value,
    isClick: true // User toggles auto-compile checkbox
  }),
  
  includeNightlies: (name?: string, value?: string | number): CompilerContainerEvent => ({
    category: 'compilerContainer',
    action: 'includeNightlies',
    name,
    value,
    isClick: true // User toggles include nightly builds checkbox
  }),
  
  hideWarnings: (name?: string, value?: string | number): CompilerContainerEvent => ({
    category: 'compilerContainer',
    action: 'hideWarnings',
    name,
    value,
    isClick: true // User toggles hide warnings checkbox
  }),
  
  optimization: (name?: string, value?: string | number): CompilerContainerEvent => ({
    category: 'compilerContainer',
    action: 'optimization',
    name,
    value,
    isClick: true // User changes optimization settings
  }),
  
  useConfigurationFile: (name?: string, value?: string | number): CompilerContainerEvent => ({
    category: 'compilerContainer',
    action: 'useConfigurationFile',
    name,
    value,
    isClick: true // User toggles use configuration file checkbox
  }),
  
  compilerSelection: (name?: string, value?: string | number): CompilerContainerEvent => ({
    category: 'compilerContainer',
    action: 'compilerSelection',
    name,
    value,
    isClick: true // User selects different compiler version
  }),
  
  languageSelection: (name?: string, value?: string | number): CompilerContainerEvent => ({
    category: 'compilerContainer',
    action: 'languageSelection',
    name,
    value,
    isClick: true // User changes language (Solidity/Yul)
  }),
  
  evmVersionSelection: (name?: string, value?: string | number): CompilerContainerEvent => ({
    category: 'compilerContainer',
    action: 'evmVersionSelection',
    name,
    value,
    isClick: true // User selects EVM version
  }),
  
  addCustomCompiler: (name?: string, value?: string | number): CompilerContainerEvent => ({
    category: 'compilerContainer',
    action: 'addCustomCompiler',
    name,
    value,
    isClick: true // User clicks to add custom compiler
  }),
  
  viewLicense: (name?: string, value?: string | number): CompilerContainerEvent => ({
    category: 'compilerContainer',
    action: 'viewLicense',
    name,
    value,
    isClick: true // User clicks to view compiler license
  }),
  
  advancedConfigToggle: (name?: string, value?: string | number): CompilerContainerEvent => ({
    category: 'compilerContainer',
    action: 'advancedConfigToggle',
    name,
    value,
    isClick: true // User toggles advanced configurations section
  })
} as const;