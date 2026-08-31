import type { MarketCandle } from '../interfaces/market-candle.interface.js';
import type {
  OpeningRangeBreakoutStrength,
  OpeningRangeContext,
  OpeningRangePosition,
  OpeningRangeVolumeConfirmation,
} from './session-context.interface.js';
import { REGULAR_OPEN_MINUTE, toEastern } from './session-clock.js';

/**
 * Percent of price a close must clear a boundary by before it counts as a
 * breakout. Deliberately conservative: it filters floating-point and one-tick
 * excursions without swallowing a genuine move.
 */
export const DEFAULT_BREAKOUT_TOLERANCE_PERCENT = 0.05;

/** Excursion beyond the boundary, as a fraction of the range, per strength. */
const STRENGTH_EXCURSION = {
  moderate: 0.25,
  strong: 0.75,
} as const;

/** Breakout-candle volume versus the average opening-range candle. */
const VOLUME_CONFIRMATION_RATIO = 1;

export interface OpeningRangeOptions {
  now: Date;
  /** Trading date the current-session candles belong to, as YYYY-MM-DD. */
  sessionDate: string;
  timeframeMinutes: number;
  windowMinutes: number;
  breakoutTolerancePercent?: number;
}

export function unavailableOpeningRange(
  options: OpeningRangeOptions,
): OpeningRangeContext {
  return {
    available: false,
    status: 'UNAVAILABLE',
    ...windowLabels(options.windowMinutes),
    windowMinutes: options.windowMinutes,
    candleCount: 0,
    expectedCandleCount: expectedCandles(options),
    open: null,
    high: null,
    low: null,
    close: null,
    volume: null,
    range: null,
    rangePercent: null,
    currentPrice: null,
    currentPricePosition: 'UNKNOWN',
    distanceFromHighPercent: null,
    distanceFromLowPercent: null,
    breakoutTolerancePercent: tolerance(options),
    breakoutAbove: false,
    breakdownBelow: false,
    closesAboveHigh: 0,
    closesBelowLow: 0,
    failedBreakoutAbove: false,
    failedBreakdownBelow: false,
    breakoutStrength: 'NONE',
    volumeConfirmation: 'UNKNOWN',
    relativeBreakoutVolume: null,
    totalPostRangeCandleCount: 0,
  };
}

/**
 * Builds the opening range from the current session's completed candles.
 *
 * Only candles opening inside [09:30, 09:30 + window) contribute to the
 * levels, so the high and low stop moving the moment the window closes even
 * though the session high and low keep updating. Because the input contains
 * completed candles only, the same call is correct live and when replaying a
 * historical instant: nothing after `now` can leak into the result.
 */
export function buildOpeningRangeContext(
  currentSessionCandles: readonly MarketCandle[],
  options: OpeningRangeOptions,
): OpeningRangeContext {
  const windowEndMinute = REGULAR_OPEN_MINUTE + options.windowMinutes;
  const rangeCandles = currentSessionCandles.filter((candle) => {
    const { minutesOfDay } = toEastern(candle.timestamp);
    return (
      minutesOfDay >= REGULAR_OPEN_MINUTE && minutesOfDay < windowEndMinute
    );
  });
  const postRangeCandles = currentSessionCandles.filter(
    (candle) => toEastern(candle.timestamp).minutesOfDay >= windowEndMinute,
  );

  const elapsed = isWindowElapsed(options, windowEndMinute);
  if (rangeCandles.length === 0) {
    const empty = unavailableOpeningRange(options);
    return elapsed ? empty : { ...empty, status: 'FORMING' };
  }

  const open = rangeCandles[0].open;
  const high = Math.max(...rangeCandles.map((candle) => candle.high));
  const low = Math.min(...rangeCandles.map((candle) => candle.low));
  const close = rangeCandles[rangeCandles.length - 1].close;
  const volume = rangeCandles.reduce(
    (total, candle) => total + candle.volume,
    0,
  );
  const range = high - low;

  const latest =
    postRangeCandles[postRangeCandles.length - 1] ??
    rangeCandles[rangeCandles.length - 1];
  const currentPrice = latest.close;
  const upperBound = high * (1 + tolerance(options) / 100);
  const lowerBound = low * (1 - tolerance(options) / 100);

  // Breakouts are only meaningful once the levels are final, and only a
  // completed candle *close* beyond a boundary counts as confirmation.
  const confirming = elapsed ? postRangeCandles : [];
  const closesAboveHigh = confirming.filter(
    (candle) => candle.close > upperBound,
  ).length;
  const closesBelowLow = confirming.filter(
    (candle) => candle.close < lowerBound,
  ).length;
  const breakoutAbove = elapsed && currentPrice > upperBound;
  const breakdownBelow = elapsed && currentPrice < lowerBound;

  const tradedAbove = confirming.some((candle) => candle.high > upperBound);
  const tradedBelow = confirming.some((candle) => candle.low < lowerBound);
  const volumeRatio = relativeBreakoutVolume(rangeCandles, confirming);
  const confirmation = volumeConfirmation(volumeRatio);

  return {
    available: true,
    status: elapsed ? 'COMPLETE' : 'FORMING',
    ...windowLabels(options.windowMinutes),
    windowMinutes: options.windowMinutes,
    candleCount: rangeCandles.length,
    expectedCandleCount: expectedCandles(options),
    open,
    high,
    low,
    close,
    volume,
    range: round(range),
    rangePercent: percentOf(range, open),
    currentPrice,
    currentPricePosition: position(
      elapsed,
      currentPrice,
      upperBound,
      lowerBound,
    ),
    distanceFromHighPercent: percentOf(currentPrice - high, high),
    distanceFromLowPercent: percentOf(currentPrice - low, low),
    breakoutTolerancePercent: tolerance(options),
    breakoutAbove,
    breakdownBelow,
    closesAboveHigh,
    closesBelowLow,
    failedBreakoutAbove: tradedAbove && !breakoutAbove,
    failedBreakdownBelow: tradedBelow && !breakdownBelow,
    breakoutStrength: breakoutStrength(
      breakoutAbove || breakdownBelow,
      breakoutAbove ? currentPrice - high : low - currentPrice,
      range,
      breakoutAbove ? closesAboveHigh : closesBelowLow,
      confirmation,
    ),
    volumeConfirmation: confirmation,
    relativeBreakoutVolume: volumeRatio,
    totalPostRangeCandleCount: postRangeCandles.length,
  };
}

