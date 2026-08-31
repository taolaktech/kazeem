import {
  MarketRegime,
  type EmaAlignment,
} from '../regime/enums/market-regime.enum.js';
import type { RegimeFeatures } from '../regime/interfaces/indicator-features.interface.js';
import type { RegimeClassificationResult } from '../regime/interfaces/regime-result.interface.js';
import {
  ADX_STRONG_TREND,
  ADX_TREND_CONFIRMATION,
  ADX_WEAK_TREND,
  DIRECTIONAL_WEIGHTS,
  LOW_REGIME_CONFIDENCE,
  NO_TRADE_WEIGHTS,
  RSI_BEARISH_SUPPORT,
  RSI_BULLISH_SUPPORT,
  RSI_OVERBOUGHT,
  RSI_OVERSOLD,
} from './constants/signal-thresholds.js';

/** One piece of weighted evidence, with the wording it contributes. */
export interface SignalFactor {
  bullish?: number;
  bearish?: number;
  noTrade?: number;
  confirmation?: string;
  conflict?: string;
  riskFlag?: string;
}

type Direction = 'BULLISH' | 'BEARISH' | null;

/**
 * Turns a regime classification into weighted evidence. Every rule is
 * deterministic and reads only the features the classifier already computed.
 */
export function evaluateFactors(
  regime: RegimeClassificationResult,
): SignalFactor[] {
  const features = regime.features;
  const alignment = emaAlignment(features);
  const regimeDirection = directionOf(regime.primaryRegime);
  const diDirection = directionalDominance(features);

  return [
    ...regimeFactors(regime),
    ...emaFactors(features, alignment),
    ...adxFactors(features, diDirection),
    ...rsiFactors(features),
    ...conflictFactors(regime, alignment, regimeDirection, diDirection),
    ...dataQualityFactors(regime),
  ];
}

/** Price above/below all three EMAs in order, otherwise mixed. */
export function emaAlignment(features: RegimeFeatures): EmaAlignment {
  const { currentPrice, ema9, ema21, ema50 } = features;
  if (ema9 === undefined || ema21 === undefined || ema50 === undefined) {
    return 'MIXED';
  }
  if (currentPrice > ema9 && ema9 > ema21 && ema21 > ema50) {
    return 'BULLISH';
  }
  if (currentPrice < ema9 && ema9 < ema21 && ema21 < ema50) {
    return 'BEARISH';
  }
  return 'MIXED';
}

function regimeFactors(regime: RegimeClassificationResult): SignalFactor[] {
  switch (regime.primaryRegime) {
    case MarketRegime.TRENDING_BULLISH:
      return [
        {
          bullish: DIRECTIONAL_WEIGHTS.trendingRegime,
          confirmation: 'Market regime is TRENDING_BULLISH',
        },
      ];
    case MarketRegime.TRENDING_BEARISH:
      return [
        {
          bearish: DIRECTIONAL_WEIGHTS.trendingRegime,
          confirmation: 'Market regime is TRENDING_BEARISH',
        },
      ];
    case MarketRegime.HIGH_VOLATILITY:
      return [
        {
          noTrade: NO_TRADE_WEIGHTS.highVolatilityRegime,
          riskFlag: 'High volatility regime with no established direction',
        },
      ];
    case MarketRegime.RANGE_BOUND:
    case MarketRegime.LOW_VOLATILITY:
      return [];
  }
}

function emaFactors(
  features: RegimeFeatures,
  alignment: EmaAlignment,
): SignalFactor[] {
  const factors: SignalFactor[] = [];
  if (alignment === 'BULLISH') {
    factors.push({
      bullish: DIRECTIONAL_WEIGHTS.emaAlignment,
      confirmation: 'Price is above EMA9, EMA21 and EMA50',
    });
  } else if (alignment === 'BEARISH') {
    factors.push({
      bearish: DIRECTIONAL_WEIGHTS.emaAlignment,
      confirmation: 'Price is below EMA9, EMA21 and EMA50',
    });
  }

  if (features.ema9 !== undefined && alignment === 'MIXED') {
    factors.push({
      bullish:
        features.currentPrice > features.ema9
          ? DIRECTIONAL_WEIGHTS.priceAboveFastEma
          : undefined,
      bearish:
        features.currentPrice < features.ema9
          ? DIRECTIONAL_WEIGHTS.priceAboveFastEma
          : undefined,
    });
  }

  return factors;
}

