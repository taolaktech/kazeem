import {
  MarketSession,
  SessionMaturity,
} from '../../market-data/session/market-session.enum.js';
import type { MarketCandle } from '../../market-data/interfaces/market-candle.interface.js';
import type {
  CurrentSessionFeatures,
  MarketSessionSnapshot,
  OpeningRangeContext,
  PremarketContext,
  PreviousSessionContext,
} from '../../market-data/session/session-context.interface.js';
import { MarketRiskBias } from '../../news-intelligence/enums/market-risk-bias.enum.js';
import { NewsImpact } from '../../news-intelligence/enums/news-impact.enum.js';
import { NewsSentiment } from '../../news-intelligence/enums/news-sentiment.enum.js';
import type { NewsIntelligenceResult } from '../../news-intelligence/interfaces/news-intelligence-result.interface.js';
import { OptionSelectionStatus } from '../../option-selection/enums/option-selection-status.enum.js';
import type { OptionCandidate } from '../../option-selection/interfaces/option-candidate-score.interface.js';
import type { OptionSelectionResult } from '../../option-selection/interfaces/option-selection-result.interface.js';
import { MarketRegime } from '../../regime/enums/market-regime.enum.js';
import type { RegimeClassificationResult } from '../../regime/interfaces/regime-result.interface.js';
import { MarketSignal } from '../../signal/enums/market-signal.enum.js';
import type { SignalResult } from '../../signal/interfaces/signal-result.interface.js';
import { buildRegime } from '../../signal/testing/regime-factory.js';
import {
  ConfirmationStrength,
  SignalAlignment,
  VolatilityMomentum,
  VolatilityRelationship,
  VolatilityState,
  VolatilityTrend,
} from '../../volatility-intelligence/enums/volatility.enum.js';
import type { VolatilityIntelligenceResult } from '../../volatility-intelligence/interfaces/volatility-intelligence-result.interface.js';
import type { TradeDecisionInput } from '../trade-decision.engine.js';

export const NOW = new Date('2026-09-02T18:00:00.000Z');
const LATEST_CANDLE_TIME = new Date('2026-09-02T17:57:00.000Z');

export const OPENING_RANGE: OpeningRangeContext = {
  available: true,
  status: 'COMPLETE',
  startTime: '09:30',
  endTime: '09:45',
  windowMinutes: 15,
  candleCount: 5,
  expectedCandleCount: 5,
  open: 648,
  high: 652,
  low: 646,
  close: 650,
  volume: 500_000,
  range: 6,
  rangePercent: 0.926,
  currentPrice: 655,
  currentPricePosition: 'ABOVE',
  distanceFromHighPercent: 0.46,
  distanceFromLowPercent: 1.39,
  breakoutTolerancePercent: 0.05,
  breakoutAbove: true,
  breakdownBelow: false,
  closesAboveHigh: 3,
  closesBelowLow: 0,
  failedBreakoutAbove: false,
  failedBreakdownBelow: false,
  breakoutStrength: 'STRONG',
  volumeConfirmation: 'CONFIRMED',
  relativeBreakoutVolume: 1.6,
  totalPostRangeCandleCount: 20,
};

const PREMARKET: PremarketContext = {
  available: true,
  candleCount: 40,
  open: 647,
  high: 649,
  low: 645,
  close: 648,
  volume: 100_000,
  change: 1,
  changePercent: 0.15,
  gapFromPreviousClose: 1,
  gapPercentFromPreviousClose: 0.15,
  range: 4,
  rangePercent: 0.62,
  trendDirection: 'BULLISH',
  volatility: 'NORMAL',
  positionInRange: 0.75,
  distanceFromHighPercent: -0.15,
  distanceFromLowPercent: 0.46,
};

const PREVIOUS_SESSION: PreviousSessionContext = {
  available: true,
  date: '2026-09-01',
  previousClose: 647,
  previousHigh: 650,
  previousLow: 644,
  previousOpen: 645,
  direction: 'BULLISH',
  totalSessionCandleCount: 130,
};

const BULLISH_SESSION_FEATURES: CurrentSessionFeatures = {
  candleCount: 25,
  open: 648,
  high: 656,
  low: 646,
  close: 655,
  range: 10,
  rangePercent: 1.54,
  changeFromOpen: 7,
  changeFromOpenPercent: 1.08,
  positionInRange: 0.9,
  slopePercent: 0.05,
  bullishCandleCount: 17,
  bearishCandleCount: 8,
  higherHighs: true,
  lowerLows: false,
  sessionOpen: 648,
  sessionHigh: 656,
  sessionLow: 646,
  totalSessionCandleCount: 25,
  aboveSessionOpen: true,
  abovePremarketHigh: true,
  belowPremarketLow: false,
};

