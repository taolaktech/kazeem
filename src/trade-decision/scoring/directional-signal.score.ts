import { MarketSignal } from '../../signal/enums/market-signal.enum.js';
import type { SignalResult } from '../../signal/interfaces/signal-result.interface.js';
import {
  CATEGORY_WEIGHTS,
  SIGNAL_SUB_WEIGHTS,
} from '../constants/trade-decision-weights.js';
import {
  ConflictSeverity,
  DecisionCategory,
  TradeDirection,
} from '../enums/trade-decision.enum.js';
import type { ComponentScore } from '../interfaces/component-score.interface.js';
import { clamp01, conflict, round2 } from './scoring.util.js';

const WEIGHT = CATEGORY_WEIGHTS[DecisionCategory.DIRECTIONAL_SIGNAL];

/**
 * Scores the existence, strength and cleanliness of the directional trigger.
 * Market structure is not re-scored here: it belongs to regime + structure.
 */
export function scoreDirectionalSignal(
  signal: SignalResult,
  direction: TradeDirection,
): ComponentScore {
  if (signal.signal === MarketSignal.NO_TRADE) {
    return {
      earned: 0,
      available: WEIGHT,
      confirmations: [],
      conflicts: [
        conflict(
          DecisionCategory.DIRECTIONAL_SIGNAL,
          'SIGNAL_NO_TRADE',
          ConflictSeverity.CRITICAL,
          'Signal engine returned NO_TRADE',
          false,
        ),
      ],
      riskFlags: [],
      missingIntelligence: [],
    };
  }

  if (direction === TradeDirection.NONE) {
    return {
      earned: 0,
      available: WEIGHT,
      reason: 'NO_DIRECTIONAL_SIGNAL',
      confirmations: [],
      conflicts: [
        conflict(
          DecisionCategory.DIRECTIONAL_SIGNAL,
          'SIGNAL_NEUTRAL',
          ConflictSeverity.MAJOR,
          'Signal engine returned NEUTRAL; there is no directional trigger',
          false,
        ),
      ],
      riskFlags: [],
      missingIntelligence: [],
    };
  }

  const leader =
    signal.signal === MarketSignal.BULLISH
      ? signal.scores.bullish
      : signal.scores.bearish;
  const opposing =
    signal.signal === MarketSignal.BULLISH
      ? signal.scores.bearish
      : signal.scores.bullish;
  const separation = leader > 0 ? clamp01((leader - opposing) / leader) : 0;
  const cleanliness =
    signal.confirmations.length + signal.conflicts.length === 0
      ? 0.5
      : clamp01(
          signal.confirmations.length /
            (signal.confirmations.length + signal.conflicts.length),
        );

  const factor =
    SIGNAL_SUB_WEIGHTS.confidence * clamp01(signal.confidence) +
    SIGNAL_SUB_WEIGHTS.separation * separation +
    SIGNAL_SUB_WEIGHTS.cleanliness * cleanliness;

  const conflicts =
    signal.conflicts.length >= 3
      ? [
          conflict(
            DecisionCategory.DIRECTIONAL_SIGNAL,
            'SIGNAL_CONTESTED',
            ConflictSeverity.MODERATE,
            `Signal carries ${signal.conflicts.length} conflicting indicators`,
            true,
          ),
        ]
      : [];

  return {
    earned: round2(WEIGHT * factor),
    available: WEIGHT,
    confirmations: [
      `Directional signal is ${signal.signal} with confidence ${signal.confidence}`,
    ],
    conflicts,
    riskFlags: [],
    missingIntelligence: [],
  };
}
