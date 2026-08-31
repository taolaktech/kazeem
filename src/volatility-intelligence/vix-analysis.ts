import { EMA } from 'technicalindicators';
import type { MarketSessionSnapshot } from '../market-data/session/session-context.interface.js';
import { candleCloseTime } from '../market-data/session/session-clock.js';
import {
  VIX_ACCELERATION_PERCENT,
  VIX_LEVEL_THRESHOLDS,
  VIX_MATERIAL_MOVE_PERCENT,
  VIX_MOMENTUM_PERCENT,
  VIX_SPIKE_PERCENT,
  VIX_TREND_SCORE_THRESHOLD,
} from './constants/volatility-thresholds.js';
import {
  VolatilityMomentum,
  VolatilityState,
  VolatilityTrend,
} from './enums/volatility.enum.js';
import type { VixMetrics } from './interfaces/volatility-intelligence-result.interface.js';
import {
  accelerationPercent,
  percentOf,
  positionInRange,
  round,
  windowChangePercent,
} from './series-metrics.js';

const EMA_FAST_PERIOD = 9;
const EMA_MEDIUM_PERIOD = 21;

export interface VixAnalysis {
  metrics: VixMetrics;
  state: VolatilityState;
  trend: VolatilityTrend;
  momentum: VolatilityMomentum;
  confirmations: string[];
  riskFlags: string[];
}

export const UNAVAILABLE_VIX_METRICS = (symbol: string): VixMetrics => ({
  symbol,
  available: false,
  premarketAvailable: false,
  current: null,
  asOf: null,
  previousClose: null,
  change: null,
  changePercent: null,
  sessionOpen: null,
  sessionHigh: null,
  sessionLow: null,
  changeFromOpen: null,
  changePercentFromOpen: null,
  ema9: null,
  ema21: null,
  shortMomentumPercent: null,
  acceleration: null,
  positionInSessionRange: null,
  spikeDetected: false,
  currentSessionCandleCount: 0,
  indicatorCandleCount: 0,
});

/** The analysis returned when the provider has no usable VIX data. */
export function unavailableVix(symbol: string): VixAnalysis {
  return {
    metrics: UNAVAILABLE_VIX_METRICS(symbol),
    state: VolatilityState.UNKNOWN,
    trend: VolatilityTrend.UNKNOWN,
    momentum: VolatilityMomentum.UNKNOWN,
    confirmations: [],
    riskFlags: ['VIX data is unavailable from the market data provider'],
  };
}

export interface VixAnalysisOptions {
  symbol: string;
  momentumLookbackCandles: number;
}

/**
 * Turns a session-partitioned VIX series into level, trend and momentum
 * evidence. Level and direction are deliberately independent: VIX 28 falling
 * fast is a different environment from VIX 28 accelerating higher.
 */
