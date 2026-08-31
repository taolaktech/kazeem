import { MarketSession } from '../market-data/session/market-session.enum.js';
import { MATURITY_EVIDENCE_WEIGHT } from '../market-data/session/session-maturity.js';
import type { MarketSessionSnapshot } from '../market-data/session/session-context.interface.js';
import { MarketRegime } from './enums/market-regime.enum.js';

/**
 * Weights for what the current regular session has actually done. They are
 * scaled by session maturity, so evidence gains influence as completed candles
 * accumulate rather than being gated on a candle count.
 */
export const CURRENT_SESSION_WEIGHTS = {
  changeFromOpen: 2,
  slope: 1.5,
  candleBalance: 1,
  structure: 1.5,
  positionInRange: 1,
} as const;

/**
 * Premarket is opening context, not a vote that can carry the classification:
 * its weights are small and are never scaled up by maturity.
 */
export const PREMARKET_WEIGHTS = {
  gap: 0.75,
  trend: 0.5,
} as const;

/**
 * Weights for where price stands against the 09:30–09:45 opening range. It is
 * one more intraday feature alongside the indicators, never a classification
 * on its own, so no single opening-range rule can outweigh the rest.
 */
export const OPENING_RANGE_WEIGHTS = {
  breakout: 2,
  /** Repeated completed closes beyond the level, not a single excursion. */
  sustainedBreakout: 1,
  volumeConfirmation: 0.5,
  insideRange: 1.5,
  /** Removed from the side whose breakout was rejected back into the range. */
  failedBreakout: 1,
} as const;

/** Completed closes beyond a boundary that count as a sustained break. */
export const SUSTAINED_BREAKOUT_CLOSES = 2;

/** Percent move from the session open that counts as directional. */
export const SESSION_CHANGE_THRESHOLD_PERCENT = 0.15;
/** Percent-per-candle slope that counts as directional. */
export const SESSION_SLOPE_THRESHOLD_PERCENT = 0.03;
/** Share of completed candles of one colour that counts as one-sided. */
export const SESSION_CANDLE_BALANCE_RATIO = 0.6;
/** Percent gap from the previous close that counts as a real gap. */
export const PREMARKET_GAP_THRESHOLD_PERCENT = 0.3;

export interface SessionEvidence {
  bullish: number;
  bearish: number;
  rangeBound: number;
  reasoning: string[];
  riskFlags: string[];
}

type EvidenceSide = 'bullish' | 'bearish' | 'rangeBound';

/**
 * Turns the session partition into a bullish/bearish score adjustment layered
 * on top of the indicator scores. Historical indicators still describe the
 * baseline; this is what today's tape adds to it.
 */
