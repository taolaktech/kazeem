import type {
  MarketSession,
  SessionMaturity,
} from '../../market-data/session/market-session.enum.js';
import type { OpeningRangeContext } from '../../market-data/session/session-context.interface.js';
import type { CatalystType } from '../../news-intelligence/enums/catalyst-type.enum.js';
import type { MarketRiskBias } from '../../news-intelligence/enums/market-risk-bias.enum.js';
import type { NewsImpact } from '../../news-intelligence/enums/news-impact.enum.js';
import type { NewsSentiment } from '../../news-intelligence/enums/news-sentiment.enum.js';
import type { OptionSelectionStatus } from '../../option-selection/enums/option-selection-status.enum.js';
import type { OptionCandidate } from '../../option-selection/interfaces/option-candidate-score.interface.js';
import type {
  MarketRegime,
  TrendDirection,
  TrendStrength,
  VolatilityLevel,
} from '../../regime/enums/market-regime.enum.js';
import type { MarketSignal } from '../../signal/enums/market-signal.enum.js';
import type {
  SignalAlignment,
  VolatilityMomentum,
  VolatilityState,
  VolatilityTrend,
} from '../../volatility-intelligence/enums/volatility.enum.js';
import type {
  DecisionCategory,
  SetupGrade,
  TradeDecision,
  TradeDirection,
} from '../enums/trade-decision.enum.js';
import type {
  ComponentScore,
  DecisionConflict,
} from './component-score.interface.js';

export interface DecisionMarketContext {
  regime: MarketRegime;
  regimeConfidence: number;
  trendDirection: TrendDirection;
  trendStrength: TrendStrength;
  volatility: VolatilityLevel;
  signal: MarketSignal;
  signalConfidence: number;
  marketSession: MarketSession;
  sessionMaturity: SessionMaturity;
  timeframeMinutes: number;
  currentSessionCandleCount: number;
  currentPrice: number;
  sessionOpen: number | null;
  sessionHigh: number | null;
  sessionLow: number | null;
  /** Premarket levels stay separate from the opening range on purpose. */
  premarketHigh: number | null;
  premarketLow: number | null;
  openingRange: OpeningRangeContext;
}

/** Condensed news view; the full article list stays on its own endpoint. */
export interface DecisionNewsContext {
  available: boolean;
  sentiment: NewsSentiment | null;
  sentimentConfidence: number | null;
  marketRiskBias: MarketRiskBias | null;
  riskBiasConfidence: number | null;
  impact: NewsImpact | null;
  articleCount: number | null;
  dominantCatalysts: CatalystType[];
}

export interface DecisionVolatilityContext {
  available: boolean;
  volatilitySymbol: string;
  vix: number | null;
  state: VolatilityState | null;
  trend: VolatilityTrend | null;
  momentum: VolatilityMomentum | null;
  signalAlignment: SignalAlignment | null;
  /** Supporting evidence only; it never sets the direction. */
  volatilityPressureScore: number | null;
}

/**
 * Deterministic V1 decision record. The shape is deliberately persistable:
 * outcome labels can later be attached to it without changing the layer.
 */
export interface TradeDecisionResult {
  symbol: string;
  timestamp: Date;
  decision: TradeDecision;
  direction: TradeDirection;
  setupGrade: SetupGrade;
  /**
   * Quality of the evidence on a 0–100 scale, after conflict penalties. It is
   * not a probability of profit.
   */
  normalizedDecisionScore: number;
  rawEarnedScore: number;
  availableWeight: number;
  /** Score before conflict penalties were deducted. */
  preConflictScore: number;
  conflictPenalty: number;
  /**
   * How reliable the classification itself is, in [0, 1]. Confidence 0.9 on a
   * B+ setup means "confident this is a B+", not "90% chance of profit".
   */
  confidence: number;
  tradeEvaluationAllowed: boolean;
  /** Deterministic one-line summary of the setup. */
  thesis: string;
  maxBudget: number;
  componentScores: Record<DecisionCategory, ComponentScore>;
  conflicts: DecisionConflict[];
  /** Conditions that prevent TRADE regardless of the score. */
  hardBlockers: string[];
  missingIntelligence: string[];
  riskFlags: string[];
  reasoning: string[];
  marketContext: DecisionMarketContext;
  optionSelectionStatus: OptionSelectionStatus;
  /** Reused verbatim from option selection; never reranked or modified. */
  selectedContract: OptionCandidate | null;
  executionReady: boolean;
  news: DecisionNewsContext;
  volatility: DecisionVolatilityContext;
}
