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