export function bearishSessionFeatures(): CurrentSessionFeatures {
  return {
    ...BULLISH_SESSION_FEATURES,
    close: 641,
    positionInRange: 0.1,
    slopePercent: -0.05,
    bullishCandleCount: 8,
    bearishCandleCount: 17,
    higherHighs: false,
    lowerLows: true,
    aboveSessionOpen: false,
    abovePremarketHigh: false,
    belowPremarketLow: true,
  };
}

export function bearishOpeningRange(): OpeningRangeContext {
  return {
    ...OPENING_RANGE,
    currentPrice: 641,
    currentPricePosition: 'BELOW',
    breakoutAbove: false,
    breakdownBelow: true,
    closesAboveHigh: 0,
    closesBelowLow: 3,
  };
}

/** Price back inside a completed range, with no break either way. */
export function insideOpeningRange(): OpeningRangeContext {
  return {
    ...OPENING_RANGE,
    currentPrice: 650,
    currentPricePosition: 'INSIDE',
    breakoutAbove: false,
    breakdownBelow: false,
    closesAboveHigh: 0,
    closesBelowLow: 0,
    breakoutStrength: 'NONE',
  };
}

export interface SnapshotOverrides {
  marketSession?: MarketSession;
  sessionMaturity?: SessionMaturity;
  tradeEvaluationAllowed?: boolean;
  openingRange?: OpeningRangeContext;
  currentSessionFeatures?: CurrentSessionFeatures;
  latestCandleTime?: Date;
  warnings?: string[];
}

export function buildSnapshot(
  overrides: SnapshotOverrides = {},
): MarketSessionSnapshot {
  const latest = overrides.latestCandleTime ?? LATEST_CANDLE_TIME;
  const candle: MarketCandle = {
    timestamp: latest,
    open: 654,
    high: 656,
    low: 653.5,
    close: 655,
    volume: 250_000,
  };
  return {
    symbol: 'SPY',
    asOf: NOW,
    context: {
      timezone: 'America/New_York',
      marketSession: overrides.marketSession ?? MarketSession.REGULAR,
      sessionMaturity: overrides.sessionMaturity ?? SessionMaturity.DEVELOPING,
      timeframeMinutes: 3,
      openingSettlementMinutes: 15,
      tradeEvaluationAllowed: overrides.tradeEvaluationAllowed ?? true,
      sessionDate: '2026-09-02',
      currentSessionCandleCount: 25,
      indicatorCandleCount: 155,
      previousSessionWarmupCandleCount: 130,
      premarketCandleCount: 40,
      openingRangeMinutes: 15,
    },
    indicatorCandles: [candle],
    currentSessionCandles: [candle],
    premarketCandles: [],
    premarket: PREMARKET,
    openingRange: overrides.openingRange ?? OPENING_RANGE,
    previousSession: PREVIOUS_SESSION,
    currentSessionFeatures:
      overrides.currentSessionFeatures ?? BULLISH_SESSION_FEATURES,
    warnings: overrides.warnings ?? [],
  };
}

export interface SignalOverrides {
  signal?: MarketSignal;
  confidence?: number;
  bullish?: number;
  bearish?: number;
  confirmations?: string[];
  conflicts?: string[];
  tradeEvaluationAllowed?: boolean;
  riskFlags?: string[];
}

export function buildSignal(overrides: SignalOverrides = {}): SignalResult {
  const signal = overrides.signal ?? MarketSignal.BULLISH;
  return {
    symbol: 'SPY',
    timestamp: NOW,
    signal,
    confidence: overrides.confidence ?? 0.85,
    tradeEvaluationAllowed: overrides.tradeEvaluationAllowed ?? true,
    scores: {
      bullish: overrides.bullish ?? 9,
      bearish: overrides.bearish ?? 1,
      noTrade: 0,
    },
    confirmations: overrides.confirmations ?? [
      'EMA stack is bullish',
      'ADX confirms trend strength',
      'Price holds above the session open',
    ],
    conflicts: overrides.conflicts ?? [],
    reasoning: [],
    marketContext: {
      regime: MarketRegime.TRENDING_BULLISH,
      regimeConfidence: 0.85,
      trendDirection: 'BULLISH',
      trendStrength: 'STRONG',
      volatility: 'NORMAL',
    },
    riskFlags: overrides.riskFlags ?? [],
  };
}

export interface ContractOverrides extends Partial<OptionCandidate> {}