export function analyzeVix(
  snapshot: MarketSessionSnapshot,
  options: VixAnalysisOptions,
): VixAnalysis {
  const { symbol, momentumLookbackCandles } = options;
  const { currentSessionCandles, indicatorCandles, currentSessionFeatures } =
    snapshot;

  const latest =
    currentSessionCandles[currentSessionCandles.length - 1] ??
    indicatorCandles[indicatorCandles.length - 1];
  if (latest === undefined) {
    return unavailableVix(symbol);
  }

  const current = latest.close;
  const previousClose = snapshot.previousSession.previousClose;
  const sessionOpen = currentSessionFeatures.open;
  const closes = indicatorCandles.map((candle) => candle.close);
  const momentumCandles =
    currentSessionCandles.length > momentumLookbackCandles
      ? currentSessionCandles
      : indicatorCandles;

  const change = previousClose === null ? null : round(current - previousClose);
  const changePercent =
    previousClose === null
      ? null
      : percentOf(current - previousClose, previousClose);
  const changeFromOpen =
    sessionOpen === null ? null : round(current - sessionOpen);
  const changePercentFromOpen =
    sessionOpen === null ? null : percentOf(current - sessionOpen, sessionOpen);
  const shortMomentumPercent = windowChangePercent(
    momentumCandles,
    momentumLookbackCandles,
  );
  const acceleration = accelerationPercent(
    momentumCandles,
    momentumLookbackCandles,
  );
  const ema9 = lastEma(closes, EMA_FAST_PERIOD);
  const ema21 = lastEma(closes, EMA_MEDIUM_PERIOD);

  const metrics: VixMetrics = {
    symbol,
    available: true,
    premarketAvailable: snapshot.premarket.available,
    current,
    asOf: candleCloseTime(latest, snapshot.context.timeframeMinutes),
    previousClose,
    change,
    changePercent,
    sessionOpen,
    sessionHigh: currentSessionFeatures.high,
    sessionLow: currentSessionFeatures.low,
    changeFromOpen,
    changePercentFromOpen,
    ema9,
    ema21,
    shortMomentumPercent,
    acceleration,
    positionInSessionRange: positionInRange(
      current,
      currentSessionFeatures.high,
      currentSessionFeatures.low,
    ),
    spikeDetected:
      shortMomentumPercent !== null &&
      Math.abs(shortMomentumPercent) >= VIX_SPIKE_PERCENT,
    currentSessionCandleCount: currentSessionCandles.length,
    indicatorCandleCount: indicatorCandles.length,
  };

  const momentum = classifyMomentum(shortMomentumPercent, acceleration);
  const trend = classifyTrend(metrics, momentum);
  const state = classifyState(current);

  return {
    metrics,
    state,
    trend,
    momentum,
    confirmations: describeConfirmations(metrics, trend, momentum),
    riskFlags: describeRiskFlags(metrics, state, momentum),
  };
}

/** Absolute level only; it never decides direction on its own. */
export function classifyState(value: number | null): VolatilityState {
  if (value === null || !Number.isFinite(value)) {
    return VolatilityState.UNKNOWN;
  }
  if (value < VIX_LEVEL_THRESHOLDS.normal) {
    return VolatilityState.LOW;
  }
  if (value < VIX_LEVEL_THRESHOLDS.elevated) {
    return VolatilityState.NORMAL;
  }
  if (value < VIX_LEVEL_THRESHOLDS.high) {
    return VolatilityState.ELEVATED;
  }
  return value < VIX_LEVEL_THRESHOLDS.extreme
    ? VolatilityState.HIGH
    : VolatilityState.EXTREME;
}

/**
 * Pace of the recent move. A merely rising move is promoted to RISING_FAST
 * when it is also accelerating, which is what a developing spike looks like
 * before its magnitude is obvious.
 */
export function classifyMomentum(
  shortMomentumPercent: number | null,
  acceleration: number | null,
): VolatilityMomentum {
  if (shortMomentumPercent === null) {
    return VolatilityMomentum.UNKNOWN;
  }
  const accelerating =
    acceleration !== null && acceleration >= VIX_ACCELERATION_PERCENT;
  const decelerating =
    acceleration !== null && acceleration <= -VIX_ACCELERATION_PERCENT;

  if (shortMomentumPercent >= VIX_MOMENTUM_PERCENT.fast) {
    return VolatilityMomentum.RISING_FAST;
  }
  if (shortMomentumPercent >= VIX_MOMENTUM_PERCENT.moving) {
    return accelerating
      ? VolatilityMomentum.RISING_FAST
      : VolatilityMomentum.RISING;
  }
  if (shortMomentumPercent <= -VIX_MOMENTUM_PERCENT.fast) {
    return VolatilityMomentum.FALLING_FAST;
  }
  if (shortMomentumPercent <= -VIX_MOMENTUM_PERCENT.moving) {
    return decelerating
      ? VolatilityMomentum.FALLING_FAST
      : VolatilityMomentum.FALLING;
  }
  return VolatilityMomentum.FLAT;
}

/**
 * Multi-factor, never a single candle: EMA stack, move from the previous
 * close, move from the session open and short-term momentum each contribute.
 */
