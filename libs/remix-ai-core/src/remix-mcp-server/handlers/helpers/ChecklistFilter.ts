/**
 * Enhanced Checklist Filtering Utilities for Smart Contract Auditing Pipeline
 * Builds on existing SlitherAnalisysMapping.ts with additional classification-based filtering
 */

import { ContractClassification } from './ContractClassifier';
import { SlitherDetector } from '../EnhancedAuditHandler';
import { 
  Category, 
  ChecklistItem 
} from './SlitherAnalisysMapping';

export interface FilteredChecklistResult {
  totalItems: number;
  slitherTriggeredItems: ChecklistItemWithContext[];
  aiOnlyItems: ChecklistItemWithContext[];
  filteredCategories: string[];
  filterSummary: {
    appliedStaticFilters: string[];
    slitherDetectorsMatched: string[];
    itemsFilteredOut: number;
  };
}

export interface ChecklistItemWithContext extends ChecklistItem {
  slitherTriggered: boolean;
  matchedDetectors?: string[];
  filterReason?: string;
}

/**
 * Enhanced detector-to-checklist mapping with reverse lookup capability
 */
export const DETECTOR_TO_CHECKLIST_MAPPING: Record<string, string[]> = {
  // Reentrancy
  'reentrancy-eth': ['SOL-AM-ReentrancyAttack-1', 'SOL-AM-ReentrancyAttack-2'],
  'reentrancy-no-eth': ['SOL-AM-ReentrancyAttack-1'],
  'reentrancy-benign': ['SOL-AM-ReentrancyAttack-1'],
  'reentrancy-events': ['SOL-AM-ReentrancyAttack-1'],
  
  // Access Control
  'tx-origin': ['SOL-Basics-AC-7'],
  'suicidal': ['SOL-Basics-VI-EAI-1'],
  'arbitrary-send-eth': ['SOL-Basics-Payment-1'],
  'controlled-delegatecall': ['SOL-Basics-PU-6'],
  'unprotected-upgrade': ['SOL-Basics-AC-1', 'SOL-Basics-Proxy-1'],
  
  // Math/Arithmetic
  'divide-before-multiply': ['SOL-Basics-Math-4'],
  'integer-overflow': ['SOL-Basics-Math-1'],
  'tautology': ['SOL-Basics-Math-5'],
  
  // Timestamp Manipulation  
  'timestamp': ['SOL-AM-MA-1'],
  'weak-prng': ['SOL-AM-MA-2'],
  
  // Initialization
  'uninitialized-local': ['SOL-Basics-Initialization-1'],
  'uninitialized-state': ['SOL-Basics-Initialization-2'],
  
  // Price Manipulation
  'price-manipulation': ['SOL-AM-PMA-1', 'SOL-AM-PMA-2'],
  
  // External Calls
  'unchecked-lowlevel': ['SOL-Basics-EC-1'],
  'unchecked-send': ['SOL-Basics-Payment-2'],
  'low-level-calls': ['SOL-Basics-EC-2'],
  
  // DoS
  'calls-loop': ['SOL-AM-DOS-1'],
  'costly-loop': ['SOL-AM-DOS-2'],
  'locked-ether': ['SOL-AM-DOS-3'],
  
  // Events
  'missing-events-access': ['SOL-Basics-Event-1'],
  'missing-events-arithmetic': ['SOL-Basics-Event-2'],
  
  // Gas Optimizations (if included)
  'cache-array-length': ['SOL-Gas-Loop-1'],
  'constable-states': ['SOL-Gas-Storage-1'],
  'external-function': ['SOL-Gas-Function-1'],
};

/**
 * Static filtering rules based on contract classification
 */
export class StaticChecklistFilter {
  
