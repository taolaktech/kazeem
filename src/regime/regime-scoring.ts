import {
  MARKET_REGIMES,
  MarketRegime,
  TREND_REGIMES,
  VOLATILITY_REGIMES,
} from './enums/market-regime.enum.js';
import type { IndicatorSnapshot } from './interfaces/indicator-features.interface.js';
import {
  ADX_RANGE_THRESHOLD,
  ADX_STRONG_TREND_THRESHOLD,
  ADX_TREND_THRESHOLD,
  BOLLINGER_CONTRACTION_RATIO,
  BOLLINGER_EXPANSION_RATIO,
  HIGH_RELATIVE_VOLUME,
  HIGH_VOLATILITY_RANK,
  HIGH_VOLATILITY_WEIGHTS,
  LOW_RELATIVE_VOLUME,
  LOW_VOLATILITY_RANK,
  LOW_VOLATILITY_WEIGHTS,
  MOMENTUM_THRESHOLD,
  RANGE_EMA_DISTANCE_THRESHOLD,
  RANGE_MOMENTUM_THRESHOLD,
  RANGE_WEIGHTS,
  RSI_BEARISH_THRESHOLD,
  RSI_BULLISH_THRESHOLD,
  TREND_PRIORITY_MIN_SCORE,
  TREND_WEIGHTS,
} from './regime.constants.js';

export interface RegimeSignal {
  weight: number;
  /** False when the underlying indicator could not be computed. */
  applicable: boolean;
  matched: boolean;
  description: string;
}

export type RegimeSignals = Record<MarketRegime, RegimeSignal[]>;

export function buildSignals(snapshot: IndicatorSnapshot): RegimeSignals {
  return {
    [MarketRegime.TRENDING_BULLISH]: bullishSignals(snapshot),
    [MarketRegime.TRENDING_BEARISH]: bearishSignals(snapshot),
    [MarketRegime.RANGE_BOUND]: rangeSignals(snapshot),
    [MarketRegime.HIGH_VOLATILITY]: highVolatilitySignals(snapshot),
    [MarketRegime.LOW_VOLATILITY]: lowVolatilitySignals(snapshot),
  };
}

export function scoreSignals(
  signals: RegimeSignals,
): Record<MarketRegime, number> {
  const scores = {} as Record<MarketRegime, number>;
  for (const regime of MARKET_REGIMES) {
    scores[regime] = round(
      signals[regime]
        .filter((signal) => signal.applicable && signal.matched)
        .reduce((total, signal) => total + signal.weight, 0),
    );
  }
  return scores;
}

export function maxAttainableScore(signals: RegimeSignal[]): number {
  return signals
    .filter((signal) => signal.applicable)
    .reduce((total, signal) => total + signal.weight, 0);
}

function bullishSignals(snapshot: IndicatorSnapshot): RegimeSignal[] {
  const { features, emaAlignment, momentum } = snapshot;
  const { adx, plusDI, minusDI, rsi, ema9 } = features;
  return [
    signal(
      TREND_WEIGHTS.emaAlignment,
      true,
      emaAlignment === 'BULLISH',
      'Price > EMA9 > EMA21 > EMA50 (bullish EMA alignment)',
    ),
    signal(
      TREND_WEIGHTS.priceVsEmaFast,
      ema9 !== undefined,
      ema9 !== undefined && features.currentPrice > ema9,
      'Price trades above EMA9',
    ),
    signal(
      TREND_WEIGHTS.adxTrending,
      adx !== undefined,
      adx !== undefined && adx > ADX_TREND_THRESHOLD,
      `ADX above ${ADX_TREND_THRESHOLD} (directional market)`,
    ),
    signal(
      TREND_WEIGHTS.adxStrong,
      adx !== undefined,
      adx !== undefined && adx > ADX_STRONG_TREND_THRESHOLD,
      `ADX above ${ADX_STRONG_TREND_THRESHOLD} (very strong trend)`,
    ),
    signal(
      TREND_WEIGHTS.directionalDominance,
      plusDI !== undefined && minusDI !== undefined,
      plusDI !== undefined && minusDI !== undefined && plusDI > minusDI,
      '+DI dominates -DI',
    ),
    signal(
      TREND_WEIGHTS.momentum,
      true,
      momentum > MOMENTUM_THRESHOLD,
      'Positive price momentum over the lookback window',
    ),
    signal(
      TREND_WEIGHTS.rsi,
      rsi !== undefined,
      rsi !== undefined && rsi > RSI_BULLISH_THRESHOLD,
      `RSI above ${RSI_BULLISH_THRESHOLD}`,
    ),
  ];
}