export function evaluateSessionEvidence(
  snapshot: MarketSessionSnapshot,
): SessionEvidence {
  const { currentSessionFeatures: current, premarket, context } = snapshot;
  const weight = MATURITY_EVIDENCE_WEIGHT[context.sessionMaturity];
  const reasoning: string[] = [];
  const riskFlags: string[] = [];

  const totals: Record<EvidenceSide, number> = {
    bullish: 0,
    bearish: 0,
    rangeBound: 0,
  };

  const awardTo = (points: number, side: EvidenceSide, why: string): void => {
    const scaled = round(points * weight);
    if (scaled <= 0) {
      return;
    }
    totals[side] += scaled;
    reasoning.push(`${why} (+${scaled} ${label(side)})`);
  };
  const award = (points: number, bullishSide: boolean, why: string): void => {
    awardTo(points, bullishSide ? 'bullish' : 'bearish', why);
  };

  const change = current.changeFromOpenPercent;
  if (change !== null && Math.abs(change) >= SESSION_CHANGE_THRESHOLD_PERCENT) {
    award(
      CURRENT_SESSION_WEIGHTS.changeFromOpen,
      change > 0,
      `Session trades ${change}% from the opening price`,
    );
  }

  const slope = current.slopePercent;
  if (slope !== null && Math.abs(slope) >= SESSION_SLOPE_THRESHOLD_PERCENT) {
    award(
      CURRENT_SESSION_WEIGHTS.slope,
      slope > 0,
      `Short-term ${context.timeframeMinutes}-minute slope is ${slope}% per candle`,
    );
  }

  const decided = current.bullishCandleCount + current.bearishCandleCount;
  if (decided > 0) {
    const bullishShare = current.bullishCandleCount / decided;
    if (bullishShare >= SESSION_CANDLE_BALANCE_RATIO) {
      award(
        CURRENT_SESSION_WEIGHTS.candleBalance,
        true,
        `${current.bullishCandleCount} of ${decided} completed candles closed up`,
      );
    } else if (1 - bullishShare >= SESSION_CANDLE_BALANCE_RATIO) {
      award(
        CURRENT_SESSION_WEIGHTS.candleBalance,
        false,
        `${current.bearishCandleCount} of ${decided} completed candles closed down`,
      );
    }
  }

  if (current.higherHighs) {
    award(
      CURRENT_SESSION_WEIGHTS.structure,
      true,
      'Consecutive higher highs in the current session',
    );
  }
  if (current.lowerLows) {
    award(
      CURRENT_SESSION_WEIGHTS.structure,
      false,
      'Consecutive lower lows in the current session',
    );
  }

  const position = current.positionInRange;
  if (position !== null && position >= 0.66) {
    award(
      CURRENT_SESSION_WEIGHTS.positionInRange,
      true,
      'Price holds the upper third of the session range',
    );
  } else if (position !== null && position <= 0.34) {
    award(
      CURRENT_SESSION_WEIGHTS.positionInRange,
      false,
      'Price sits in the lower third of the session range',
    );
  }

  applyOpeningRangeEvidence(snapshot, awardTo, totals, reasoning, riskFlags);

  const gap = premarket.gapPercentFromPreviousClose;
  if (gap !== null && Math.abs(gap) >= PREMARKET_GAP_THRESHOLD_PERCENT) {
    const points = PREMARKET_WEIGHTS.gap;
    if (gap > 0) {
      totals.bullish = round(totals.bullish + points);
    } else {
      totals.bearish = round(totals.bearish + points);
    }
    reasoning.push(
      `Premarket gapped ${gap}% from the previous close (+${points} ${gap > 0 ? 'bullish' : 'bearish'})`,
    );
  }
  if (premarket.trendDirection === 'BULLISH') {
    totals.bullish = round(totals.bullish + PREMARKET_WEIGHTS.trend);
    reasoning.push(
      `Premarket trend is bullish (+${PREMARKET_WEIGHTS.trend} bullish)`,
    );
  } else if (premarket.trendDirection === 'BEARISH') {
    totals.bearish = round(totals.bearish + PREMARKET_WEIGHTS.trend);
    reasoning.push(
      `Premarket trend is bearish (+${PREMARKET_WEIGHTS.trend} bearish)`,
    );
  }

  riskFlags.push(...sessionRiskFlags(snapshot));

  return {
    bullish: round(totals.bullish),
    bearish: round(totals.bearish),
    rangeBound: round(totals.rangeBound),
    reasoning,
    riskFlags,
  };
}

/**
 * Reads the opening-range context the session layer already produced; the
 * levels themselves are never recomputed here.
 */
