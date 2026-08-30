export enum MarketRegime {
  TRENDING_BULLISH = 'TRENDING_BULLISH',
  TRENDING_BEARISH = 'TRENDING_BEARISH',
  RANGE_BOUND = 'RANGE_BOUND',
  HIGH_VOLATILITY = 'HIGH_VOLATILITY',
  LOW_VOLATILITY = 'LOW_VOLATILITY',
}

export const MARKET_REGIMES: readonly MarketRegime[] = [
  MarketRegime.TRENDING_BULLISH,
  MarketRegime.TRENDING_BEARISH,
  MarketRegime.RANGE_BOUND,
  MarketRegime.HIGH_VOLATILITY,
  MarketRegime.LOW_VOLATILITY,
];

export const TREND_REGIMES: readonly MarketRegime[] = [
  MarketRegime.TRENDING_BULLISH,
  MarketRegime.TRENDING_BEARISH,
];

export const VOLATILITY_REGIMES: readonly MarketRegime[] = [
  MarketRegime.HIGH_VOLATILITY,
  MarketRegime.LOW_VOLATILITY,
];

export type TrendDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type TrendStrength = 'WEAK' | 'MODERATE' | 'STRONG';
export type VolatilityLevel = 'LOW' | 'NORMAL' | 'HIGH';
export type EmaAlignment = 'BULLISH' | 'BEARISH' | 'MIXED';