function bearishSignals(snapshot: IndicatorSnapshot): RegimeSignal[] {
  const { features, emaAlignment, momentum } = snapshot;
  const { adx, plusDI, minusDI, rsi, ema9 } = features;
  return [
    signal(
      TREND_WEIGHTS.emaAlignment,
      true,
      emaAlignment === 'BEARISH',
      'Price < EMA9 < EMA21 < EMA50 (bearish EMA alignment)',
    ),
    signal(
      TREND_WEIGHTS.priceVsEmaFast,
      ema9 !== undefined,
      ema9 !== undefined && features.currentPrice < ema9,
      'Price trades below EMA9',
    ),
    signal(
      TREND_WEIGHTS.adxTrending,
      adx !== undefined,
      adx !== undefined && adx > ADX_TREND_THRESHOLD,
      `ADX above ${ADX_TREND_THRESHOLD} (directional market)`,
    ),
    signal(
      TREND_WEIGHTS.adxStrong,
      adx !== undefined,
      adx !== undefined && adx > ADX_STRONG_TREND_THRESHOLD,
      `ADX above ${ADX_STRONG_TREND_THRESHOLD} (very strong trend)`,
    ),
    signal(
      TREND_WEIGHTS.directionalDominance,
      plusDI !== undefined && minusDI !== undefined,
      plusDI !== undefined && minusDI !== undefined && minusDI > plusDI,
      '-DI dominates +DI',
    ),
    signal(
      TREND_WEIGHTS.momentum,
      true,
      momentum < -MOMENTUM_THRESHOLD,
      'Negative price momentum over the lookback window',
    ),
    signal(
      TREND_WEIGHTS.rsi,
      rsi !== undefined,
      rsi !== undefined && rsi < RSI_BEARISH_THRESHOLD,
      `RSI below ${RSI_BEARISH_THRESHOLD}`,
    ),
  ];
}

function rangeSignals(snapshot: IndicatorSnapshot): RegimeSignal[] {
  const { features, emaAlignment, momentum, distanceFromEma21 } = snapshot;
  const { adx } = features;
  const expansion = snapshot.bollingerWidthExpansion;
  return [
    signal(
      RANGE_WEIGHTS.adxLow,
      adx !== undefined,
      adx !== undefined && adx < ADX_RANGE_THRESHOLD,
      `ADX below ${ADX_RANGE_THRESHOLD} (no directional pressure)`,
    ),
    signal(
      RANGE_WEIGHTS.mixedEmaAlignment,
      true,
      emaAlignment === 'MIXED',
      'EMAs are interleaved rather than stacked',
    ),
    signal(
      RANGE_WEIGHTS.priceNearEmaMedium,
      distanceFromEma21 !== undefined,
      distanceFromEma21 !== undefined &&
        Math.abs(distanceFromEma21) < RANGE_EMA_DISTANCE_THRESHOLD,
      'Price oscillates close to EMA21',
    ),
    signal(
      RANGE_WEIGHTS.flatMomentum,
      true,
      Math.abs(momentum) < RANGE_MOMENTUM_THRESHOLD,
      'Momentum is flat over the lookback window',
    ),
    signal(
      RANGE_WEIGHTS.nonExpandingBands,
      expansion !== undefined,
      expansion !== undefined && expansion < BOLLINGER_EXPANSION_RATIO,
      'Bollinger bands are stable or contracting',
    ),
  ];
}

function highVolatilitySignals(snapshot: IndicatorSnapshot): RegimeSignal[] {
  const { atrPercentRank, bollingerWidthRank, bollingerWidthExpansion } =
    snapshot;
  const relativeVolume = snapshot.features.relativeVolume;
  return [
    signal(
      HIGH_VOLATILITY_WEIGHTS.elevatedAtr,
      atrPercentRank !== undefined,
      atrPercentRank !== undefined && atrPercentRank >= HIGH_VOLATILITY_RANK,
      'ATR% is high relative to its own recent history',
    ),
    signal(
      HIGH_VOLATILITY_WEIGHTS.expandingBands,
      bollingerWidthExpansion !== undefined,
      bollingerWidthExpansion !== undefined &&
        bollingerWidthExpansion > BOLLINGER_EXPANSION_RATIO,
      'Bollinger bands are expanding',
    ),
    signal(
      HIGH_VOLATILITY_WEIGHTS.wideBands,
      bollingerWidthRank !== undefined,
      bollingerWidthRank !== undefined &&
        bollingerWidthRank >= HIGH_VOLATILITY_RANK,
      'Bollinger width is wide relative to its own recent history',
    ),
    signal(
      HIGH_VOLATILITY_WEIGHTS.elevatedVolume,
      relativeVolume !== undefined,
      relativeVolume !== undefined && relativeVolume > HIGH_RELATIVE_VOLUME,
      `Relative volume above ${HIGH_RELATIVE_VOLUME}x`,
    ),
  ];
}