export function buildCandidate(
  overrides: ContractOverrides = {},
): OptionCandidate {
  return {
    symbol: 'O:SPY260904C00655000',
    contractType: 'CALL',
    strikePrice: 655,
    expirationDate: new Date('2026-09-04T00:00:00.000Z'),
    daysToExpiration: 2,
    moneyness: 'ATM',
    strikeDistancePercent: 0.1,
    bid: 2.0,
    ask: 2.06,
    lastPrice: 2.03,
    volume: 6_000,
    openInterest: 12_000,
    impliedVolatility: 0.22,
    delta: 0.52,
    gamma: 0.05,
    theta: -0.12,
    vega: 0.07,
    premiumPriceUsed: 2.06,
    premiumPriceSource: 'ASK',
    estimatedContractCost: 206,
    withinBudget: true,
    score: 92,
    scoreBreakdown: {
      delta: 20,
      strikeProximity: 15,
      dte: 15,
      volume: 12,
      openInterest: 12,
      iv: 8,
      spread: 5,
      dataQuality: 5,
    },
    quoteAvailable: true,
    dataCompleteness: 1,
    riskFlags: [],
    ...overrides,
  };
}

export interface SelectionOverrides {
  status?: OptionSelectionStatus;
  selectedContract?: OptionCandidate | null;
  confidence?: number;
  maxBudget?: number;
  executionReady?: boolean;
  signal?: MarketSignal;
  riskFlags?: string[];
}

export function buildSelection(
  overrides: SelectionOverrides = {},
): OptionSelectionResult {
  const status = overrides.status ?? OptionSelectionStatus.SELECTED;
  const selected =
    overrides.selectedContract === undefined
      ? status === OptionSelectionStatus.SELECTED
        ? buildCandidate()
        : null
      : overrides.selectedContract;
  return {
    symbol: 'SPY',
    timestamp: NOW,
    signal: overrides.signal ?? MarketSignal.BULLISH,
    optionType: selected?.contractType ?? null,
    status,
    tradeEvaluationAllowed: true,
    confidence: overrides.confidence ?? 0.9,
    maxBudget: overrides.maxBudget ?? 500,
    underlyingPrice: 655,
    selectedContract: selected,
    alternatives: [],
    reasoning: [],
    riskFlags: overrides.riskFlags ?? [],
    executionReady:
      overrides.executionReady ?? selected?.quoteAvailable ?? false,
  };
}

export interface NewsOverrides {
  sentiment?: NewsSentiment;
  riskBias?: MarketRiskBias;
  impact?: NewsImpact;
  sentimentConfidence?: number;
  riskBiasConfidence?: number;
  riskBiasConflict?: boolean;
  articleCount?: number;
}

export function buildNews(
  overrides: NewsOverrides = {},
): NewsIntelligenceResult {
  return {
    symbol: 'SPY',
    timestamp: NOW,
    lookbackHours: 24,
    overallSentiment: overrides.sentiment ?? NewsSentiment.NEUTRAL,
    sentimentConfidence: overrides.sentimentConfidence ?? 0.4,
    marketRiskBias: overrides.riskBias ?? MarketRiskBias.NEUTRAL,
    riskBiasConfidence: overrides.riskBiasConfidence ?? 0.4,
    riskBiasConflict: overrides.riskBiasConflict ?? false,
    newsImpact: overrides.impact ?? NewsImpact.LOW,
    articleCount: overrides.articleCount ?? 8,
    highImpactArticleCount: 0,
    bullishArticleCount: 2,
    bearishArticleCount: 2,
    neutralArticleCount: 4,
    unknownArticleCount: 0,
    dominantCatalysts: [],
    articles: [],
    reasoning: [],
    riskFlags: [],
    providers: [],
  };
}

export interface VolatilityOverrides {
  available?: boolean;
  alignment?: SignalAlignment;
  relationship?: VolatilityRelationship;
  trend?: VolatilityTrend;
  momentum?: VolatilityMomentum;
  spikeDetected?: boolean;
}

