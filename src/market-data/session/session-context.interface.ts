import type { MarketCandle } from '../interfaces/market-candle.interface.js';
import type { MarketSession, SessionMaturity } from './market-session.enum.js';

export type SessionTrendDirection =
  'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN';

export type SessionVolatility = 'LOW' | 'NORMAL' | 'HIGH' | 'UNKNOWN';

/** Opening context built from 04:00–09:30 ET bars only. */
export interface PremarketContext {
  available: boolean;
  candleCount: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  change: number | null;
  changePercent: number | null;
  gapFromPreviousClose: number | null;
  gapPercentFromPreviousClose: number | null;
  range: number | null;
  rangePercent: number | null;
  trendDirection: SessionTrendDirection;
  volatility: SessionVolatility;
  /** Where the last premarket price sits inside the premarket range, in [0, 1]. */
  positionInRange: number | null;
  distanceFromHighPercent: number | null;
  distanceFromLowPercent: number | null;
}

/** Reference levels from the most recent completed regular session. */
export interface PreviousSessionContext {
  available: boolean;
  /** Trading date of that session in New York, as YYYY-MM-DD. */
  date: string | null;
  previousClose: number | null;
  previousHigh: number | null;
  previousLow: number | null;
  previousOpen: number | null;
  direction: SessionTrendDirection;
  /** Informational full-session count; never an analytical working set. */
  totalSessionCandleCount: number;
}

/**
 * What the current regular session has done so far.
 *
 * Every OHLC-derived field describes one scope: the capped analytical working
 * window (the most recent `candleCount` completed candles, at most
 * `MARKET_MAX_INDICATOR_CANDLES`). Full-session reference levels are kept in
 * the separate `session*` fields, which are informational only.
 */
export interface CurrentSessionFeatures {
  /** Size of the analytical window; never exceeds the configured cap. */
  candleCount: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  range: number | null;
  rangePercent: number | null;
  changeFromOpen: number | null;
  changeFromOpenPercent: number | null;
  /** Position of the last close inside the session range, in [0, 1]. */
  positionInRange: number | null;
  /** Average per-candle price change over the recent candles, in percent. */
  slopePercent: number | null;
  bullishCandleCount: number;
  bearishCandleCount: number;
  higherHighs: boolean;
  lowerLows: boolean;
  /** True 09:30 ET open of the day, outside the analytical window. */
  sessionOpen: number | null;
  sessionHigh: number | null;
  sessionLow: number | null;
  /** Last close inside the true full-session range, in [0, 1]. */
  sessionPositionInRange: number | null;
  /** Informational full-session count; never an analytical working set. */
  totalSessionCandleCount: number;
  /** Last close against the full-session open, not the window open. */
  aboveSessionOpen: boolean | null;
  abovePremarketHigh: boolean | null;
  belowPremarketLow: boolean | null;
}

/** Lifecycle of the opening range within the current trading day. */
export type OpeningRangeStatus = 'FORMING' | 'COMPLETE' | 'UNAVAILABLE';

export type OpeningRangePosition = 'ABOVE' | 'INSIDE' | 'BELOW' | 'UNKNOWN';

export type OpeningRangeBreakoutStrength =
  'NONE' | 'WEAK' | 'MODERATE' | 'STRONG';

export type OpeningRangeVolumeConfirmation =
  'CONFIRMED' | 'NOT_CONFIRMED' | 'UNKNOWN';

/**
 * The 09:30–09:45 ET reference levels, built only from completed regular
 * session candles inside that window. Distinct from both premarket context
 * and the running session high/low: these levels freeze once the window ends.
 */
export interface OpeningRangeContext {
  available: boolean;
  status: OpeningRangeStatus;
  /** New York wall-clock bounds of the window, as HH:MM. */
  startTime: string;
  endTime: string;
  windowMinutes: number;
  candleCount: number;
  /** Completed candles the window is expected to contain once it closes. */
  expectedCandleCount: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  range: number | null;
  rangePercent: number | null;
  currentPrice: number | null;
  currentPricePosition: OpeningRangePosition;
  distanceFromHighPercent: number | null;
  distanceFromLowPercent: number | null;
  /** Percent of price treated as a meaningful move beyond a range boundary. */
  breakoutTolerancePercent: number;
  breakoutAbove: boolean;
  breakdownBelow: boolean;
  /** Completed post-range candles that closed beyond the respective level. */
  closesAboveHigh: number;
  closesBelowLow: number;
  /** Traded through a level but the completed candle closed back inside. */
  failedBreakoutAbove: boolean;
  failedBreakdownBelow: boolean;
  breakoutStrength: OpeningRangeBreakoutStrength;
  volumeConfirmation: OpeningRangeVolumeConfirmation;
  /** Breakout-candle volume relative to the average opening-range candle. */
  relativeBreakoutVolume: number | null;
  /**
   * Informational count of completed candles after the opening-range window.
   * The opening range is preserved full-session context, so this is metadata
   * only and is never the regime analytical working set.
   */
  totalPostRangeCandleCount: number;
}

export interface SessionSnapshotContext {
  timezone: string;
  marketSession: MarketSession;
  sessionMaturity: SessionMaturity;
  timeframeMinutes: number;
  openingSettlementMinutes: number;
  tradeEvaluationAllowed: boolean;
  /** Trading date the current-session evidence belongs to. */
  sessionDate: string;
  currentSessionCandleCount: number;
  indicatorCandleCount: number;
  previousSessionWarmupCandleCount: number;
  premarketCandleCount: number;
  /** Length of the opening-range window, in minutes after the 09:30 open. */
  openingRangeMinutes: number;
}

/**
 * One fetch, partitioned by session. Indicator history, current-session
 * evidence and premarket context are deliberately kept apart so callers can
 * weight them differently instead of treating every candle as equal.
 */
export interface MarketSessionSnapshot {
  symbol: string;
  asOf: Date;
  context: SessionSnapshotContext;
  /** Warm-up history plus current-session candles, oldest to newest. */
  indicatorCandles: MarketCandle[];
  currentSessionCandles: MarketCandle[];
  premarketCandles: MarketCandle[];
  premarket: PremarketContext;
  openingRange: OpeningRangeContext;
  previousSession: PreviousSessionContext;
  currentSessionFeatures: CurrentSessionFeatures;
  warnings: string[];
}
