import type { MarketCandle } from '../interfaces/market-candle.interface.js';
import type {
  CurrentSessionFeatures,
  PremarketContext,
  PreviousSessionContext,
  SessionTrendDirection,
  SessionVolatility,
} from './session-context.interface.js';

/** Fraction of the session range that separates a directional close from a flat one. */
const DIRECTIONAL_CHANGE_PERCENT = 0.1;
/** Premarket range, in percent of price, above which the open is treated as volatile. */
const PREMARKET_HIGH_RANGE_PERCENT = 1;
const PREMARKET_LOW_RANGE_PERCENT = 0.3;
/** Candles used for the short-term slope of the current session. */
const SLOPE_LOOKBACK = 5;
/** Candles compared when looking for higher highs / lower lows. */
const STRUCTURE_LOOKBACK = 3;

export const EMPTY_PREMARKET_CONTEXT: PremarketContext = {
  available: false,
  candleCount: 0,
  open: null,
  high: null,
  low: null,
  close: null,
  volume: null,
  change: null,
  changePercent: null,
  gapFromPreviousClose: null,
  gapPercentFromPreviousClose: null,
  range: null,
  rangePercent: null,
  trendDirection: 'UNKNOWN',
  volatility: 'UNKNOWN',
  positionInRange: null,
  distanceFromHighPercent: null,
  distanceFromLowPercent: null,
};

export const EMPTY_PREVIOUS_SESSION_CONTEXT: PreviousSessionContext = {
  available: false,
  date: null,
  previousClose: null,
  previousHigh: null,
  previousLow: null,
  previousOpen: null,
  direction: 'UNKNOWN',
  candleCount: 0,
};

export const EMPTY_CURRENT_SESSION_FEATURES: CurrentSessionFeatures = {
  candleCount: 0,
  open: null,
  high: null,
  low: null,
  close: null,
  range: null,
  rangePercent: null,
  changeFromOpen: null,
  changeFromOpenPercent: null,
  positionInRange: null,
  slopePercent: null,
  bullishCandleCount: 0,
  bearishCandleCount: 0,
  higherHighs: false,
  lowerLows: false,
  aboveSessionOpen: null,
  abovePremarketHigh: null,
  belowPremarketLow: null,
};

export function buildPremarketContext(
  candles: readonly MarketCandle[],
  previousClose: number | null,
): PremarketContext {
  if (candles.length === 0) {
    return EMPTY_PREMARKET_CONTEXT;
  }

  const open = candles[0].open;
  const close = candles[candles.length - 1].close;
  const high = Math.max(...candles.map((candle) => candle.high));
  const low = Math.min(...candles.map((candle) => candle.low));
  const volume = candles.reduce((total, candle) => total + candle.volume, 0);
  const range = high - low;
  const change = close - open;

  return {
    available: true,
    candleCount: candles.length,
    open,
    high,
    low,
    close,
    volume,
    change: round(change),
    changePercent: percentOf(change, open),
    gapFromPreviousClose:
      previousClose === null ? null : round(close - previousClose),
    gapPercentFromPreviousClose:
      previousClose === null
        ? null
        : percentOf(close - previousClose, previousClose),
    range: round(range),
    rangePercent: percentOf(range, low),
    trendDirection: premarketTrend(candles, open, close, high, low),
    volatility: premarketVolatility(percentOf(range, low)),
    positionInRange: positionInRange(close, high, low),
    distanceFromHighPercent: percentOf(close - high, high),
    distanceFromLowPercent: percentOf(close - low, low),
  };
}

/**
 * Multiple pieces of evidence rather than the colour of the last candle:
 * net premarket change, where price sits inside the premarket range, and the
 * balance of up versus down candles.
 */
function premarketTrend(
  candles: readonly MarketCandle[],
  open: number,
  close: number,
  high: number,
  low: number,
): SessionTrendDirection {
  const changePercent = percentOf(close - open, open) ?? 0;
  const position = positionInRange(close, high, low);
  const upCandles = candles.filter(
    (candle) => candle.close > candle.open,
  ).length;
  const downCandles = candles.filter(
    (candle) => candle.close < candle.open,
  ).length;

  let score = 0;
  if (changePercent > DIRECTIONAL_CHANGE_PERCENT) {
    score += 1;
  } else if (changePercent < -DIRECTIONAL_CHANGE_PERCENT) {
    score -= 1;
  }
  if (position !== null && position >= 0.66) {
    score += 1;
  } else if (position !== null && position <= 0.34) {
    score -= 1;
  }
  if (upCandles > downCandles) {
    score += 1;
  } else if (downCandles > upCandles) {
    score -= 1;
  }

  if (score >= 2) {
    return 'BULLISH';
  }
  return score <= -2 ? 'BEARISH' : 'NEUTRAL';
}

