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
  candleCount: number;
}

/** What the current regular session has done so far, on completed candles. */
export interface CurrentSessionFeatures {
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
  aboveSessionOpen: boolean | null;
  abovePremarketHigh: boolean | null;
  belowPremarketLow: boolean | null;
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
  previousSession: PreviousSessionContext;
  currentSessionFeatures: CurrentSessionFeatures;
  warnings: string[];
}
