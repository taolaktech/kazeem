import type { MarketCandle } from '../../src/market-data/interfaces/market-candle.interface.js';

/**
 * Test helpers that build candle series on explicit New York wall-clock times,
 * so session behaviour can be exercised without touching the real clock.
 */

/** UTC offset of New York in August (EDT). */
export const EDT_OFFSET_HOURS = 4;
/** UTC offset of New York in January (EST). */
export const EST_OFFSET_HOURS = 5;

export interface CandleShape {
  open?: number;
  close?: number;
  high?: number;
  low?: number;
  volume?: number;
}

/** Builds an instant from a New York date and wall-clock time. */
export function easternInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  offsetHours = EDT_OFFSET_HOURS,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour + offsetHours, minute));
}

export function candleAt(start: Date, shape: CandleShape = {}): MarketCandle {
  const open = shape.open ?? 100;
  const close = shape.close ?? open;
  return {
    timestamp: start,
    open,
    close,
    high: shape.high ?? Math.max(open, close) + 0.05,
    low: shape.low ?? Math.min(open, close) - 0.05,
    volume: shape.volume ?? 1_000_000,
  };
}

/**
 * Consecutive candles of `timeframeMinutes` starting at `start`, with each
 * close stepping by `step` from `startPrice`.
 */
export function candleSeries(
  start: Date,
  count: number,
  options: {
    timeframeMinutes?: number;
    startPrice?: number;
    step?: number;
    volume?: number;
  } = {},
): MarketCandle[] {
  const timeframeMinutes = options.timeframeMinutes ?? 3;
  const startPrice = options.startPrice ?? 100;
  const step = options.step ?? 0;

  return Array.from({ length: count }, (_unused, index) => {
    const open = startPrice + step * index;
    const close = open + step;
    return candleAt(
      new Date(start.getTime() + index * timeframeMinutes * 60_000),
      { open, close, volume: options.volume },
    );
  });
}
