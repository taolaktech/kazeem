import type { MarketSessionSnapshot } from '../market-data/session/session-context.interface.js';
import { MarketSession } from '../market-data/session/market-session.enum.js';
import type { NewsIntelligenceResult } from '../news-intelligence/interfaces/news-intelligence-result.interface.js';
import { OptionSelectionStatus } from '../option-selection/enums/option-selection-status.enum.js';
import type { OptionSelectionResult } from '../option-selection/interfaces/option-selection-result.interface.js';
import { MarketRegime } from '../regime/enums/market-regime.enum.js';
import type { RegimeClassificationResult } from '../regime/interfaces/regime-result.interface.js';
import { MarketSignal } from '../signal/enums/market-signal.enum.js';
import type { SignalResult } from '../signal/interfaces/signal-result.interface.js';
import type { VolatilityIntelligenceResult } from '../volatility-intelligence/interfaces/volatility-intelligence-result.interface.js';
import {
  CONFIDENCE_PENALTIES,
  CONFIDENCE_WEIGHTS,
  CONFLICT_PENALTIES,
  DECISION_GUARDS,
  GRADE_THRESHOLDS,
  STALE_MARKET_DATA_MINUTES,
} from './constants/trade-decision-weights.js';
import {
  ConflictSeverity,
  DecisionCategory,
  SetupGrade,
  TradeDecision,
  TradeDirection,
} from './enums/trade-decision.enum.js';
import type {
  ComponentScore,
  DecisionConflict,
} from './interfaces/component-score.interface.js';
import type {
  DecisionNewsContext,
  DecisionVolatilityContext,
  TradeDecisionResult,
} from './interfaces/trade-decision-result.interface.js';
import { scoreDirectionalSignal } from './scoring/directional-signal.score.js';
import { scoreMomentumAndVolume } from './scoring/momentum-volume.score.js';
import { scoreNews } from './scoring/news.score.js';
import { scoreOptionQuality } from './scoring/option-quality.score.js';
import { scoreRegimeAndStructure } from './scoring/regime-structure.score.js';
import { scoreVolatility } from './scoring/volatility.score.js';
import { clamp01, round2 } from './scoring/scoring.util.js';

export interface TradeDecisionInput {
  symbol: string;
  now: Date;
  maxBudget: number;
  snapshot: MarketSessionSnapshot;
  regime: RegimeClassificationResult;
  signal: SignalResult;
  optionSelection: OptionSelectionResult;
  /** True when the chain provider failed, as opposed to a legitimate miss. */
  optionProviderFailed: boolean;
  news: NewsIntelligenceResult | null;
  volatility: VolatilityIntelligenceResult | null;
}

/** A blocker that prevents TRADE, and what the decision becomes instead. */
interface HardBlocker {
  description: string;
  decision: TradeDecision.WAIT | TradeDecision.NO_TRADE;
}

/**
 * Deterministic, rule-based V1 decision engine. Same structured inputs always
 * produce the same output: no randomness, no model, no external call.
 */