function adxFactors(
  features: RegimeFeatures,
  diDirection: Direction,
): SignalFactor[] {
  const adx = features.adx;
  if (adx === undefined) {
    return [];
  }
  const factors: SignalFactor[] = [];

  if (adx >= ADX_TREND_CONFIRMATION && diDirection !== null) {
    const confirmation =
      diDirection === 'BULLISH'
        ? '+DI exceeds -DI with ADX above the trend threshold'
        : '-DI exceeds +DI with ADX above the trend threshold';
    factors.push({
      bullish:
        diDirection === 'BULLISH'
          ? DIRECTIONAL_WEIGHTS.adxConfirmedDirection
          : undefined,
      bearish:
        diDirection === 'BEARISH'
          ? DIRECTIONAL_WEIGHTS.adxConfirmedDirection
          : undefined,
      confirmation,
    });
  }

  if (adx >= ADX_STRONG_TREND && diDirection !== null) {
    factors.push({
      bullish:
        diDirection === 'BULLISH' ? DIRECTIONAL_WEIGHTS.strongAdx : undefined,
      bearish:
        diDirection === 'BEARISH' ? DIRECTIONAL_WEIGHTS.strongAdx : undefined,
      confirmation: 'ADX indicates a strong directional move',
    });
  }

  return factors;
}

function rsiFactors(features: RegimeFeatures): SignalFactor[] {
  const rsi = features.rsi;
  if (rsi === undefined) {
    return [];
  }
  const factors: SignalFactor[] = [];

  if (rsi > RSI_BULLISH_SUPPORT) {
    factors.push({
      bullish: DIRECTIONAL_WEIGHTS.rsiSupport,
      confirmation: 'RSI supports bullish momentum',
    });
  } else if (rsi < RSI_BEARISH_SUPPORT) {
    factors.push({
      bearish: DIRECTIONAL_WEIGHTS.rsiSupport,
      confirmation: 'RSI supports bearish momentum',
    });
  }

  const weakTrend = (features.adx ?? 0) < ADX_WEAK_TREND;
  if (rsi >= RSI_OVERBOUGHT) {
    factors.push({
      noTrade: weakTrend ? NO_TRADE_WEIGHTS.exhaustedWeakTrend : undefined,
      riskFlag: 'RSI is in overbought territory; exhaustion risk',
    });
  } else if (rsi <= RSI_OVERSOLD) {
    factors.push({
      noTrade: weakTrend ? NO_TRADE_WEIGHTS.exhaustedWeakTrend : undefined,
      riskFlag: 'RSI is in oversold territory; reversal risk',
    });
  }

  return factors;
}

function conflictFactors(
  regime: RegimeClassificationResult,
  alignment: EmaAlignment,
  regimeDirection: Direction,
  diDirection: Direction,
): SignalFactor[] {
  const factors: SignalFactor[] = [];
  const { rsi, adx } = regime.features;

  if (
    regimeDirection !== null &&
    diDirection !== null &&
    diDirection !== regimeDirection
  ) {
    factors.push({
      noTrade: NO_TRADE_WEIGHTS.conflict,
      conflict: `Directional movement opposes the ${regime.primaryRegime} regime`,
    });
  }

  if (regimeDirection !== null && rsi !== undefined) {
    const rsiOpposes =
      regimeDirection === 'BULLISH'
        ? rsi < RSI_BEARISH_SUPPORT
        : rsi > RSI_BULLISH_SUPPORT;
    if (rsiOpposes) {
      factors.push({
        noTrade: NO_TRADE_WEIGHTS.conflict,
        conflict: `RSI opposes the ${regime.primaryRegime} regime`,
      });
    }
  }

  if (
    regimeDirection !== null &&
    alignment === 'MIXED' &&
    (adx ?? 0) < ADX_WEAK_TREND
  ) {
    factors.push({
      noTrade: NO_TRADE_WEIGHTS.conflict,
      conflict: 'Trend regime is not backed by EMA structure or ADX',
    });
  }

  if (regime.secondaryCharacteristics.volatility === 'HIGH') {
    factors.push({
      noTrade: NO_TRADE_WEIGHTS.highVolatility,
      riskFlag: 'Volatility is elevated',
    });
  }

  if (regime.confidence < LOW_REGIME_CONFIDENCE) {
    factors.push({
      noTrade: NO_TRADE_WEIGHTS.lowRegimeConfidence,
      conflict: `Regime confidence is low (${regime.confidence})`,
    });
  }

  return factors;
}

function dataQualityFactors(
  regime: RegimeClassificationResult,
): SignalFactor[] {
  const { warnings, sufficientData } = regime.dataQuality;
  if (warnings.length === 0 && sufficientData) {
    return [];
  }
  return [
    {
      noTrade: NO_TRADE_WEIGHTS.dataQualityWarnings,
      riskFlag: sufficientData
        ? `Market data warnings reported by the classifier (${warnings.length})`
        : 'Classifier reported insufficient market data',
    },
  ];
}

function directionOf(regime: MarketRegime): Direction {
  if (regime === MarketRegime.TRENDING_BULLISH) {
    return 'BULLISH';
  }
  return regime === MarketRegime.TRENDING_BEARISH ? 'BEARISH' : null;
}

function directionalDominance(features: RegimeFeatures): Direction {
  const { plusDI, minusDI } = features;
  if (plusDI === undefined || minusDI === undefined || plusDI === minusDI) {
    return null;
  }
  return plusDI > minusDI ? 'BULLISH' : 'BEARISH';
}