  /**
   * Apply classification-based static filters
   */
  static applyStaticFilters(
    checklistItems: Category[], 
    classification: ContractClassification
  ): { filteredItems: Category[], appliedFilters: string[] } {
    
    const appliedFilters: string[] = [];
    let filteredItems = [...checklistItems];
    
    // Filter by proxy patterns
    if (!classification.has_proxy) {
      filteredItems = this.filterByCategory(filteredItems, ['Proxy', 'Upgradable', 'UUPS']);
      appliedFilters.push('Filtered out Proxy/Upgradable items (has_proxy: false)');
    }
    
    // Filter by token standards
    if (!classification.has_erc20) {
      filteredItems = this.filterByCategory(filteredItems, ['ERC20', 'Token']);
      appliedFilters.push('Filtered out ERC20 token items (has_erc20: false)');
    }
    
    if (!classification.has_erc721) {
      filteredItems = this.filterByCategory(filteredItems, ['ERC721', 'NFT', '1155']);
      appliedFilters.push('Filtered out NFT items (has_erc721: false)');
    }
    
    // Filter by DeFi features
    if (!classification.has_amm_swap) {
      filteredItems = this.filterByCategory(filteredItems, ['AMM', 'Swap', 'DEX']);
      appliedFilters.push('Filtered out AMM/Swap items (has_amm_swap: false)');
    }
    
    if (!classification.has_lending) {
      filteredItems = this.filterByCategory(filteredItems, ['Lending', 'Borrowing']);
      appliedFilters.push('Filtered out Lending items (has_lending: false)');
    }
    
    if (!classification.has_oracle) {
      filteredItems = this.filterByCategory(filteredItems, ['Oracle', 'Price Manipulation']);
      appliedFilters.push('Filtered out Price Manipulation items (has_oracle: false)');
    }
    
    // Filter by governance
    if (!classification.has_governance) {
      filteredItems = this.filterByCategory(filteredItems, ['Governance', 'Sybil', 'Voting']);
      appliedFilters.push('Filtered out Governance items (has_governance: false)');
    }
    
    // Filter by cross-chain features
    if (!classification.has_cross_chain) {
      filteredItems = this.filterByCategory(filteredItems, ['Bridge', 'Cross-chain', 'Multi-chain']);
      appliedFilters.push('Filtered out Cross-chain items (has_cross_chain: false)');
    }
    
    // Filter by staking
    if (!classification.has_staking) {
      filteredItems = this.filterByCategory(filteredItems, ['Staking', 'Delegation']);
      appliedFilters.push('Filtered out Staking items (has_staking: false)');
    }
    
    // Filter by Solidity version
    if (classification.solidity_version.startsWith('0.8') || 
        this.compareVersions(classification.solidity_version, '0.8.0') >= 0) {
      filteredItems = this.filterByVersion(filteredItems, 'pre-0.8');
      appliedFilters.push('Filtered out pre-0.8 overflow/underflow items (solidity_version >= 0.8)');
    }
    
    // Filter by OpenZeppelin version
    if (classification.oz_version === 'unknown') {
      filteredItems = this.filterByCategory(filteredItems, ['OZ-version']);
      appliedFilters.push('Filtered out OZ version-specific items (oz_version: unknown)');
    }
    
    return { filteredItems, appliedFilters };
  }
  
  private static filterByCategory(items: Category[], keywords: string[]): Category[] {
    return items.filter(item => {
      const itemText = `${item.category} ${item.description}`.toLowerCase();
      return !keywords.some(keyword => itemText.includes(keyword.toLowerCase()));
    });
  }
  
  private static filterByVersion(items: Category[], versionFilter: string): Category[] {
    return items.filter(item => {
      const itemText = `${item.category} ${item.description}`.toLowerCase();
      return !itemText.includes(versionFilter);
    });
  }
  
  private static compareVersions(a: string, b: string): number {
    const parseVersion = (v: string) => v.split('.').map(Number);
    const versionA = parseVersion(a);
    const versionB = parseVersion(b);
    
    for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
      const partA = versionA[i] || 0;
      const partB = versionB[i] || 0;
      if (partA !== partB) return partA - partB;
    }
    return 0;
  }
}

/**
 * Slither-based checklist item matcher
 */
export class SlitherChecklistMatcher {
  
