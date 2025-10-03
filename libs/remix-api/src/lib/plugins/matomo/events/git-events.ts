/**
 * Git Events - Git integration and version control tracking events
 * 
 * This file contains all Git-related Matomo events.
 */

import { MatomoEventBase } from '../core/base-types';

export interface GitEvent extends MatomoEventBase {
  category: 'git';
  action: 
    | 'INIT'
    | 'COMMIT' 
    | 'PUSH'
    | 'PULL'
    | 'CLONE'
    | 'CHECKOUT'
    | 'BRANCH'
    | 'OPEN_PANEL'
    | 'CONNECT_TO_GITHUB';
}

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