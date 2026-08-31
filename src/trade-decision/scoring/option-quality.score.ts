import { OptionSelectionStatus } from '../../option-selection/enums/option-selection-status.enum.js';
import type { OptionCandidate } from '../../option-selection/interfaces/option-candidate-score.interface.js';
import type { OptionSelectionResult } from '../../option-selection/interfaces/option-selection-result.interface.js';
import {
  CATEGORY_WEIGHTS,
  OPTION_QUALITY_SUB_WEIGHTS,
  OPTION_QUALITY_THRESHOLDS as T,
} from '../constants/trade-decision-weights.js';
import {
  ConflictSeverity,
  DecisionCategory,
} from '../enums/trade-decision.enum.js';
import type {
  ComponentScore,
  DecisionConflict,
} from '../interfaces/component-score.interface.js';
import { clamp01, conflict, round2, scaleBetween } from './scoring.util.js';

const CATEGORY = DecisionCategory.OPTION_QUALITY;
const WEIGHT = CATEGORY_WEIGHTS[CATEGORY];

/**
 * Judges the contract option selection already picked. The chain is never
 * re-ranked here and no second budget filter is applied: budget is enforced
 * upstream, this only reports how well the survivor fits the thesis.
 */
export function scoreOptionQuality(
  selection: OptionSelectionResult,
  providerFailed: boolean,
): ComponentScore {
  if (providerFailed) {
    return {
      earned: 0,
      available: WEIGHT,
      reason: 'OPTION_PROVIDER_UNAVAILABLE',
      confirmations: [],
      conflicts: [
        conflict(
          CATEGORY,
          'OPTION_PROVIDER_UNAVAILABLE',
          ConflictSeverity.CRITICAL,
          'Option chain provider is unavailable; contract quality cannot be assessed',
          false,
        ),
      ],
      riskFlags: [],
      missingIntelligence: ['Option chain provider unavailable'],
    };
  }

  const contract = selection.selectedContract;
  if (
    selection.status === OptionSelectionStatus.NO_SELECTION ||
    contract === null
  ) {
    return {
      earned: 0,
      available: WEIGHT,
      reason: 'NO_CONTRACT_SELECTED',
      confirmations: [],
      conflicts: [
        conflict(
          CATEGORY,
          'NO_CONTRACT_SELECTED',
          ConflictSeverity.CRITICAL,
          `No qualifying contract was selected within the $${selection.maxBudget} maximum trade budget`,
          false,
        ),
      ],
      riskFlags: [],
      missingIntelligence: [],
    };
  }

  const confirmations: string[] = [];
  const conflicts: DecisionConflict[] = [];
  const riskFlags: string[] = [];
  const missingIntelligence: string[] = [];

  // IV rank and IV percentile need historical IV we do not collect, so they
  // are reported as missing rather than fabricated from the current IV.
  missingIntelligence.push('Historical IV percentile unavailable');

  const earned =
    scoreDelta(contract, confirmations, conflicts) +
    scoreLiquidity(contract, confirmations, conflicts) +
    scoreSpread(contract, conflicts, riskFlags, missingIntelligence) +
    scoreDte(contract, conflicts, riskFlags) +
    scoreBudgetFit(contract, selection, riskFlags) +
    OPTION_QUALITY_SUB_WEIGHTS.selectionConfidence *
      clamp01(selection.confidence);

  return {
    earned: round2(earned),
    available: WEIGHT,
    confirmations,
    conflicts,
    riskFlags,
    missingIntelligence,
  };
}

function scoreDelta(
  contract: OptionCandidate,
  confirmations: string[],
  conflicts: DecisionConflict[],
): number {
  const points = OPTION_QUALITY_SUB_WEIGHTS.delta;
  if (contract.delta === null) {
    return points * 0.5;
  }
  const delta = Math.abs(contract.delta);
  if (delta >= T.idealDeltaLow && delta <= T.idealDeltaHigh) {
    confirmations.push(
      `Contract delta of ${contract.delta} fits an intraday long`,
    );
    return points;
  }
  if (delta < T.weakDelta) {
    conflicts.push(
      conflict(
        CATEGORY,
        'WEAK_DELTA',
        ConflictSeverity.MODERATE,
        `Contract delta of ${contract.delta} is far out of the money`,
        false,
      ),
    );
    return 0;
  }
  return (
    points *
    (delta < T.idealDeltaLow
      ? scaleBetween(delta, T.weakDelta, T.idealDeltaLow)
      : 0.6)
  );
}