/**
 * The window is done once the evaluation instant has passed its end on the
 * session's own trading date; evidence carried over from an earlier date
 * always describes a finished window.
 */
function isWindowElapsed(
  options: OpeningRangeOptions,
  windowEndMinute: number,
): boolean {
  const { date, minutesOfDay } = toEastern(options.now);
  if (date !== options.sessionDate) {
    return date > options.sessionDate;
  }
  return minutesOfDay >= windowEndMinute;
}

function position(
  elapsed: boolean,
  currentPrice: number,
  upperBound: number,
  lowerBound: number,
): OpeningRangePosition {
  if (!elapsed) {
    return 'UNKNOWN';
  }
  if (currentPrice > upperBound) {
    return 'ABOVE';
  }
  return currentPrice < lowerBound ? 'BELOW' : 'INSIDE';
}

/**
 * Participation is measured against the opening range's own candles rather
 * than the rolling RVOL the indicator layer computes: RVOL is not normalised
 * by time of day, so it cannot say whether *this* breakout drew volume.
 */
function relativeBreakoutVolume(
  rangeCandles: readonly MarketCandle[],
  postRangeCandles: readonly MarketCandle[],
): number | null {
  if (postRangeCandles.length === 0) {
    return null;
  }
  const rangeAverage =
    rangeCandles.reduce((total, candle) => total + candle.volume, 0) /
    rangeCandles.length;
  const postAverage =
    postRangeCandles.reduce((total, candle) => total + candle.volume, 0) /
    postRangeCandles.length;
  if (rangeAverage <= 0) {
    return null;
  }
  return round(postAverage / rangeAverage);
}

function volumeConfirmation(
  ratio: number | null,
): OpeningRangeVolumeConfirmation {
  if (ratio === null) {
    return 'UNKNOWN';
  }
  return ratio >= VOLUME_CONFIRMATION_RATIO ? 'CONFIRMED' : 'NOT_CONFIRMED';
}

/**
 * Distance travelled beyond the boundary relative to the range width, with
 * repeated confirming closes and participation able to lift it one band.
 * Volume supports the reading; it never gates it.
 */
function breakoutStrength(
  broken: boolean,
  excursion: number,
  range: number,
  confirmingCloses: number,
  confirmation: OpeningRangeVolumeConfirmation,
): OpeningRangeBreakoutStrength {
  if (!broken || range <= 0 || excursion <= 0) {
    return broken ? 'WEAK' : 'NONE';
  }
  const ratio = excursion / range;
  const base: OpeningRangeBreakoutStrength =
    ratio >= STRENGTH_EXCURSION.strong
      ? 'STRONG'
      : ratio >= STRENGTH_EXCURSION.moderate
        ? 'MODERATE'
        : 'WEAK';
  const supported = confirmingCloses >= 2 && confirmation === 'CONFIRMED';
  if (!supported) {
    return base;
  }
  return base === 'WEAK' ? 'MODERATE' : 'STRONG';
}

function expectedCandles(options: OpeningRangeOptions): number {
  return Math.floor(options.windowMinutes / options.timeframeMinutes);
}

function windowLabels(windowMinutes: number): {
  startTime: string;
  endTime: string;
} {
  return {
    startTime: clockLabel(REGULAR_OPEN_MINUTE),
    endTime: clockLabel(REGULAR_OPEN_MINUTE + windowMinutes),
  };
}

function clockLabel(minutesOfDay: number): string {
  const hours = Math.floor(minutesOfDay / 60);
  const minutes = minutesOfDay % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function tolerance(options: OpeningRangeOptions): number {
  return options.breakoutTolerancePercent ?? DEFAULT_BREAKOUT_TOLERANCE_PERCENT;
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
