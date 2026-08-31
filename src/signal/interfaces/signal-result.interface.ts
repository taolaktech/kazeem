import type {
  MarketRegime,
  TrendDirection,
  TrendStrength,
  VolatilityLevel,
} from '../../regime/enums/market-regime.enum.js';
import type { MarketSignal } from '../enums/market-signal.enum.js';

export interface SignalScores {
  bullish: number;
  bearish: number;
  noTrade: number;
}

export interface SignalMarketContext {
  regime: MarketRegime;
  regimeConfidence: number;
  trendDirection: TrendDirection;
  trendStrength: TrendStrength;
  volatility: VolatilityLevel;
}

export interface SignalResult {
  symbol: string;
  timestamp: Date;
  signal: MarketSignal;
  confidence: number;
  scores: SignalScores;
  /** Indicators that support the winning direction. */
  confirmations: string[];
  /** Indicators that contradict the prevailing evidence. */
  conflicts: string[];
  reasoning: string[];
  marketContext: SignalMarketContext;
  /** Conditions that do not flip the decision but make it riskier. */
  riskFlags: string[];
}