export function buildVolatility(
  overrides: VolatilityOverrides = {},
): VolatilityIntelligenceResult {
  const available = overrides.available ?? true;
  return {
    symbol: 'SPY',
    volatilitySymbol: 'I:VIX',
    timestamp: NOW,
    tradeEvaluationAllowed: true,
    volatilityState: available
      ? VolatilityState.NORMAL
      : VolatilityState.UNKNOWN,
    volatilityTrend: overrides.trend ?? VolatilityTrend.FALLING,
    volatilityMomentum: overrides.momentum ?? VolatilityMomentum.FALLING,
    relationship:
      overrides.relationship ?? VolatilityRelationship.CONFIRMING_BULLISH,
    confirmationStrength: ConfirmationStrength.STRONG,
    confidence: available ? 0.8 : 0,
    volatilityPressureScore: -0.4,
    signal: MarketSignal.BULLISH,
    signalAlignment: overrides.alignment ?? SignalAlignment.CONFIRMS,
    vix: {
      symbol: 'I:VIX',
      available,
      premarketAvailable: available,
      current: available ? 14.2 : null,
      asOf: available ? LATEST_CANDLE_TIME : null,
      previousClose: available ? 15.1 : null,
      change: available ? -0.9 : null,
      changePercent: available ? -5.96 : null,
      sessionOpen: available ? 15 : null,
      sessionHigh: available ? 15.2 : null,
      sessionLow: available ? 14.1 : null,
      changeFromOpen: available ? -0.8 : null,
      changePercentFromOpen: available ? -5.33 : null,
      ema9: available ? 14.6 : null,
      ema21: available ? 15 : null,
      shortMomentumPercent: available ? -2.1 : null,
      acceleration: available ? -0.5 : null,
      positionInSessionRange: available ? 0.09 : null,
      spikeDetected: overrides.spikeDetected ?? false,
      currentSessionCandleCount: available ? 25 : 0,
      indicatorCandleCount: available ? 155 : 0,
    },
    underlying: {
      symbol: 'SPY',
      current: 655,
      asOf: LATEST_CANDLE_TIME,
      previousClose: 647,
      changePercent: 1.24,
      sessionOpen: 648,
      changePercentFromOpen: 1.08,
      shortMomentumPercent: 0.3,
      premarketHigh: 649,
      premarketLow: 645,
      premarketGapPercent: 0.15,
    },
    sessionContext: {
      marketSession: MarketSession.REGULAR,
      sessionMaturity: SessionMaturity.DEVELOPING,
      timeframeMinutes: 3,
      currentSessionCandleCount: 25,
      premarketDirectionalWeight: 0.3,
    },
    confirmations: [],
    divergences: [],
    reasoning: [],
    riskFlags: [],
  };
}

export interface DecisionInputOverrides {
  maxBudget?: number;
  now?: Date;
  snapshot?: MarketSessionSnapshot;
  regime?: RegimeClassificationResult;
  signal?: SignalResult;
  optionSelection?: OptionSelectionResult;
  optionProviderFailed?: boolean;
  news?: NewsIntelligenceResult | null;
  volatility?: VolatilityIntelligenceResult | null;
}

/** A clean, strong bullish CALL setup; every override narrows it from there. */
export function buildDecisionInput(
  overrides: DecisionInputOverrides = {},
): TradeDecisionInput {
  return {
    symbol: 'SPY',
    now: overrides.now ?? NOW,
    maxBudget: overrides.maxBudget ?? 500,
    snapshot: overrides.snapshot ?? buildSnapshot(),
    regime:
      overrides.regime ??
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BULLISH,
        confidence: 0.9,
        secondaryCharacteristics: {
          trendDirection: 'BULLISH',
          trendStrength: 'STRONG',
        },
        features: {
          currentPrice: 655,
          adx: 30,
          plusDI: 30,
          minusDI: 14,
          relativeVolume: 1.6,
        },
      }),
    signal: overrides.signal ?? buildSignal(),
    optionSelection: overrides.optionSelection ?? buildSelection(),
    optionProviderFailed: overrides.optionProviderFailed ?? false,
    news: overrides.news === undefined ? buildNews() : overrides.news,
    volatility:
      overrides.volatility === undefined
        ? buildVolatility()
        : overrides.volatility,
  };
}

/** Mirror image of the default input: a clean bearish PUT setup. */
export function buildBearishInput(
  overrides: DecisionInputOverrides = {},
): TradeDecisionInput {
  return buildDecisionInput({
    snapshot: buildSnapshot({
      openingRange: bearishOpeningRange(),
      currentSessionFeatures: bearishSessionFeatures(),
    }),
    regime: buildRegime({
      primaryRegime: MarketRegime.TRENDING_BEARISH,
      confidence: 0.9,
      secondaryCharacteristics: {
        trendDirection: 'BEARISH',
        trendStrength: 'STRONG',
      },
      features: {
        currentPrice: 641,
        adx: 30,
        plusDI: 14,
        minusDI: 30,
        relativeVolume: 1.6,
      },
    }),
    signal: buildSignal({
      signal: MarketSignal.BEARISH,
      bullish: 1,
      bearish: 9,
    }),
    optionSelection: buildSelection({
      signal: MarketSignal.BEARISH,
      selectedContract: buildCandidate({
        symbol: 'O:SPY260904P00640000',
        contractType: 'PUT',
        strikePrice: 640,
        delta: -0.52,
      }),
    }),
    volatility: buildVolatility({
      relationship: VolatilityRelationship.CONFIRMING_BEARISH,
      trend: VolatilityTrend.RISING,
      momentum: VolatilityMomentum.RISING,
    }),
    ...overrides,
  });
}
