import type { EmaAlignment } from '../enums/market-regime.enum.js';

/** Indicator values reported back to callers of the classifier. */
export interface RegimeFeatures {
  currentPrice: number;
  ema9?: number;
  ema21?: number;
  ema50?: number;
  adx?: number;
  plusDI?: number;
  minusDI?: number;
  rsi?: number;
  atr?: number;
  atrPercent?: number;
  bollingerWidth?: number;
  relativeVolume?: number;
}

/**
 * Everything the scoring rules need: the raw indicator values plus the
 * derived, symbol-independent measures (percentile ranks, alignment, momentum).
 */
export interface IndicatorSnapshot {
  features: RegimeFeatures;
  emaAlignment: EmaAlignment;
  /** Fractional price change over MOMENTUM_LOOKBACK candles, e.g. 0.021 = +2.1%. */
  momentum: number;
  /** Distance of the close from EMA21, as a fraction of EMA21. */
  distanceFromEma21?: number;
  /** Rank of the current ATR% within its rolling history, in [0, 1]. */
  atrPercentRank?: number;
  /** Rank of the current Bollinger width within its rolling history, in [0, 1]. */
  bollingerWidthRank?: number;
  /** Current Bollinger width divided by its average over the preceding candles. */
  bollingerWidthExpansion?: number;
  warnings: string[];
}