function premarketVolatility(rangePercent: number | null): SessionVolatility {
  if (rangePercent === null) {
    return 'UNKNOWN';
  }
  if (rangePercent >= PREMARKET_HIGH_RANGE_PERCENT) {
    return 'HIGH';
  }
  return rangePercent <= PREMARKET_LOW_RANGE_PERCENT ? 'LOW' : 'NORMAL';
}

export function buildPreviousSessionContext(
  candles: readonly MarketCandle[],
  date: string | null,
): PreviousSessionContext {
  if (candles.length === 0 || date === null) {
    return EMPTY_PREVIOUS_SESSION_CONTEXT;
  }

  const previousOpen = candles[0].open;
  const previousClose = candles[candles.length - 1].close;
  const changePercent = percentOf(previousClose - previousOpen, previousOpen);

  return {
    available: true,
    date,
    previousClose,
    previousHigh: Math.max(...candles.map((candle) => candle.high)),
    previousLow: Math.min(...candles.map((candle) => candle.low)),
    previousOpen,
    direction:
      changePercent === null ||
      Math.abs(changePercent) <= DIRECTIONAL_CHANGE_PERCENT
        ? 'NEUTRAL'
        : changePercent > 0
          ? 'BULLISH'
          : 'BEARISH',
    candleCount: candles.length,
  };
}

export function buildCurrentSessionFeatures(
  candles: readonly MarketCandle[],
  premarket: PremarketContext,
): CurrentSessionFeatures {
  if (candles.length === 0) {
    return EMPTY_CURRENT_SESSION_FEATURES;
  }

  const open = candles[0].open;
  const close = candles[candles.length - 1].close;
  const high = Math.max(...candles.map((candle) => candle.high));
  const low = Math.min(...candles.map((candle) => candle.low));
  const range = high - low;

  return {
    candleCount: candles.length,
    open,
    high,
    low,
    close,
    range: round(range),
    rangePercent: percentOf(range, low),
    changeFromOpen: round(close - open),
    changeFromOpenPercent: percentOf(close - open, open),
    positionInRange: positionInRange(close, high, low),
    slopePercent: slopePercent(candles),
    bullishCandleCount: candles.filter((candle) => candle.close > candle.open)
      .length,
    bearishCandleCount: candles.filter((candle) => candle.close < candle.open)
      .length,
    higherHighs: hasHigherHighs(candles),
    lowerLows: hasLowerLows(candles),
    aboveSessionOpen: close > open,
    abovePremarketHigh: premarket.high === null ? null : close > premarket.high,
    belowPremarketLow: premarket.low === null ? null : close < premarket.low,
  };
}

/** Average per-candle percentage change across the recent candles. */
function slopePercent(candles: readonly MarketCandle[]): number | null {
  const window = candles.slice(-SLOPE_LOOKBACK);
  if (window.length < 2) {
    return null;
  }
  const first = window[0].close;
  const last = window[window.length - 1].close;
  const total = percentOf(last - first, first);
  return total === null ? null : round(total / (window.length - 1));
}

function hasHigherHighs(candles: readonly MarketCandle[]): boolean {
  const window = candles.slice(-STRUCTURE_LOOKBACK);
  return (
    window.length === STRUCTURE_LOOKBACK &&
    window.every(
      (candle, index) => index === 0 || candle.high > window[index - 1].high,
    )
  );
}

function hasLowerLows(candles: readonly MarketCandle[]): boolean {
  const window = candles.slice(-STRUCTURE_LOOKBACK);
  return (
    window.length === STRUCTURE_LOOKBACK &&
    window.every(
      (candle, index) => index === 0 || candle.low < window[index - 1].low,
    )
  );
}

function positionInRange(
  value: number,
  high: number,
  low: number,
): number | null {
  const range = high - low;
  if (!Number.isFinite(range) || range <= 0) {
    return null;
  }
  return round((value - low) / range);
}

function percentOf(value: number, base: number): number | null {
  if (!Number.isFinite(base) || base === 0 || !Number.isFinite(value)) {
    return null;
  }
  return round((value / base) * 100);
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
