import type {
  MarketRegime,
  TrendDirection,
  TrendStrength,
  VolatilityLevel,
} from '../../regime/enums/market-regime.enum.js';
import type {
  MarketSession,
  SessionMaturity,
} from '../../market-data/session/market-session.enum.js';
import type { OpeningRangeContext } from '../../market-data/session/session-context.interface.js';
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
  /** Session metadata, present when the regime came from live market data. */
  marketSession?: MarketSession;
  sessionMaturity?: SessionMaturity;
  timeframeMinutes?: number;
  currentSessionCandleCount?: number;
  indicatorCandleCount?: number;
  /** 09:30–09:45 ET levels as interpreted by the session layer. */
  openingRange?: OpeningRangeContext;
}

export interface SignalResult {
  symbol: string;
  timestamp: Date;
  signal: MarketSignal;
  confidence: number;
  /**
   * Whether downstream layers may act on this signal. The signal itself is
   * always produced, including during the opening settlement period.
   */
  tradeEvaluationAllowed: boolean;
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
