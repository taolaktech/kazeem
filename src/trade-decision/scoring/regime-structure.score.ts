import type {
  CurrentSessionFeatures,
  OpeningRangeContext,
} from '../../market-data/session/session-context.interface.js';
import { MarketRegime } from '../../regime/enums/market-regime.enum.js';
import type { RegimeClassificationResult } from '../../regime/interfaces/regime-result.interface.js';
import {
  CATEGORY_WEIGHTS,
  OPENING_RANGE_FACTORS,
  REGIME_ALIGNMENT_FACTORS,
  REGIME_CONFIDENCE_FLOOR,
  STRUCTURE_SUB_WEIGHTS,
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
import { clamp01, conflict, round2 } from './scoring.util.js';

const CATEGORY = DecisionCategory.REGIME_AND_STRUCTURE;
const WEIGHT = CATEGORY_WEIGHTS[CATEGORY];

export interface StructureInput {
  regime: RegimeClassificationResult;
  currentSession: CurrentSessionFeatures;
  openingRange: OpeningRangeContext;
  direction: TradeDirection;
}

/**
 * Environment and price location, merged into one category so the same fact
 * cannot be rewarded once as "regime" and again as "structure".
 */
export function scoreRegimeAndStructure(input: StructureInput): ComponentScore {
  const { direction } = input;
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

  const conflicts: DecisionConflict[] = [];
  const confirmations: string[] = [];
  const riskFlags: string[] = [];

  const regimePoints = scoreRegime(input, conflicts, confirmations);
  const structurePoints = scoreSessionStructure(
    input,
    conflicts,
    confirmations,
  );
  const openingRangePoints = scoreOpeningRange(
    input,
    conflicts,
    confirmations,
    riskFlags,
  );

  return {
    earned: round2(regimePoints + structurePoints + openingRangePoints),
    available: WEIGHT,
    confirmations,
    conflicts,
    riskFlags,
    missingIntelligence: [],
  };
}

function scoreRegime(
  { regime, direction }: StructureInput,
  conflicts: DecisionConflict[],
  confirmations: string[],
): number {
  const bullish = direction === TradeDirection.CALL;
  const aligned = bullish
    ? MarketRegime.TRENDING_BULLISH
    : MarketRegime.TRENDING_BEARISH;
  const opposed = bullish
    ? MarketRegime.TRENDING_BEARISH
    : MarketRegime.TRENDING_BULLISH;

  let factor: number;
  switch (regime.primaryRegime) {
    case aligned:
      factor = REGIME_ALIGNMENT_FACTORS.aligned;
      confirmations.push(
        `Regime ${regime.primaryRegime} supports the ${direction} thesis`,
      );
      break;
    case opposed:
      factor = REGIME_ALIGNMENT_FACTORS.opposed;
      conflicts.push(
        conflict(
          CATEGORY,
          'REGIME_OPPOSED',
          ConflictSeverity.MAJOR,
          `${direction} thesis runs against a ${regime.primaryRegime} regime`,
          true,
        ),
      );
      break;
    case MarketRegime.RANGE_BOUND:
      // A range-bound market is a weaker environment, never a rejection.
      factor = REGIME_ALIGNMENT_FACTORS.rangeBound;
      conflicts.push(
        conflict(
          CATEGORY,
          'REGIME_RANGE_BOUND',
          ConflictSeverity.MINOR,
          'Regime is RANGE_BOUND, which weakens directional continuation',
          false,
        ),
      );
      break;
    default:
      factor = REGIME_ALIGNMENT_FACTORS.volatilityRegime;
      break;
  }

  const trendMatches =
    regime.secondaryCharacteristics.trendDirection ===
    (bullish ? 'BULLISH' : 'BEARISH');
  const trendFactor = trendMatches
    ? { WEAK: 0.7, MODERATE: 0.9, STRONG: 1 }[
        regime.secondaryCharacteristics.trendStrength
      ]
    : 0.5;

  // Confidence never zeroes the category on its own; it scales it.
  const confidenceFactor =
    REGIME_CONFIDENCE_FLOOR +
    (1 - REGIME_CONFIDENCE_FLOOR) * clamp01(regime.confidence);

  return (
    STRUCTURE_SUB_WEIGHTS.regimeAlignment *
    factor *
    trendFactor *
    confidenceFactor
  );
}

function scoreSessionStructure(
  { currentSession, direction }: StructureInput,
  conflicts: DecisionConflict[],
  confirmations: string[],
): number {
  const bullish = direction === TradeDirection.CALL;
  const sessionPosition = currentSession.sessionPositionInRange;
  const checks: { supportive: boolean; label: string }[] = [
    {
      supportive: bullish
        ? currentSession.higherHighs
        : currentSession.lowerLows,
      label: bullish
        ? 'Analytical window is printing higher highs'
        : 'Analytical window is printing lower lows',
    },
    {
      supportive: currentSession.aboveSessionOpen === (bullish ? true : false),
      label: bullish
        ? 'Price holds above the session open'
        : 'Price holds below the session open',
    },
    {
      supportive:
        sessionPosition !== null &&
        (bullish ? sessionPosition >= 0.6 : sessionPosition <= 0.4),
      label: bullish
        ? 'Price sits in the upper part of the session range'
        : 'Price sits in the lower part of the session range',
    },
    {
      supportive:
        currentSession.slopePercent !== null &&
        (bullish
          ? currentSession.slopePercent > 0
          : currentSession.slopePercent < 0),
      label: `Analytical-window drift is ${bullish ? 'positive' : 'negative'}`,
    },
  ];

  const supportive = checks.filter((check) => check.supportive);
  supportive.forEach((check) => confirmations.push(check.label));

  if (supportive.length === 0) {
    conflicts.push(
      conflict(
        CATEGORY,
        'STRUCTURE_UNSUPPORTIVE',
        ConflictSeverity.MODERATE,
        `Session structure does not support the ${direction} thesis`,
        false,
      ),
    );
  }

  return (
    STRUCTURE_SUB_WEIGHTS.sessionStructure * (supportive.length / checks.length)
  );
}

/**
 * Opening-range evidence is a bonus, not a gate: this system is not an opening
 * range breakout strategy, so a supportive location inside the range still
 * earns most of the sub-weight and never caps the grade.
 */
function scoreOpeningRange(
  { openingRange, currentSession, direction }: StructureInput,
  conflicts: DecisionConflict[],
  confirmations: string[],
  riskFlags: string[],
): number {
  const points = STRUCTURE_SUB_WEIGHTS.openingRange;
  if (!openingRange.available || openingRange.status !== 'COMPLETE') {
    riskFlags.push('Opening range is not complete yet');
    return points * OPENING_RANGE_FACTORS.unavailable;
  }

  const bullish = direction === TradeDirection.CALL;
  const broke = bullish
    ? openingRange.breakoutAbove
    : openingRange.breakdownBelow;
  const brokeAgainst = bullish
    ? openingRange.breakdownBelow
    : openingRange.breakoutAbove;
  const sustainedCloses = bullish
    ? openingRange.closesAboveHigh
    : openingRange.closesBelowLow;
  const rejected = bullish
    ? openingRange.failedBreakoutAbove
    : openingRange.failedBreakdownBelow;

  if (broke) {
    confirmations.push(
      bullish
        ? 'Price broke out above the opening range high on a completed close'
        : 'Price broke down below the opening range low on a completed close',
    );
    const factor =
      sustainedCloses >= 2
        ? OPENING_RANGE_FACTORS.sustainedBreak
        : OPENING_RANGE_FACTORS.confirmedBreak;
    if (openingRange.volumeConfirmation === 'NOT_CONFIRMED') {
      conflicts.push(
        conflict(
          CATEGORY,
          'OPENING_RANGE_BREAK_UNCONFIRMED',
          ConflictSeverity.MINOR,
          'Opening-range break is not confirmed by volume',
          false,
        ),
      );
    }
    return points * factor;
  }

  if (brokeAgainst) {
    conflicts.push(
      conflict(
        CATEGORY,
        'OPENING_RANGE_AGAINST_DIRECTION',
        ConflictSeverity.MAJOR,
        `Price has broken the opening range against the ${direction} thesis`,
        true,
      ),
    );
    return points * OPENING_RANGE_FACTORS.againstDirection;
  }

  if (rejected) {
    conflicts.push(
      conflict(
        CATEGORY,
        'OPENING_RANGE_REJECTED',
        ConflictSeverity.MODERATE,
        bullish
          ? 'Price was rejected at the opening range high'
          : 'Price was rejected at the opening range low',
        true,
      ),
    );
    return points * OPENING_RANGE_FACTORS.rejectedBreak;
  }

  // Inside the range: reward the location and structure, not the breakout.
  const sessionPosition = currentSession.sessionPositionInRange;
  const supportive =
    (bullish
      ? openingRange.failedBreakdownBelow
      : openingRange.failedBreakoutAbove) ||
    (sessionPosition !== null &&
      (bullish ? sessionPosition >= 0.6 : sessionPosition <= 0.4)) ||
    (bullish ? currentSession.higherHighs : currentSession.lowerLows);

  if (supportive) {
    confirmations.push(
      bullish
        ? 'Price holds the upper portion of the opening range with bullish structure'
        : 'Price holds the lower portion of the opening range with bearish structure',
    );
    return points * OPENING_RANGE_FACTORS.supportiveInsideRange;
  }

  return points * OPENING_RANGE_FACTORS.neutralInsideRange;
}