export function decide(input: TradeDecisionInput): TradeDecisionResult {
  const direction = directionFor(input.signal.signal);
  const componentScores = scoreAll(input, direction);

  const availableWeight = Object.values(componentScores).reduce(
    (total, component) => total + component.available,
    0,
  );
  const rawEarnedScore = Object.values(componentScores).reduce(
    (total, component) => total + (component.earned ?? 0),
    0,
  );
  const preConflictScore =
    availableWeight > 0
      ? clamp(round2((rawEarnedScore / availableWeight) * 100))
      : 0;

  const conflicts = dedupeConflicts(
    Object.values(componentScores).flatMap((component) => component.conflicts),
  );
  const conflictPenalty = conflicts
    .filter((item) => item.penalized)
    .reduce((total, item) => total + CONFLICT_PENALTIES[item.severity], 0);
  const normalizedDecisionScore = clamp(
    round2(preConflictScore - conflictPenalty),
  );
  const setupGrade = gradeFor(normalizedDecisionScore);

  const hardBlockers = collectHardBlockers(input, direction, componentScores);
  const decision = decideOutcome(hardBlockers, setupGrade, conflicts);
  const confidence = computeConfidence(
    input,
    componentScores,
    conflicts,
    normalizedDecisionScore,
  );

  return {
    symbol: input.symbol,
    timestamp: input.now,
    decision,
    direction,
    setupGrade,
    normalizedDecisionScore,
    rawEarnedScore: round2(rawEarnedScore),
    availableWeight,
    preConflictScore,
    conflictPenalty: round2(conflictPenalty),
    confidence,
    tradeEvaluationAllowed: input.snapshot.context.tradeEvaluationAllowed,
    thesis: buildThesis(input, direction, conflicts),
    maxBudget: input.maxBudget,
    componentScores,
    conflicts,
    hardBlockers: hardBlockers.map((blocker) => blocker.description),
    missingIntelligence: unique(
      Object.values(componentScores).flatMap(
        (component) => component.missingIntelligence,
      ),
    ),
    riskFlags: collectRiskFlags(input, componentScores),
    reasoning: buildReasoning(
      input,
      direction,
      componentScores,
      conflicts,
      setupGrade,
      normalizedDecisionScore,
      decision,
      hardBlockers,
    ),
    marketContext: buildMarketContext(input),
    optionSelectionStatus: input.optionSelection.status,
    selectedContract: input.optionSelection.selectedContract,
    executionReady: input.optionSelection.executionReady,
    news: buildNewsContext(input.news),
    volatility: buildVolatilityContext(input.volatility),
  };
}

function directionFor(signal: MarketSignal): TradeDirection {
  switch (signal) {
    case MarketSignal.BULLISH:
      return TradeDirection.CALL;
    case MarketSignal.BEARISH:
      return TradeDirection.PUT;
    default:
      return TradeDirection.NONE;
  }
}

function scoreAll(
  input: TradeDecisionInput,
  direction: TradeDirection,
): Record<DecisionCategory, ComponentScore> {
  return {
    [DecisionCategory.DIRECTIONAL_SIGNAL]: scoreDirectionalSignal(
      input.signal,
      direction,
    ),
    [DecisionCategory.REGIME_AND_STRUCTURE]: scoreRegimeAndStructure({
      regime: input.regime,
      currentSession: input.snapshot.currentSessionFeatures,
      openingRange: input.snapshot.openingRange,
      direction,
    }),
    [DecisionCategory.MOMENTUM_AND_VOLUME]: scoreMomentumAndVolume({
      features: input.regime.features,
      openingRange: input.snapshot.openingRange,
      direction,
    }),
    [DecisionCategory.OPTION_QUALITY]: scoreOptionQuality(
      input.optionSelection,
      input.optionProviderFailed,
    ),
    [DecisionCategory.NEWS]: scoreNews(input.news, direction),
    [DecisionCategory.VOLATILITY]: scoreVolatility(input.volatility, direction),
  };
}

/** One penalty per distinct conflict code, keeping the worst severity. */
function dedupeConflicts(
  conflicts: readonly DecisionConflict[],
): DecisionConflict[] {
  const order: Record<ConflictSeverity, number> = {
    [ConflictSeverity.MINOR]: 0,
    [ConflictSeverity.MODERATE]: 1,
    [ConflictSeverity.MAJOR]: 2,
    [ConflictSeverity.CRITICAL]: 3,
  };
  const byCode = new Map<string, DecisionConflict>();
  for (const item of conflicts) {
    const existing = byCode.get(item.code);
    if (
      existing === undefined ||
      order[item.severity] > order[existing.severity]
    ) {
      byCode.set(item.code, item);
    }
  }
  return [...byCode.values()];
}

function gradeFor(score: number): SetupGrade {
  const match = GRADE_THRESHOLDS.find(
    (threshold) => score >= threshold.minScore,
  );
  return match?.grade ?? SetupGrade.C;
}

