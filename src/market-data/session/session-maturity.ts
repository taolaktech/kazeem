import { MarketSession, SessionMaturity } from './market-session.enum.js';

/**
 * Completed regular-session candle counts that separate the maturity buckets.
 * They are thresholds on *evidence*, not on the clock: the classifier never
 * waits for a full indicator window of current-session candles.
 */
export const MATURITY_THRESHOLDS = {
  /** Fewest completed current-session candles worth evaluating at all. */
  early: 5,
  developing: 10,
  established: 20,
} as const;

/** Confidence scaling applied to a classification at each maturity. */
export const MATURITY_CONFIDENCE_FACTOR: Record<SessionMaturity, number> = {
  [SessionMaturity.SETTLING]: 0.6,
  [SessionMaturity.EARLY]: 0.8,
  [SessionMaturity.DEVELOPING]: 0.9,
  [SessionMaturity.ESTABLISHED]: 1,
};

/** How much weight current-session price action carries at each maturity. */
export const MATURITY_EVIDENCE_WEIGHT: Record<SessionMaturity, number> = {
  [SessionMaturity.SETTLING]: 0.4,
  [SessionMaturity.EARLY]: 0.7,
  [SessionMaturity.DEVELOPING]: 0.85,
  [SessionMaturity.ESTABLISHED]: 1,
};

export function resolveSessionMaturity(
  session: MarketSession,
  currentSessionCandleCount: number,
): SessionMaturity {
  if (
    session === MarketSession.OPENING_SETTLEMENT ||
    currentSessionCandleCount < MATURITY_THRESHOLDS.early
  ) {
    return SessionMaturity.SETTLING;
  }
  if (currentSessionCandleCount >= MATURITY_THRESHOLDS.established) {
    return SessionMaturity.ESTABLISHED;
  }
  return currentSessionCandleCount >= MATURITY_THRESHOLDS.developing
    ? SessionMaturity.DEVELOPING
    : SessionMaturity.EARLY;
}
