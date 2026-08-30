/** Indicator periods. */
export const EMA_FAST_PERIOD = 9;
export const EMA_MEDIUM_PERIOD = 21;
export const EMA_SLOW_PERIOD = 50;
export const ADX_PERIOD = 14;
export const RSI_PERIOD = 14;
export const ATR_PERIOD = 14;
export const BOLLINGER_PERIOD = 20;
export const BOLLINGER_STD_DEV = 2;
export const RELATIVE_VOLUME_PERIOD = 20;

/** Number of candles used to momentum-compare the current close against. */
export const MOMENTUM_LOOKBACK = 10;

/** Rolling window used to rank current volatility against its own recent history. */
export const VOLATILITY_HISTORY_WINDOW = 60;
/** Window used to detect Bollinger band expansion / contraction. */
export const BOLLINGER_EXPANSION_WINDOW = 5;

/** Data quality limits. */
export const MIN_REQUIRED_CANDLES = 60;
export const MIN_RECOMMENDED_CANDLES = 100;

/** Signal thresholds. */
export const ADX_TREND_THRESHOLD = 25;
export const ADX_STRONG_TREND_THRESHOLD = 40;
export const ADX_RANGE_THRESHOLD = 20;
export const RSI_BULLISH_THRESHOLD = 55;
export const RSI_BEARISH_THRESHOLD = 45;
export const MOMENTUM_THRESHOLD = 0.01;
export const RANGE_MOMENTUM_THRESHOLD = 0.005;
export const RANGE_EMA_DISTANCE_THRESHOLD = 0.01;
export const HIGH_VOLATILITY_RANK = 0.8;
export const LOW_VOLATILITY_RANK = 0.2;
export const BOLLINGER_EXPANSION_RATIO = 1.15;
export const BOLLINGER_CONTRACTION_RATIO = 0.9;
export const HIGH_RELATIVE_VOLUME = 1.5;
export const LOW_RELATIVE_VOLUME = 0.8;

/** Scoring weights, grouped by the regime whose score they contribute to. */
export const TREND_WEIGHTS = {
  emaAlignment: 3,
  priceVsEmaFast: 1,
  adxTrending: 2.5,
  adxStrong: 1,
  directionalDominance: 1.5,
  momentum: 1,
  rsi: 1,
} as const;

export const RANGE_WEIGHTS = {
  adxLow: 3,
  mixedEmaAlignment: 1.5,
  priceNearEmaMedium: 1.5,
  flatMomentum: 1,
  nonExpandingBands: 1,
} as const;

export const HIGH_VOLATILITY_WEIGHTS = {
  elevatedAtr: 3,
  expandingBands: 2,
  wideBands: 1.5,
  elevatedVolume: 1.5,
} as const;

export const LOW_VOLATILITY_WEIGHTS = {
  compressedAtr: 3,
  narrowBands: 2,
  adxLow: 1,
  belowAverageVolume: 1.5,
} as const;

/**
 * A volatility regime only wins outright when no trend regime reaches this
 * score; otherwise volatility is reported as a secondary characteristic.
 */
export const TREND_PRIORITY_MIN_SCORE = 5;

/** Confidence weighting of its individual components (must sum to 1). */
export const CONFIDENCE_WEIGHTS = {
  scoreStrength: 0.35,
  separation: 0.3,
  agreement: 0.35,
} as const;

/** Trend strength buckets, expressed in ADX. */
export const TREND_STRENGTH_MODERATE_ADX = 20;
export const TREND_STRENGTH_STRONG_ADX = 25;
