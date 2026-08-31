import type {
  ConflictSeverity,
  DecisionCategory,
} from '../enums/trade-decision.enum.js';

/** Why a category could not be scored; also surfaced in the API response. */
export type UnavailableReason =
  | 'VIX_UNAVAILABLE'
  | 'NEWS_UNAVAILABLE'
  | 'NO_DIRECTIONAL_SIGNAL'
  | 'NO_CONTRACT_SELECTED'
  | 'OPTION_PROVIDER_UNAVAILABLE'
  | 'CORE_MARKET_DATA_UNAVAILABLE';

export interface DecisionConflict {
  /** Stable identifier, used to apply each penalty at most once. */
  code: string;
  category: DecisionCategory;
  severity: ConflictSeverity;
  description: string;
  /**
   * Whether the conflict also deducts from the normalized score. Conflicts
   * already fully expressed by a component's earned points are reported but
   * not penalized again.
   */
  penalized: boolean;
}

export interface ComponentScore {
  /** Points earned, or null when the category is not scorable. */
  earned: number | null;
  /** Points this category contributes to the denominator; 0 when unavailable. */
  available: number;
  reason?: UnavailableReason;
  confirmations: string[];
  conflicts: DecisionConflict[];
  riskFlags: string[];
  missingIntelligence: string[];
}
