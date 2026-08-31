import type { OpeningRangeContext } from '../../market-data/session/session-context.interface.js';
import type { RegimeFeatures } from '../../regime/interfaces/indicator-features.interface.js';
import {
  CATEGORY_WEIGHTS,
  MOMENTUM_SUB_WEIGHTS,
  MOMENTUM_THRESHOLDS,
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
import { conflict, round2, scaleBetween } from './scoring.util.js';

const CATEGORY = DecisionCategory.MOMENTUM_AND_VOLUME;
const WEIGHT = CATEGORY_WEIGHTS[CATEGORY];

export interface MomentumInput {
  features: RegimeFeatures;
  openingRange: OpeningRangeContext;
  direction: TradeDirection;
}

/**
 * Participation and acceleration only. Price direction itself is scored by the
 * directional signal and by regime + structure, so it is deliberately absent
 * here: this category answers "is anyone behind the move?".
 */
export function scoreMomentumAndVolume(input: MomentumInput): ComponentScore {
  const { features, openingRange, direction } = input;
  if (direction === TradeDirection.NONE) {
    return {
      earned: 0,
      available: WEIGHT,
      reason: 'NO_DIRECTIONAL_SIGNAL',
      confirmations: [],
      conflicts: [],
      riskFlags: [],
      missingIntelligence: [],
    };
  }

  const confirmations: string[] = [];
  const conflicts: DecisionConflict[] = [];
  const missingIntelligence: string[] = [];

  const volumePoints = scoreRelativeVolume(
    features.relativeVolume,
    confirmations,
    conflicts,
    missingIntelligence,
  );
  const trendPoints = scoreTrendStrength(features, direction, confirmations);
  const participationPoints = scoreParticipation(
    openingRange,
    confirmations,
    missingIntelligence,
  );

  return {
    earned: round2(volumePoints + trendPoints + participationPoints),
    available: WEIGHT,
    confirmations,
    conflicts,
    riskFlags: [],
    missingIntelligence,
  };
}

function scoreRelativeVolume(
  relativeVolume: number | undefined,
  confirmations: string[],
  conflicts: DecisionConflict[],
  missingIntelligence: string[],
): number {
  const points = MOMENTUM_SUB_WEIGHTS.relativeVolume;
  if (relativeVolume === undefined) {
    missingIntelligence.push('Relative volume unavailable');
    return points * 0.5;
  }
  if (relativeVolume < MOMENTUM_THRESHOLDS.weakRelativeVolume) {
    conflicts.push(
      conflict(
        CATEGORY,
        'WEAK_PARTICIPATION',
        ConflictSeverity.MINOR,
        `Relative volume of ${round2(relativeVolume)} shows weak participation`,
        false,
      ),
    );
    return 0;
  }
  if (relativeVolume >= MOMENTUM_THRESHOLDS.healthyRelativeVolume) {
    confirmations.push(
      `Relative volume of ${round2(relativeVolume)} confirms participation`,
    );
  }
  return (
    points *
    scaleBetween(
      relativeVolume,
      MOMENTUM_THRESHOLDS.weakRelativeVolume,
      MOMENTUM_THRESHOLDS.strongRelativeVolume,
    )
  );
}

function scoreTrendStrength(
  features: RegimeFeatures,
  direction: TradeDirection,
  confirmations: string[],
): number {
  const points = MOMENTUM_SUB_WEIGHTS.trendStrengthening;
  const { adx, plusDI, minusDI } = features;
  if (adx === undefined) {
    return points * 0.5;
  }

  const adxFactor = scaleBetween(
    adx,
    MOMENTUM_THRESHOLDS.moderateAdx,
    MOMENTUM_THRESHOLDS.strongAdx,
  );
  if (adx >= MOMENTUM_THRESHOLDS.strongAdx) {
    confirmations.push(`ADX of ${round2(adx)} shows a strengthening trend`);
  }

  if (plusDI === undefined || minusDI === undefined) {
    return points * (0.5 + 0.5 * adxFactor);
  }

  // DI expansion measures how decisively participation leans one way; it does
  // not re-score the direction the signal already established.
  const spread =
    direction === TradeDirection.CALL ? plusDI - minusDI : minusDI - plusDI;
  const diFactor = scaleBetween(
    spread,
    MOMENTUM_THRESHOLDS.moderateDiSpread,
    MOMENTUM_THRESHOLDS.strongDiSpread,
  );
  if (spread >= MOMENTUM_THRESHOLDS.strongDiSpread) {
    confirmations.push(
      `Directional movement expands in favour of the ${direction} thesis`,
    );
  }

  return points * (0.5 * adxFactor + 0.5 * diFactor);
}

function scoreParticipation(
  openingRange: OpeningRangeContext,
  confirmations: string[],
  missingIntelligence: string[],
): number {
  const points = MOMENTUM_SUB_WEIGHTS.participation;
  switch (openingRange.volumeConfirmation) {
    case 'CONFIRMED':
      confirmations.push(
        'Post-opening-range volume exceeds the opening-range average',
      );
      return points;
    case 'NOT_CONFIRMED':
      return points * 0.25;
    default:
      missingIntelligence.push('Opening-range volume comparison unavailable');
      return points * 0.5;
  }
}