function collectHardBlockers(
  input: TradeDecisionInput,
  direction: TradeDirection,
  componentScores: Record<DecisionCategory, ComponentScore>,
): HardBlocker[] {
  const blockers: HardBlocker[] = [];
  const session = input.snapshot.context;

  if (!session.tradeEvaluationAllowed) {
    blockers.push({
      description:
        session.marketSession === MarketSession.OPENING_SETTLEMENT
          ? 'Opening settlement period is still active'
          : `Trade evaluation is not allowed while the market is ${session.marketSession}`,
      decision: TradeDecision.WAIT,
    });
  }
  if (input.signal.signal === MarketSignal.NO_TRADE) {
    blockers.push({
      description: 'Signal engine returned NO_TRADE',
      decision: TradeDecision.NO_TRADE,
    });
  }
  if (direction === TradeDirection.NONE) {
    blockers.push({
      description: 'No directional trade thesis is available',
      decision: TradeDecision.NO_TRADE,
    });
  }
  if (input.optionProviderFailed) {
    blockers.push({
      description: 'Option chain provider is unavailable',
      decision: TradeDecision.WAIT,
    });
  } else if (
    input.optionSelection.status === OptionSelectionStatus.NO_SELECTION
  ) {
    blockers.push({
      description: `No qualifying option contract within the $${input.maxBudget} maximum trade budget`,
      decision: TradeDecision.NO_TRADE,
    });
  }
  if (isCoreMarketDataStale(input)) {
    blockers.push({
      description: 'Core market data is stale',
      decision: TradeDecision.WAIT,
    });
  }
  if (!input.regime.dataQuality.sufficientData) {
    blockers.push({
      description: 'Core market data is insufficient for classification',
      decision: TradeDecision.WAIT,
    });
  }
  if (componentScores[DecisionCategory.OPTION_QUALITY].earned === null) {
    blockers.push({
      description: 'Option quality could not be evaluated',
      decision: TradeDecision.WAIT,
    });
  }
  return blockers;
}

function isCoreMarketDataStale(input: TradeDecisionInput): boolean {
  if (input.snapshot.context.marketSession !== MarketSession.REGULAR) {
    return false;
  }
  const candles = input.snapshot.currentSessionCandles;
  const latest = candles.at(-1);
  if (latest === undefined) {
    return true;
  }
  const ageMinutes =
    (input.now.getTime() - latest.timestamp.getTime()) / 60_000;
  return ageMinutes > STALE_MARKET_DATA_MINUTES;
}

/** Hard blockers and conflict severity override the grade, never the reverse. */
function decideOutcome(
  hardBlockers: readonly HardBlocker[],
  grade: SetupGrade,
  conflicts: readonly DecisionConflict[],
): TradeDecision {
  if (hardBlockers.length > 0) {
    return hardBlockers.some(
      (blocker) => blocker.decision === TradeDecision.NO_TRADE,
    )
      ? TradeDecision.NO_TRADE
      : TradeDecision.WAIT;
  }

  const severe = conflicts.filter(
    (item) =>
      item.severity === ConflictSeverity.MAJOR ||
      item.severity === ConflictSeverity.CRITICAL,
  ).length;
  const moderate = conflicts.filter(
    (item) => item.severity === ConflictSeverity.MODERATE,
  ).length;
  const clean =
    severe === 0 && moderate <= DECISION_GUARDS.maxModerateConflictsForTrade;

  switch (grade) {
    case SetupGrade.A_PLUS:
    case SetupGrade.A:
      return severe > 0 ? TradeDecision.WAIT : TradeDecision.TRADE;
    case SetupGrade.B_PLUS:
      return clean ? TradeDecision.TRADE : TradeDecision.WAIT;
    case SetupGrade.B:
      return severe >= 2 ? TradeDecision.NO_TRADE : TradeDecision.WAIT;
    case SetupGrade.C_PLUS:
      return severe > 0 ? TradeDecision.NO_TRADE : TradeDecision.WAIT;
    default:
      return TradeDecision.NO_TRADE;
  }
}

/**
 * How coherent the classification is, in [0, 1]. This is not a probability of
 * profit: it says how sure we are that the evidence really is this grade.
 */
