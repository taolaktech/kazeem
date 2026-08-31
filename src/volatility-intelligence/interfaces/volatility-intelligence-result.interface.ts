import type {
  MarketSession,
  SessionMaturity,
} from '../../market-data/session/market-session.enum.js';
import type { MarketSignal } from '../../signal/enums/market-signal.enum.js';
import type {
  ConfirmationStrength,
  SignalAlignment,
  VolatilityMomentum,
  VolatilityRelationship,
  VolatilityState,
  VolatilityTrend,
} from '../enums/volatility.enum.js';

/** Volatility reference metrics, all null when VIX data is unavailable. */
export interface VixMetrics {
  symbol: string;
  available: boolean;
  /** Whether the provider returned premarket bars for the index. */
  premarketAvailable: boolean;
  /** Close of the most recent completed VIX candle. */
  current: number | null;
  /** Timestamp of that candle's close. */
  asOf: Date | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  sessionOpen: number | null;
  sessionHigh: number | null;
  sessionLow: number | null;
  changeFromOpen: number | null;
  changePercentFromOpen: number | null;
  ema9: number | null;
  ema21: number | null;
  /** Percentage move across the configured short momentum window. */
  shortMomentumPercent: number | null;
  /** Latest short-window move minus the previous one, in percentage points. */
  acceleration: number | null;
  /** Where the latest value sits inside the session range, in [0, 1]. */
  positionInSessionRange: number | null;
  spikeDetected: boolean;
  currentSessionCandleCount: number;
  indicatorCandleCount: number;
}

/** Lightweight comparable features of the underlying; not a second regime. */
export interface UnderlyingMetrics {
  symbol: string;
  current: number | null;
  asOf: Date | null;
  previousClose: number | null;
  changePercent: number | null;
  sessionOpen: number | null;
  changePercentFromOpen: number | null;
  shortMomentumPercent: number | null;
  /** Premarket reference levels stay useful all day, unlike its direction. */
  premarketHigh: number | null;
  premarketLow: number | null;
  premarketGapPercent: number | null;
}

export interface VolatilitySessionContext {
  marketSession: MarketSession;
  sessionMaturity: SessionMaturity;
  timeframeMinutes: number;
  currentSessionCandleCount: number;
  /** Weight premarket direction still carries at this maturity, in [0, 1]. */
  premarketDirectionalWeight: number;
}

export interface VolatilityIntelligenceResult {
  symbol: string;
  volatilitySymbol: string;
  timestamp: Date;
  tradeEvaluationAllowed: boolean;

  volatilityState: VolatilityState;
  volatilityTrend: VolatilityTrend;
  volatilityMomentum: VolatilityMomentum;
  relationship: VolatilityRelationship;
  confirmationStrength: ConfirmationStrength;
  confidence: number;
  /**
   * Contextual evidence in [-1, 1]: negative is volatility contraction
   * (risk-on pressure), positive is expansion (risk-off pressure). It is never
   * a trade direction.
   */
  volatilityPressureScore: number;

  /** How the volatility environment relates to the current directional signal. */
  signal: MarketSignal;
  signalAlignment: SignalAlignment;

  vix: VixMetrics;
  underlying: UnderlyingMetrics;
  sessionContext: VolatilitySessionContext;

  confirmations: string[];
  divergences: string[];
  reasoning: string[];
  riskFlags: string[];
}