function applyOpeningRangeEvidence(
  snapshot: MarketSessionSnapshot,
  awardTo: (points: number, side: EvidenceSide, why: string) => void,
  totals: Record<EvidenceSide, number>,
  reasoning: string[],
  riskFlags: string[],
): void {
  const range = snapshot.openingRange;
  if (!range.available) {
    return;
  }
  if (range.status !== 'COMPLETE') {
    riskFlags.push(
      `Opening range ${range.startTime}–${range.endTime} is still forming`,
    );
    return;
  }

  if (range.breakoutAbove || range.breakdownBelow) {
    const side: EvidenceSide = range.breakoutAbove ? 'bullish' : 'bearish';
    const level = range.breakoutAbove ? range.high : range.low;
    awardTo(
      OPENING_RANGE_WEIGHTS.breakout,
      side,
      `Price ${range.breakoutAbove ? 'broke out above' : 'broke down below'} the opening range at ${level}`,
    );

    const closes = range.breakoutAbove
      ? range.closesAboveHigh
      : range.closesBelowLow;
    if (closes >= SUSTAINED_BREAKOUT_CLOSES) {
      awardTo(
        OPENING_RANGE_WEIGHTS.sustainedBreakout,
        side,
        `${closes} completed candles closed beyond the opening range`,
      );
    }
    if (range.volumeConfirmation === 'CONFIRMED') {
      awardTo(
        OPENING_RANGE_WEIGHTS.volumeConfirmation,
        side,
        'Opening-range break carries above-average participation',
      );
    } else if (range.volumeConfirmation === 'NOT_CONFIRMED') {
      riskFlags.push('Opening-range break lacks volume confirmation');
    }
  } else if (range.currentPricePosition === 'INSIDE') {
    awardTo(
      OPENING_RANGE_WEIGHTS.insideRange,
      'rangeBound',
      'Price is still inside the opening range',
    );
  }

  // A rejected break weakens the side that attempted it instead of flipping
  // into evidence for the other direction.
  if (range.failedBreakoutAbove) {
    totals.bullish = round(
      Math.max(0, totals.bullish - OPENING_RANGE_WEIGHTS.failedBreakout),
    );
    reasoning.push(
      `Price traded above the opening range high but closed back inside (-${OPENING_RANGE_WEIGHTS.failedBreakout} bullish)`,
    );
    riskFlags.push('Opening-range breakout was rejected');
  }
  if (range.failedBreakdownBelow) {
    totals.bearish = round(
      Math.max(0, totals.bearish - OPENING_RANGE_WEIGHTS.failedBreakout),
    );
    reasoning.push(
      `Price traded below the opening range low but closed back inside (-${OPENING_RANGE_WEIGHTS.failedBreakout} bearish)`,
    );
    riskFlags.push('Opening-range breakdown was rejected');
  }
}

function label(side: EvidenceSide): string {
  return side === 'rangeBound' ? 'range-bound' : side;
}

function sessionRiskFlags(snapshot: MarketSessionSnapshot): string[] {
  const { context, premarket, currentSessionFeatures: current } = snapshot;
  const flags: string[] = [];

  if (context.marketSession === MarketSession.OPENING_SETTLEMENT) {
    flags.push(
      `Opening ${context.openingSettlementMinutes}-minute settlement period`,
    );
  }
  if (context.marketSession === MarketSession.PREMARKET) {
    flags.push('Premarket session; no completed regular-session evidence yet');
  }
  if (
    context.marketSession === MarketSession.AFTER_HOURS ||
    context.marketSession === MarketSession.CLOSED
  ) {
    flags.push('Regular session is closed; evidence is from the last session');
  }
  if (
    context.marketSession === MarketSession.REGULAR &&
    context.sessionMaturity === 'EARLY'
  ) {
    flags.push('Early regular-session conditions');
  }

  const opposedByPremarket =
    (premarket.trendDirection === 'BEARISH' &&
      current.aboveSessionOpen === true) ||
    (premarket.trendDirection === 'BULLISH' &&
      current.aboveSessionOpen === false);
  if (opposedByPremarket) {
    flags.push(
      `Premarket context is ${premarket.trendDirection.toLowerCase()} while the regular session moves the other way`,
    );
  }

  return flags;
}

export function applySessionEvidence(
  scores: Record<MarketRegime, number>,
  evidence: SessionEvidence,
): Record<MarketRegime, number> {
  return {
    ...scores,
    [MarketRegime.TRENDING_BULLISH]: round(
      scores[MarketRegime.TRENDING_BULLISH] + evidence.bullish,
    ),
    [MarketRegime.TRENDING_BEARISH]: round(
      scores[MarketRegime.TRENDING_BEARISH] + evidence.bearish,
    ),
    [MarketRegime.RANGE_BOUND]: round(
      scores[MarketRegime.RANGE_BOUND] + evidence.rangeBound,
    ),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