function computeConfidence(
  input: TradeDecisionInput,
  componentScores: Record<DecisionCategory, ComponentScore>,
  conflicts: readonly DecisionConflict[],
  normalizedScore: number,
): number {
  const scored = Object.values(componentScores).filter(
    (component) => component.earned !== null && component.available > 0,
  );
  const ratios = scored.map(
    (component) => (component.earned ?? 0) / component.available,
  );
  const mean =
    ratios.length > 0
      ? ratios.reduce((total, ratio) => total + ratio, 0) / ratios.length
      : 0;
  const spread =
    ratios.length > 0
      ? Math.sqrt(
          ratios.reduce(
            (total, ratio) => total + (ratio - mean) * (ratio - mean),
            0,
          ) / ratios.length,
        )
      : 1;
  const agreement = clamp01(1 - spread * 2);

  const boundary = GRADE_THRESHOLDS.map((threshold) => threshold.minScore)
    .filter((minScore) => minScore > 0)
    .reduce(
      (closest, minScore) =>
        Math.min(closest, Math.abs(normalizedScore - minScore)),
      Number.POSITIVE_INFINITY,
    );
  const gradeMargin = clamp01(boundary / 5);

  const dataQuality =
    input.regime.dataQuality.warnings.length === 0 &&
    input.snapshot.warnings.length === 0
      ? 1
      : 0.6;

  let confidence =
    CONFIDENCE_WEIGHTS.signal * clamp01(input.signal.confidence) +
    CONFIDENCE_WEIGHTS.regime * clamp01(input.regime.confidence) +
    CONFIDENCE_WEIGHTS.optionSelection *
      clamp01(input.optionSelection.confidence) +
    CONFIDENCE_WEIGHTS.agreement * agreement +
    CONFIDENCE_WEIGHTS.dataQuality * dataQuality +
    CONFIDENCE_WEIGHTS.gradeMargin * gradeMargin;

  const missingOptional = Object.values(componentScores).filter(
    (component) => component.earned === null,
  ).length;
  confidence -=
    missingOptional * CONFIDENCE_PENALTIES.perMissingOptionalCategory;
  confidence -=
    conflicts.filter(
      (item) =>
        item.severity === ConflictSeverity.MAJOR ||
        item.severity === ConflictSeverity.CRITICAL,
    ).length * CONFIDENCE_PENALTIES.perMajorConflict;
  confidence -=
    conflicts.filter((item) => item.severity === ConflictSeverity.MODERATE)
      .length * CONFIDENCE_PENALTIES.perModerateConflict;
  if (input.snapshot.context.sessionMaturity === 'SETTLING') {
    confidence -= CONFIDENCE_PENALTIES.settlingSession;
  }

  return round2(clamp01(confidence));
}

function buildThesis(
  input: TradeDecisionInput,
  direction: TradeDirection,
  conflicts: readonly DecisionConflict[],
): string {
  if (direction === TradeDirection.NONE) {
    return 'No directional trade thesis on the 3-minute timeframe';
  }
  const bias = direction === TradeDirection.CALL ? 'Bullish' : 'Bearish';
  const openingRange = input.snapshot.openingRange;
  const broke =
    direction === TradeDirection.CALL
      ? openingRange.breakoutAbove
      : openingRange.breakdownBelow;
  const severe = conflicts.some(
    (item) =>
      item.severity === ConflictSeverity.MAJOR ||
      item.severity === ConflictSeverity.CRITICAL,
  );

  if (severe) {
    return `${bias} ${direction} thesis with contradicting evidence`;
  }
  if (broke) {
    return `${bias} ${direction} thesis confirmed by an opening-range break`;
  }
  if (input.regime.primaryRegime === MarketRegime.RANGE_BOUND) {
    return `${bias} ${direction} thesis inside a range-bound market`;
  }
  if (openingRange.currentPricePosition === 'INSIDE') {
    return `${bias} ${direction} thesis developing inside the opening range`;
  }
  return `${bias} ${direction} continuation thesis`;
}

function collectRiskFlags(
  input: TradeDecisionInput,
  componentScores: Record<DecisionCategory, ComponentScore>,
): string[] {
  const flags = Object.values(componentScores).flatMap(
    (component) => component.riskFlags,
  );
  if (!input.optionSelection.executionReady) {
    flags.push('Selected contract is not execution ready');
  }
  if (input.snapshot.context.sessionMaturity === 'SETTLING') {
    flags.push('Early-session evidence: the session is still settling');
  }
  if (input.regime.secondaryCharacteristics.volatility === 'HIGH') {
    flags.push('Underlying volatility is high');
  }
  return unique(flags);
}

