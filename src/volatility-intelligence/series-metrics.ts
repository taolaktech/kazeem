import type { MarketCandle } from '../market-data/interfaces/market-candle.interface.js';

/** Percentage change across the last `lookback` completed candles. */
export function windowChangePercent(
  candles: readonly MarketCandle[],
  lookback: number,
): number | null {
  const window = candles.slice(-(lookback + 1));
  if (window.length < 2) {
    return null;
  }
  return percentOf(
    window[window.length - 1].close - window[0].close,
    window[0].close,
  );
}

/**
 * How much faster the latest window is moving than the one before it, in
 * percentage points. Positive means the move is accelerating upward.
 */
export function accelerationPercent(
  candles: readonly MarketCandle[],
  lookback: number,
): number | null {
  if (candles.length < lookback * 2 + 1) {
    return null;
  }
  const recent = windowChangePercent(candles, lookback);
  const previous = windowChangePercent(candles.slice(0, -lookback), lookback);
  if (recent === null || previous === null) {
    return null;
  }
  return round(recent - previous);
}

export function percentOf(value: number, base: number): number | null {
  if (!Number.isFinite(base) || base === 0 || !Number.isFinite(value)) {
    return null;
  }
  return round((value / base) * 100);
}

export function positionInRange(
  value: number | null,
  high: number | null,
  low: number | null,
): number | null {
  if (value === null || high === null || low === null) {
    return null;
  }
  const range = high - low;
  if (!Number.isFinite(range) || range <= 0) {
    return null;
  }
  return round((value - low) / range);
}

/** Clamps to [-1, 1] and keeps the result finite. */
export function clampSigned(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(-1, value));
}

/** Clamps to [0, 1] and keeps the result finite. */
export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

export function round(value: number, decimals = 4): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Guards every numeric field of a result against NaN and Infinity. */
export function finiteOrNull(value: number | null | undefined): number | null {
  return value === null || value === undefined || !Number.isFinite(value)
    ? null
    : value;
}
