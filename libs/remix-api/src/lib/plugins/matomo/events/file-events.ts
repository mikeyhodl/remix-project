/**
 * File Events - File explorer and workspace management tracking events
 * 
 * This file contains all file management related Matomo events.
 */

import { MatomoEventBase } from '../core/base-types';

export interface FileExplorerEvent extends MatomoEventBase {
  category: 'fileExplorer';
  action: 
    | 'contextMenu'
    | 'workspaceMenu'
    | 'fileAction'
    | 'deleteKey'
    | 'osxDeleteKey'
    | 'f2ToRename'
    | 'copyCombo'
    | 'cutCombo'
    | 'pasteCombo';
}

export interface WorkspaceEvent extends MatomoEventBase {
  category: 'Workspace';
  action: 
    | 'switchWorkspace'
    | 'GIT'
    | 'createWorkspace';
}

export interface StorageEvent extends MatomoEventBase {
  category: 'Storage';
  action: 
    | 'activate'
    | 'error';
}

export interface BackupEvent extends MatomoEventBase {
  category: 'Backup';
  action: 
    | 'create'
    | 'restore'
    | 'error'
    | 'download'
    | 'userActivate';
}

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
  }),
  
  createWorkspace: (name?: string, value?: string | number): WorkspaceEvent => ({
    category: 'Workspace',
    action: 'createWorkspace',
    name,
    value,
    isClick: true // User clicks to create new workspace
  })
} as const;

/**
 * Storage Events - Type-safe builders
 */
export const StorageEvents = {
  activate: (name?: string, value?: string | number): StorageEvent => ({
    category: 'Storage',
    action: 'activate',
    name,
    value,
    isClick: false // Storage activation is typically a system event
  }),
  
  error: (name?: string, value?: string | number): StorageEvent => ({
    category: 'Storage',
    action: 'error',
    name,
    value,
    isClick: false // Storage errors are system events
  })
} as const;

/**
 * Backup Events - Type-safe builders
 */
export const BackupEvents = {
  create: (name?: string, value?: string | number): BackupEvent => ({
    category: 'Backup',
    action: 'create',
    name,
    value,
    isClick: true // User initiates backup
  }),
  
  restore: (name?: string, value?: string | number): BackupEvent => ({
    category: 'Backup',
    action: 'restore',
    name,
    value,
    isClick: true // User initiates restore
  }),
  
  error: (name?: string, value?: string | number): BackupEvent => ({
    category: 'Backup',
    action: 'error',
    name,
    value,
    isClick: false // Backup errors are system events
  }),
  
  download: (name?: string, value?: string | number): BackupEvent => ({
    category: 'Backup',
    action: 'download',
    name,
    value,
    isClick: true // User downloads backup
  }),
  
  userActivate: (name?: string, value?: string | number): BackupEvent => ({
    category: 'Backup',
    action: 'userActivate',
    name,
    value,
    isClick: true // User activates backup feature
  })
} as const;