function buildReasoning(
  input: TradeDecisionInput,
  direction: TradeDirection,
  componentScores: Record<DecisionCategory, ComponentScore>,
  conflicts: readonly DecisionConflict[],
  grade: SetupGrade,
  score: number,
  decision: TradeDecision,
  hardBlockers: readonly HardBlocker[],
): string[] {
  const reasoning: string[] = [
    `Signal engine returned ${input.signal.signal}; directional thesis is ${direction}`,
    `Regime is ${input.regime.primaryRegime} with confidence ${input.regime.confidence}`,
  ];

  for (const [category, component] of Object.entries(componentScores)) {
    reasoning.push(
      component.earned === null
        ? `${category}: not scored (${component.reason ?? 'unavailable'}); its weight left the denominator`
        : `${category}: ${component.earned}/${component.available}`,
    );
  }

  reasoning.push(
    ...Object.values(componentScores).flatMap(
      (component) => component.confirmations,
    ),
  );
  reasoning.push(
    ...conflicts.map(
      (item) => `${item.severity} conflict: ${item.description}`,
    ),
  );
  reasoning.push(
    `Normalized decision score is ${score} out of 100, graded ${grade}`,
  );
  reasoning.push(
    ...hardBlockers.map((blocker) => `Blocker: ${blocker.description}`),
  );
  reasoning.push(
    decision === TradeDecision.TRADE
      ? 'Thesis is strong enough to proceed to 5-minute entry confirmation'
      : `Decision is ${decision}`,
  );
  return reasoning;
}

function buildMarketContext(
  input: TradeDecisionInput,
): TradeDecisionResult['marketContext'] {
  const { snapshot, regime, signal } = input;
  return {
    regime: regime.primaryRegime,
    regimeConfidence: regime.confidence,
    trendDirection: regime.secondaryCharacteristics.trendDirection,
    trendStrength: regime.secondaryCharacteristics.trendStrength,
    volatility: regime.secondaryCharacteristics.volatility,
    signal: signal.signal,
    signalConfidence: signal.confidence,
    marketSession: snapshot.context.marketSession,
    sessionMaturity: snapshot.context.sessionMaturity,
    timeframeMinutes: snapshot.context.timeframeMinutes,
    currentSessionCandleCount: snapshot.context.currentSessionCandleCount,
    currentPrice: regime.features.currentPrice,
    sessionOpen: snapshot.currentSessionFeatures.open,
    sessionHigh: snapshot.currentSessionFeatures.high,
    sessionLow: snapshot.currentSessionFeatures.low,
    premarketHigh: snapshot.premarket.high,
    premarketLow: snapshot.premarket.low,
    openingRange: snapshot.openingRange,
  };
}

function buildNewsContext(
  news: NewsIntelligenceResult | null,
): DecisionNewsContext {
  if (news === null) {
    return {
      available: false,
      sentiment: null,
      sentimentConfidence: null,
      marketRiskBias: null,
      riskBiasConfidence: null,
      impact: null,
      articleCount: null,
      dominantCatalysts: [],
    };
  }
  return {
    available: true,
    sentiment: news.overallSentiment,
    sentimentConfidence: news.sentimentConfidence,
    marketRiskBias: news.marketRiskBias,
    riskBiasConfidence: news.riskBiasConfidence,
    impact: news.newsImpact,
    articleCount: news.articleCount,
    dominantCatalysts: news.dominantCatalysts,
  };
}

function buildVolatilityContext(
  volatility: VolatilityIntelligenceResult | null,
): DecisionVolatilityContext {
  if (volatility === null) {
    return {
      available: false,
      volatilitySymbol: '',
      vix: null,
      state: null,
      trend: null,
      momentum: null,
      signalAlignment: null,
      volatilityPressureScore: null,
    };
  }
  const available = volatility.vix.available;
  return {
    available,
    volatilitySymbol: volatility.volatilitySymbol,
    vix: volatility.vix.current,
    state: available ? volatility.volatilityState : null,
    trend: available ? volatility.volatilityTrend : null,
    momentum: available ? volatility.volatilityMomentum : null,
    signalAlignment: available ? volatility.signalAlignment : null,
    volatilityPressureScore: available
      ? volatility.volatilityPressureScore
      : null,
  };
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