export function classifyTrend(
  metrics: VixMetrics,
  momentum: VolatilityMomentum,
): VolatilityTrend {
  const { current, ema9, ema21, changePercent, changePercentFromOpen } =
    metrics;
  if (current === null) {
    return VolatilityTrend.UNKNOWN;
  }

  let score = 0;
  if (ema9 !== null && ema21 !== null) {
    if (current > ema9 && ema9 > ema21) {
      score += 1;
    } else if (current < ema9 && ema9 < ema21) {
      score -= 1;
    }
  }
  score += directionalPoint(changePercent, VIX_MATERIAL_MOVE_PERCENT);
  score += directionalPoint(changePercentFromOpen, VIX_MATERIAL_MOVE_PERCENT);
  if (
    momentum === VolatilityMomentum.RISING ||
    momentum === VolatilityMomentum.RISING_FAST
  ) {
    score += 1;
  } else if (
    momentum === VolatilityMomentum.FALLING ||
    momentum === VolatilityMomentum.FALLING_FAST
  ) {
    score -= 1;
  }

  if (score >= VIX_TREND_SCORE_THRESHOLD) {
    return VolatilityTrend.RISING;
  }
  return score <= -VIX_TREND_SCORE_THRESHOLD
    ? VolatilityTrend.FALLING
    : VolatilityTrend.FLAT;
}

function directionalPoint(
  percent: number | null,
  threshold: number,
): -1 | 0 | 1 {
  if (percent === null) {
    return 0;
  }
  if (percent >= threshold) {
    return 1;
  }
  return percent <= -threshold ? -1 : 0;
}

function describeConfirmations(
  metrics: VixMetrics,
  trend: VolatilityTrend,
  momentum: VolatilityMomentum,
): string[] {
  const notes: string[] = [];
  const { current, ema9, ema21 } = metrics;
  if (current !== null && ema9 !== null && ema21 !== null) {
    if (current > ema9 && current > ema21) {
      notes.push('VIX is above EMA9 and EMA21');
    } else if (current < ema9 && current < ema21) {
      notes.push('VIX is below EMA9 and EMA21');
    }
  }
  if (
    momentum === VolatilityMomentum.RISING ||
    momentum === VolatilityMomentum.RISING_FAST
  ) {
    notes.push('VIX short-term momentum is rising');
  }
  if (
    momentum === VolatilityMomentum.FALLING ||
    momentum === VolatilityMomentum.FALLING_FAST
  ) {
    notes.push('VIX short-term momentum is falling');
  }
  if (
    metrics.acceleration !== null &&
    metrics.acceleration >= VIX_ACCELERATION_PERCENT
  ) {
    notes.push('VIX is accelerating higher');
  }
  if (trend !== VolatilityTrend.FLAT && trend !== VolatilityTrend.UNKNOWN) {
    notes.push(`VIX trend is ${trend.toLowerCase()}`);
  }
  return notes;
}

function describeRiskFlags(
  metrics: VixMetrics,
  state: VolatilityState,
  momentum: VolatilityMomentum,
): string[] {
  const flags: string[] = [];
  if (momentum === VolatilityMomentum.RISING_FAST) {
    flags.push('VIX is rising rapidly');
  }
  if (
    metrics.acceleration !== null &&
    metrics.acceleration >= VIX_ACCELERATION_PERCENT
  ) {
    flags.push('VIX volatility expansion is accelerating');
  }
  if (metrics.spikeDetected) {
    const direction =
      (metrics.shortMomentumPercent ?? 0) > 0 ? 'higher' : 'lower';
    flags.push(`VIX spiked ${direction} over the last few candles`);
  }
  if (state === VolatilityState.ELEVATED || state === VolatilityState.HIGH) {
    flags.push('VIX is at an elevated level');
  }
  if (state === VolatilityState.EXTREME) {
    flags.push('VIX is at an extreme level');
  }
  return flags;
}

function lastEma(values: number[], period: number): number | null {
  if (values.length < period) {
    return null;
  }
  const series = EMA.calculate({ period, values });
  const value = series[series.length - 1];
  return value === undefined || !Number.isFinite(value) ? null : round(value);
}
