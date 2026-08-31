import type { MarketCandle } from '../../src/market-data/interfaces/market-candle.interface.js';
import type { MarketSessionSnapshot } from '../../src/market-data/session/session-context.interface.js';
import { partitionSessionCandles } from '../../src/market-data/session/session-partition.js';
import { candleSeries, easternInstant } from './session-candles.js';

export const TIMEFRAME_MINUTES = 3;
/** Thursday 2026-08-27 and Friday 2026-08-28, both EDT. */
export const PREVIOUS_OPEN = easternInstant(2026, 8, 27, 9, 30);
export const SESSION_OPEN = easternInstant(2026, 8, 28, 9, 30);

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