function scoreLiquidity(
  contract: OptionCandidate,
  confirmations: string[],
  conflicts: DecisionConflict[],
): number {
  const points = OPTION_QUALITY_SUB_WEIGHTS.liquidity;
  const volumeFactor = scaleBetween(
    contract.volume,
    T.minimumVolume,
    T.healthyVolume,
  );
  const openInterestFactor = scaleBetween(
    contract.openInterest,
    T.minimumOpenInterest,
    T.healthyOpenInterest,
  );
  if (
    contract.volume >= T.healthyVolume &&
    contract.openInterest >= T.healthyOpenInterest
  ) {
    confirmations.push(
      `Contract liquidity is healthy (${contract.volume} volume, ${contract.openInterest} open interest)`,
    );
  } else if (
    contract.volume < T.minimumVolume ||
    contract.openInterest < T.minimumOpenInterest
  ) {
    conflicts.push(
      conflict(
        CATEGORY,
        'THIN_LIQUIDITY',
        ConflictSeverity.MODERATE,
        `Contract liquidity is thin (${contract.volume} volume, ${contract.openInterest} open interest)`,
        true,
      ),
    );
  }
  return points * (0.5 * volumeFactor + 0.5 * openInterestFactor);
}

/**
 * A missing bid/ask reduces certainty about execution quality but is never a
 * rejection: the current provider entitlement often returns no quote at all.
 */
function scoreSpread(
  contract: OptionCandidate,
  conflicts: DecisionConflict[],
  riskFlags: string[],
  missingIntelligence: string[],
): number {
  const points = OPTION_QUALITY_SUB_WEIGHTS.spread;
  if (
    !contract.quoteAvailable ||
    contract.bid === null ||
    contract.ask === null
  ) {
    missingIntelligence.push('Bid/ask spread unavailable');
    riskFlags.push('Execution quality unverified: no bid/ask quote available');
    return points * T.unverifiedSpreadFactor;
  }
  const midpoint = (contract.bid + contract.ask) / 2;
  const spreadPercent =
    midpoint > 0 ? ((contract.ask - contract.bid) / midpoint) * 100 : Infinity;
  if (spreadPercent > T.acceptableSpreadPercent) {
    conflicts.push(
      conflict(
        CATEGORY,
        'WIDE_SPREAD',
        ConflictSeverity.MODERATE,
        `Bid/ask spread of ${spreadPercent.toFixed(1)}% is wide for an intraday long`,
        true,
      ),
    );
    return 0;
  }
  return (
    points *
    (1 -
      scaleBetween(
        spreadPercent,
        T.tightSpreadPercent,
        T.acceptableSpreadPercent,
      ) *
        0.6)
  );
}

function scoreDte(
  contract: OptionCandidate,
  conflicts: DecisionConflict[],
  riskFlags: string[],
): number {
  const points = OPTION_QUALITY_SUB_WEIGHTS.dte;
  const dte = contract.daysToExpiration;
  if (dte === 0) {
    riskFlags.push('0DTE contract: theta decay and gamma risk are extreme');
    conflicts.push(
      conflict(
        CATEGORY,
        'ZERO_DTE',
        ConflictSeverity.MODERATE,
        '0DTE contract carries extreme theta and gamma risk',
        true,
      ),
    );
    return points * 0.4;
  }
  if (dte >= T.idealMinDte && dte <= T.idealMaxDte) {
    return points;
  }
  if (dte <= T.acceptableMaxDte) {
    return points * 0.7;
  }
  conflicts.push(
    conflict(
      CATEGORY,
      'POOR_DTE_FIT',
      ConflictSeverity.MINOR,
      `${dte} days to expiration is long for an intraday thesis`,
      false,
    ),
  );
  return points * 0.4;
}

function scoreBudgetFit(
  contract: OptionCandidate,
  selection: OptionSelectionResult,
  riskFlags: string[],
): number {
  const points = OPTION_QUALITY_SUB_WEIGHTS.budgetFit;
  if (contract.estimatedContractCost === null) {
    return 0;
  }
  const estimated = contract.premiumPriceSource === 'LAST_PRICE';
  if (estimated) {
    riskFlags.push(
      'Budget eligibility estimated from last trade price; current ask unavailable',
    );
  }
  const headroom = clamp01(
    1 - contract.estimatedContractCost / selection.maxBudget,
  );
  return (
    points * (0.6 + 0.4 * headroom) * (estimated ? T.estimatedCostFactor : 1)
  );
}