function lowVolatilitySignals(snapshot: IndicatorSnapshot): RegimeSignal[] {
  const { atrPercentRank, bollingerWidthRank, bollingerWidthExpansion } =
    snapshot;
  const { adx, relativeVolume } = snapshot.features;
  const contracting =
    bollingerWidthExpansion !== undefined &&
    bollingerWidthExpansion < BOLLINGER_CONTRACTION_RATIO;
  return [
    signal(
      LOW_VOLATILITY_WEIGHTS.compressedAtr,
      atrPercentRank !== undefined,
      atrPercentRank !== undefined && atrPercentRank <= LOW_VOLATILITY_RANK,
      'ATR% is compressed relative to its own recent history',
    ),
    signal(
      LOW_VOLATILITY_WEIGHTS.narrowBands,
      bollingerWidthRank !== undefined,
      (bollingerWidthRank !== undefined &&
        bollingerWidthRank <= LOW_VOLATILITY_RANK) ||
        contracting,
      'Bollinger width is narrow or contracting',
    ),
    signal(
      LOW_VOLATILITY_WEIGHTS.adxLow,
      adx !== undefined,
      adx !== undefined && adx < ADX_RANGE_THRESHOLD,
      `ADX below ${ADX_RANGE_THRESHOLD}`,
    ),
    signal(
      LOW_VOLATILITY_WEIGHTS.belowAverageVolume,
      relativeVolume !== undefined,
      relativeVolume !== undefined && relativeVolume < LOW_RELATIVE_VOLUME,
      `Relative volume below ${LOW_RELATIVE_VOLUME}x`,
    ),
  ];
}

function signal(
  weight: number,
  applicable: boolean,
  matched: boolean,
  description: string,
): RegimeSignal {
  return { weight, applicable, matched: applicable && matched, description };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface RegimeSelection {
  regime: MarketRegime;
  /** Set when a trend regime outscored the winner but failed the ADX gate. */
  suppressedTrend?: { regime: MarketRegime; score: number; adx: number };
}

/**
 * Highest score wins, with two guards: a trend regime needs directional
 * strength (ADX >= ADX_RANGE_THRESHOLD) to be eligible at all, and a
 * volatility regime never overrides a strongly supported trend — volatility
 * then only shows up in the secondary characteristics.
 *
 * The first guard is why a lower-scoring RANGE_BOUND can win over a
 * higher-scoring trend regime, so the suppressed trend is reported back for
 * the reasoning output. Exact ties fall back to MARKET_REGIMES order.
 */
export function selectPrimaryRegime(
  scores: Record<MarketRegime, number>,
  adxFeature: number | undefined,
): RegimeSelection {
  const adx = adxFeature ?? 0;
  const trendEligible = adx >= ADX_RANGE_THRESHOLD;
  const candidates = trendEligible
    ? MARKET_REGIMES
    : MARKET_REGIMES.filter((regime) => !TREND_REGIMES.includes(regime));
  const bestTrend = bestOf(scores, TREND_REGIMES);
  const suppressedTrend =
    !trendEligible && scores[bestTrend] > 0
      ? { regime: bestTrend, score: scores[bestTrend], adx }
      : undefined;

  const leader = rankRegimes(scores, candidates)[0];
  if (!VOLATILITY_REGIMES.includes(leader)) {
    return { regime: leader, suppressedTrend };
  }
  const regime =
    trendEligible &&
    adx >= ADX_TREND_THRESHOLD &&
    scores[bestTrend] >= TREND_PRIORITY_MIN_SCORE
      ? bestTrend
      : leader;
  return { regime, suppressedTrend };
}

function rankRegimes(
  scores: Record<MarketRegime, number>,
  candidates: readonly MarketRegime[],
): MarketRegime[] {
  return [...candidates].sort((left, right) => {
    const difference = scores[right] - scores[left];
    return difference !== 0
      ? difference
      : MARKET_REGIMES.indexOf(left) - MARKET_REGIMES.indexOf(right);
  });
}

function bestOf(
  scores: Record<MarketRegime, number>,
  candidates: readonly MarketRegime[],
): MarketRegime {
  return [...candidates].sort((left, right) => scores[right] - scores[left])[0];
}
