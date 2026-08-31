import type { MarketCandle } from '../../src/market-data/interfaces/market-candle.interface.js';
import type { MarketSessionSnapshot } from '../../src/market-data/session/session-context.interface.js';
import { partitionSessionCandles } from '../../src/market-data/session/session-partition.js';
import { candleSeries, easternInstant } from './session-candles.js';

export const TIMEFRAME_MINUTES = 3;
/** Thursday 2026-08-27 and Friday 2026-08-28, both EDT. */
export const PREVIOUS_OPEN = easternInstant(2026, 8, 27, 9, 30);
export const SESSION_OPEN = easternInstant(2026, 8, 28, 9, 30);

export interface SeriesSnapshotOptions {
  symbol: string;
  /** Flat level of the previous regular session, which sets previousClose. */
  previousLevel?: number;
  /** Omit the previous session entirely, leaving previousClose null. */
  withoutPreviousSession?: boolean;
  /** Closes of the current-session candles, oldest first. */
  currentCloses: number[];
  premarket?: MarketCandle[];
  /** Defaults to the instant the last supplied candle completes. */
  now?: Date;
  maxIndicatorCandles?: number;
  openingSettlementMinutes?: number;
}

/**
 * Builds a snapshot from explicit closes, so a series with a deliberate shape
 * (accelerating, spiking, reversing) can be expressed directly.
 */
export function buildSeriesSnapshot(
  options: SeriesSnapshotOptions,
): MarketSessionSnapshot {
  const level = options.previousLevel ?? options.currentCloses[0];
  const previous = options.withoutPreviousSession
    ? []
    : candleSeries(PREVIOUS_OPEN, 130, {
        timeframeMinutes: TIMEFRAME_MINUTES,
        startPrice: level,
        step: 0,
      });

  let open = level;
  const current = options.currentCloses.map((close, index) => {
    const candle: MarketCandle = {
      timestamp: new Date(
        SESSION_OPEN.getTime() + index * TIMEFRAME_MINUTES * 60_000,
      ),
      open,
      close,
      high: Math.max(open, close) + 0.02,
      low: Math.min(open, close) - 0.02,
      volume: 0,
    };
    open = close;
    return candle;
  });

  const now =
    options.now ??
    new Date(
      SESSION_OPEN.getTime() +
        options.currentCloses.length * TIMEFRAME_MINUTES * 60_000,
    );

  return partitionSessionCandles(
    [...previous, ...(options.premarket ?? []), ...current],
    {
      symbol: options.symbol,
      now,
      timeframeMinutes: TIMEFRAME_MINUTES,
      maxIndicatorCandles: options.maxIndicatorCandles ?? 80,
      openingSettlementMinutes: options.openingSettlementMinutes ?? 15,
    },
  );
}

export interface SnapshotOptions {
  /** New York wall-clock hour/minute of the evaluation instant. */
  atHour?: number;
  atMinute?: number;
  currentCandles?: number;
  currentStep?: number;
  currentStartPrice?: number;
  previousStep?: number;
  premarket?: MarketCandle[];
  maxIndicatorCandles?: number;
  openingSettlementMinutes?: number;
}

/** Builds a real session snapshot from synthetic previous/current candles. */
export function buildSessionSnapshot(
  options: SnapshotOptions = {},
): MarketSessionSnapshot {
  const previous = candleSeries(PREVIOUS_OPEN, 130, {
    timeframeMinutes: TIMEFRAME_MINUTES,
    startPrice: 100,
    step: options.previousStep ?? 0.02,
  });
  const current = candleSeries(SESSION_OPEN, options.currentCandles ?? 20, {
    timeframeMinutes: TIMEFRAME_MINUTES,
    startPrice:
      options.currentStartPrice ?? previous[previous.length - 1].close,
    step: options.currentStep ?? 0.05,
  });

  return partitionSessionCandles(
    [...previous, ...(options.premarket ?? []), ...current],
    {
      symbol: 'SPY',
      now: easternInstant(
        2026,
        8,
        28,
        options.atHour ?? 10,
        options.atMinute ?? 30,
      ),
      timeframeMinutes: TIMEFRAME_MINUTES,
      maxIndicatorCandles: options.maxIndicatorCandles ?? 80,
      openingSettlementMinutes: options.openingSettlementMinutes ?? 15,
    },
  );
}
