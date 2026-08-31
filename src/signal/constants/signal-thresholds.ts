/**
 * Weights of the directional evidence. Their sum is the highest score a
 * direction can reach, which is what confidence is measured against.
 */
export const DIRECTIONAL_WEIGHTS = {
  trendingRegime: 3,
  emaAlignment: 2.5,
  priceAboveFastEma: 1,
  adxConfirmedDirection: 2,
  strongAdx: 1,
  rsiSupport: 1.5,
} as const;

/**
 * Weights of the evidence against trading at all. Range-bound markets, weak
 * ADX and mixed EMAs deliberately contribute nothing here: an absence of
 * direction is NEUTRAL, not NO_TRADE.
 */
export const NO_TRADE_WEIGHTS = {
  highVolatilityRegime: 3,
  highVolatility: 1.5,
  lowRegimeConfidence: 2,
  conflict: 2,
  exhaustedWeakTrend: 1.5,
  dataQualityWarnings: 1,
} as const;

export const MAX_DIRECTIONAL_SCORE = Object.values(DIRECTIONAL_WEIGHTS).reduce(
  (total, weight) => total + weight,
  0,
);

/** NO_TRADE wins outright once the caution score reaches this level. */
export const NO_TRADE_SCORE_THRESHOLD = 4;
/** Below this, the winning direction is treated as an absence of direction. */
export const MIN_DIRECTIONAL_SCORE = 4;
/** A directional lead narrower than this is not an edge worth trading. */
export const MIN_DIRECTIONAL_MARGIN = 2;

/** Regime confidence below which the classification itself is shaky. */
export const LOW_REGIME_CONFIDENCE = 0.5;

/** RSI bands: support for a direction, and exhaustion of one. */
export const RSI_BULLISH_SUPPORT = 55;
export const RSI_BEARISH_SUPPORT = 45;
export const RSI_OVERBOUGHT = 70;
export const RSI_OVERSOLD = 30;

/** ADX bands, mirroring the regime classifier's own thresholds. */
export const ADX_TREND_CONFIRMATION = 25;
export const ADX_STRONG_TREND = 40;
export const ADX_WEAK_TREND = 20;

/** Confidence weighting of its components (must sum to 1). */
export const CONFIDENCE_WEIGHTS = {
  strength: 0.3,
  separation: 0.3,
  agreement: 0.4,
} as const;

/** Floor of the regime-confidence multiplier applied to signal confidence. */
export const REGIME_CONFIDENCE_FLOOR = 0.5;
/** Confidence multiplier applied when the regime reported data warnings. */
export const DATA_QUALITY_PENALTY = 0.9;
