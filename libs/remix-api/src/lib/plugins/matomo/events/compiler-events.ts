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