  /**
   * Mark checklist items as Slither-triggered or AI-only
   */
  static matchSlitherFindings(
    checklistItems: ChecklistItem[], 
    slitherFindings: SlitherDetector[]
  ): ChecklistItemWithContext[] {
    
    const detectorNames = slitherFindings.map(f => f.check);
    const matchedItems: ChecklistItemWithContext[] = [];
    
    for (const item of checklistItems) {
      const matchedDetectors: string[] = [];
      
      // Check if this checklist item is matched by any Slither detector
      for (const detectorName of detectorNames) {
        const mappedItems = DETECTOR_TO_CHECKLIST_MAPPING[detectorName] || [];
        if (mappedItems.includes(item.id)) {
          matchedDetectors.push(detectorName);
        }
      }
      
      matchedItems.push({
        ...item,
        slitherTriggered: matchedDetectors.length > 0,
        matchedDetectors: matchedDetectors.length > 0 ? matchedDetectors : undefined,
        filterReason: matchedDetectors.length > 0 
          ? `Matched by Slither detectors: ${matchedDetectors.join(', ')}` 
          : 'AI-only analysis required'
      });
    }
    
    return matchedItems;
  }
}

/**
 * Main checklist filtering orchestrator
 */
export class ChecklistFilterOrchestrator {
  
  /**
   * Apply complete two-stage filtering process
   */
  static async filterChecklist(
    classification: ContractClassification,
    slitherFindings: SlitherDetector[]
  ): Promise<FilteredChecklistResult> {
    
    // Step 1: Fetch the Cyfrin audit checklist
    const checklistResponse = await fetch('https://raw.githubusercontent.com/Cyfrin/audit-checklist/main/checklist.json');
    if (!checklistResponse.ok) {
      throw new Error(`Failed to fetch checklist: ${checklistResponse.statusText}`);
    }
    const checklistJson = await checklistResponse.json();
    
    // Step 2: Apply static filters based on classification
    const { filteredItems, appliedFilters } = StaticChecklistFilter.applyStaticFilters(
      checklistJson, 
      classification
    );
    
    // Step 3: Extract all checklist items from filtered categories
    const allItems: ChecklistItem[] = [];
    const extractItems = (categories: Category[], parentPath = '') => {
      for (const category of categories) {
        if (Array.isArray(category.data) && category.data.length > 0) {
          // Check if data contains checklist items or subcategories
          if (category.data[0].hasOwnProperty('question')) {
            // These are checklist items
            const items = category.data as ChecklistItem[];
            items.forEach(item => {
              allItems.push({
                ...item,
                categoryPath: parentPath ? `${parentPath} > ${category.category}` : category.category
              });
            });
          } else {
            // These are subcategories
            extractItems(category.data as Category[], 
              parentPath ? `${parentPath} > ${category.category}` : category.category);
          }
        }
      }
    };
    extractItems(filteredItems);
    
    // Step 4: Apply Slither-based matching
    const matchedItems = SlitherChecklistMatcher.matchSlitherFindings(allItems, slitherFindings);
    
    // Step 5: Separate into Slither-triggered and AI-only items
    const slitherTriggeredItems = matchedItems.filter(item => item.slitherTriggered);
    const aiOnlyItems = matchedItems.filter(item => !item.slitherTriggered);
    
    // Step 6: Build summary
    const slitherDetectorsMatched = Array.from(
      new Set(slitherTriggeredItems.flatMap(item => item.matchedDetectors || []))
    );
    
    const filteredCategories = Array.from(
      new Set(matchedItems.map(item => item.categoryPath))
    );
    
    return {
      totalItems: matchedItems.length,
      slitherTriggeredItems,
      aiOnlyItems,
      filteredCategories,
      filterSummary: {
        appliedStaticFilters: appliedFilters,
        slitherDetectorsMatched,
        itemsFilteredOut: checklistJson.length - filteredItems.length
      }
    };
  }
  
  /**
   * Utility method to get a summary for debugging
   */
  static getSummary(result: FilteredChecklistResult): string {
    return `
Checklist Filtering Summary:
- Total items after filtering: ${result.totalItems}
- Slither-triggered items: ${result.slitherTriggeredItems.length}
- AI-only items: ${result.aiOnlyItems.length}
- Categories covered: ${result.filteredCategories.length}
- Static filters applied: ${result.filterSummary.appliedStaticFilters.length}
- Slither detectors matched: ${result.filterSummary.slitherDetectorsMatched.length}
    `.trim();
  }
}