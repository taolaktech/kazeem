import {
  SignalAlignment,
  VolatilityRelationship,
} from '../../volatility-intelligence/enums/volatility.enum.js';
import type { VolatilityIntelligenceResult } from '../../volatility-intelligence/interfaces/volatility-intelligence-result.interface.js';
import {
  CATEGORY_WEIGHTS,
  VOLATILITY_FACTORS,
} from '../constants/trade-decision-weights.js';
import {
  ConflictSeverity,
  DecisionCategory,
  TradeDirection,
} from '../enums/trade-decision.enum.js';
import type {
  ComponentScore,
  DecisionConflict,
} from '../interfaces/component-score.interface.js';
import { conflict, round2 } from './scoring.util.js';

const CATEGORY = DecisionCategory.VOLATILITY;
const WEIGHT = CATEGORY_WEIGHTS[CATEGORY];

/**
 * VIX confirmation is optional evidence. When the index is not available its
 * weight leaves the denominator entirely, so a setup is never penalized for
 * data we did not buy — and rising VIX is never itself a PUT signal.
 */
export function scoreVolatility(
  volatility: VolatilityIntelligenceResult | null,
  direction: TradeDirection,
): ComponentScore {
  if (volatility === null || !volatility.vix.available) {
    return {
      earned: null,
      available: 0,
      reason: 'VIX_UNAVAILABLE',
      confirmations: [],
      conflicts: [],
      riskFlags: ['Real-time VIX confirmation unavailable'],
      missingIntelligence: ['Real-time VIX confirmation unavailable'],
    };
  }
  if (direction === TradeDirection.NONE) {
    return {
      earned: round2(WEIGHT * VOLATILITY_FACTORS.neutral),
      available: WEIGHT,
      confirmations: [],
      conflicts: [],
      riskFlags: [],
      missingIntelligence: [],
    };
  }

  const confirmations: string[] = [];
  const conflicts: DecisionConflict[] = [];
  const riskFlags: string[] = [];

  let factor: number = VOLATILITY_FACTORS.neutral;
  if (volatility.signalAlignment === SignalAlignment.CONFIRMS) {
    factor = VOLATILITY_FACTORS.confirms;
    confirmations.push(
      `Volatility behaviour confirms the ${direction} thesis (${volatility.relationship})`,
    );
  } else if (volatility.signalAlignment === SignalAlignment.CONFLICTS) {
    factor = VOLATILITY_FACTORS.conflicts;
    conflicts.push(
      conflict(
        CATEGORY,
        'VIX_CONFLICT',
        ConflictSeverity.MODERATE,
        `Volatility behaviour conflicts with the ${direction} thesis (${volatility.relationship})`,
        true,
      ),
    );
  } else if (volatility.relationship === VolatilityRelationship.DIVERGENCE) {
    factor = VOLATILITY_FACTORS.diverges;
    conflicts.push(
      conflict(
        CATEGORY,
        'VIX_DIVERGENCE',
        ConflictSeverity.MINOR,
        'Volatility diverges from the underlying move',
        false,
      ),
    );
  }

  if (volatility.vix.spikeDetected) {
    riskFlags.push('Volatility spike detected');
  }

  return {
    earned: round2(WEIGHT * factor),
    available: WEIGHT,
    confirmations,
    conflicts,
    riskFlags,
    missingIntelligence: [],
  };
}
