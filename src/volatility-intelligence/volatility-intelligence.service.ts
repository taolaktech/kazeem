import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketDataService } from '../market-data/market-data.service.js';
import { MarketSession } from '../market-data/session/market-session.enum.js';
import { MATURITY_CONFIDENCE_FACTOR } from '../market-data/session/session-maturity.js';
import type { MarketSessionSnapshot } from '../market-data/session/session-context.interface.js';
import type { SignalResult } from '../signal/interfaces/signal-result.interface.js';
import { SignalService } from '../signal/signal.service.js';
import {
  CONFIDENCE_WEIGHTS,
  PREMARKET_DIRECTIONAL_DECAY,
} from './constants/volatility-thresholds.js';
import {
  ConfirmationStrength,
  VolatilityMomentum,
  VolatilityRelationship,
  VolatilityState,
  VolatilityTrend,
} from './enums/volatility.enum.js';
import type { VolatilityIntelligenceResult } from './interfaces/volatility-intelligence-result.interface.js';
import {
  assessRelationship,
  resolveSignalAlignment,
  volatilityPressureScore,
  type RelationshipAssessment,
} from './relationship.js';
import { clampUnit, round } from './series-metrics.js';
import { buildUnderlyingMetrics } from './underlying-metrics.js';
import {
  analyzeVix,
  unavailableVix,
  type VixAnalysis,
} from './vix-analysis.js';
import {
  VOLATILITY_CONFIG_KEY,
  type VolatilityConfig,
} from './volatility-intelligence.config.js';

const MILLISECONDS_PER_MINUTE = 60_000;

export interface VolatilityIntelligenceOptions {
  /** Evaluation instant; injectable so session behaviour stays testable. */
  now?: Date;
}

/**
 * Contextual volatility layer: it describes the volatility environment and
 * whether it confirms or contradicts the underlying's movement. It never
 * produces a trade direction — that stays with the signal engine.
 */
@Injectable()
export class VolatilityIntelligenceService {
  private readonly logger = new Logger(VolatilityIntelligenceService.name);
  private readonly config: VolatilityConfig;

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly signalService: SignalService,
    configService: ConfigService,
  ) {
    this.config = configService.getOrThrow<VolatilityConfig>(
      VOLATILITY_CONFIG_KEY,
    );
  }

  /**
   * One underlying fetch, reused for the regime, the signal and the
   * comparable price features, plus one fetch for the volatility index.
   */
  async analyze(
    symbol: string,
    options: VolatilityIntelligenceOptions = {},
  ): Promise<VolatilityIntelligenceResult> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const now = options.now ?? new Date();

    const underlyingSnapshot = await this.marketDataService.getSessionSnapshot(
      normalizedSymbol,
      { now },
    );
    const signal = this.signalService.getSignalForSession(
      normalizedSymbol,
      underlyingSnapshot,
    );
    const vixSnapshot = await this.loadVixSnapshot(now);

    return this.build(underlyingSnapshot, vixSnapshot, signal, now);
  }

  /**
   * Index data sits behind a different Massive entitlement than equities, so
   * an unavailable volatility reference degrades the result instead of
   * failing the request.
   */
  private async loadVixSnapshot(
    now: Date,
  ): Promise<MarketSessionSnapshot | null> {
    try {
      return await this.marketDataService.getSessionSnapshot(
        this.config.vixSymbol,
        { now },
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Volatility reference ${this.config.vixSymbol} is unavailable: ${reason}`,
      );
      return null;
    }
  }

  private build(
    underlyingSnapshot: MarketSessionSnapshot,
    vixSnapshot: MarketSessionSnapshot | null,
    signal: SignalResult,
    now: Date,
  ): VolatilityIntelligenceResult {
    const vix: VixAnalysis =
      vixSnapshot === null
        ? unavailableVix(this.config.vixSymbol)
        : analyzeVix(vixSnapshot, {
            symbol: this.config.vixSymbol,
            momentumLookbackCandles: this.config.momentumLookbackCandles,
          });
    const underlying = buildUnderlyingMetrics(
      underlyingSnapshot,
      this.config.momentumLookbackCandles,
    );
    const assessment = assessRelationship(vix, underlying);
    const context = underlyingSnapshot.context;

    const staleFlags = this.freshnessFlags(vix, underlying);
    const dataFlags = this.dataQualityFlags(vix, vixSnapshot);
    const sessionFlags =
      context.marketSession === MarketSession.OPENING_SETTLEMENT
        ? ['Opening settlement period active']
        : [];

    const riskFlags = [
      ...vix.riskFlags,
      ...assessment.riskFlags,
      ...staleFlags,
      ...dataFlags,
      ...sessionFlags,
    ];

    return {
      symbol: underlyingSnapshot.symbol,
      volatilitySymbol: this.config.vixSymbol,
      timestamp: now,
      tradeEvaluationAllowed: signal.tradeEvaluationAllowed,
      volatilityState: vix.state,
      volatilityTrend: vix.trend,
      volatilityMomentum: vix.momentum,
      relationship: assessment.relationship,
      confirmationStrength: assessment.strength,
      confidence: this.computeConfidence(
        vix,
        underlying.current !== null,
        assessment,
        underlyingSnapshot,
        staleFlags.length === 0,
      ),
      volatilityPressureScore: volatilityPressureScore(
        vix.metrics,
        underlying,
        context.sessionMaturity,
      ),
      signal: signal.signal,
      signalAlignment: resolveSignalAlignment(
        signal.signal,
        assessment.relationship,
      ),
      vix: vix.metrics,
      underlying,
      sessionContext: {
        marketSession: context.marketSession,
        sessionMaturity: context.sessionMaturity,
        timeframeMinutes: context.timeframeMinutes,
        currentSessionCandleCount: context.currentSessionCandleCount,
        premarketDirectionalWeight:
          PREMARKET_DIRECTIONAL_DECAY[context.sessionMaturity],
      },
      confirmations: [...vix.confirmations, ...assessment.confirmations],
      divergences: assessment.divergences,
      reasoning: this.buildReasoning(vix, underlying, assessment, signal),
      riskFlags,
    };
  }

  private freshnessFlags(
    vix: VixAnalysis,
    underlying: { asOf: Date | null },
  ): string[] {
    const vixAsOf = vix.metrics.asOf;
    if (vixAsOf === null || underlying.asOf === null) {
      return [];
    }
    const driftMinutes =
      Math.abs(vixAsOf.getTime() - underlying.asOf.getTime()) /
      MILLISECONDS_PER_MINUTE;
    if (driftMinutes <= this.config.maxStalenessMinutes) {
      return [];
    }
    return [
      'VIX data is stale relative to underlying market data',
      'VIX and underlying timestamps are misaligned',
    ];
  }

  private dataQualityFlags(
    vix: VixAnalysis,
    vixSnapshot: MarketSessionSnapshot | null,
  ): string[] {
    if (!vix.metrics.available) {
      return [];
    }
    const flags: string[] = [];
    if (
      vix.metrics.currentSessionCandleCount <=
      this.config.momentumLookbackCandles
    ) {
      flags.push('Insufficient current-session VIX data');
    }
    if (vix.metrics.previousClose === null) {
      flags.push('Previous VIX session close is unavailable');
    }
    if (vixSnapshot !== null && !vixSnapshot.premarket.available) {
      flags.push('Premarket VIX data is unavailable');
    }
    return flags;
  }

  /**
   * Availability first — without VIX there is no volatility intelligence —
   * then how much of the session has developed, how well the VIX readings
   * agree with each other, how clear the relationship is, and freshness.
   */
  private computeConfidence(
    vix: VixAnalysis,
    underlyingAvailable: boolean,
    assessment: RelationshipAssessment,
    snapshot: MarketSessionSnapshot,
    fresh: boolean,
  ): number {
    if (!vix.metrics.available || !underlyingAvailable) {
      return 0;
    }

    const history = clampUnit(
      vix.metrics.currentSessionCandleCount /
        Math.max(1, this.config.momentumLookbackCandles * 2),
    );
    const availability = 0.5 + 0.5 * history;
    const maturity =
      MATURITY_CONFIDENCE_FACTOR[snapshot.context.sessionMaturity];

    const confidence =
      CONFIDENCE_WEIGHTS.dataAvailability * availability +
      CONFIDENCE_WEIGHTS.sessionMaturity * maturity +
      CONFIDENCE_WEIGHTS.internalAgreement * internalAgreement(vix) +
      CONFIDENCE_WEIGHTS.relationshipClarity * relationshipClarity(assessment) +
      CONFIDENCE_WEIGHTS.freshness * (fresh ? 1 : 0);

    return round(clampUnit(confidence), 2);
  }

  private buildReasoning(
    vix: VixAnalysis,
    underlying: { symbol: string; changePercentFromOpen: number | null },
    assessment: RelationshipAssessment,
    signal: SignalResult,
  ): string[] {
    const reasoning: string[] = [];
    if (underlying.changePercentFromOpen !== null) {
      reasoning.push(
        `${underlying.symbol} is ${describeMove(underlying.changePercentFromOpen)} from the regular-session open`,
      );
    }
    if (!vix.metrics.available) {
      reasoning.push(
        `${vix.metrics.symbol} data is unavailable, so volatility context could not be evaluated`,
      );
      return reasoning;
    }
    if (vix.metrics.changePercent !== null) {
      reasoning.push(
        `VIX is ${describeMove(vix.metrics.changePercent)} from its previous close at ${vix.metrics.current}`,
      );
    }
    reasoning.push(
      `VIX level is ${vix.state.toLowerCase()}, trend ${vix.trend.toLowerCase()}, momentum ${vix.momentum.toLowerCase().replace('_', ' ')}`,
    );
    reasoning.push(...describeRelationship(assessment.relationship));
    if (assessment.relationship !== VolatilityRelationship.UNKNOWN) {
      reasoning.push(
        `Signal engine returned ${signal.signal}; volatility ${resolveSignalAlignment(
          signal.signal,
          assessment.relationship,
        ).toLowerCase()} it`,
      );
    }
    return reasoning;
  }
}

function describeRelationship(relationship: VolatilityRelationship): string[] {
  switch (relationship) {
    case VolatilityRelationship.CONFIRMING_BEARISH:
      return ['Volatility confirms bearish underlying movement'];
    case VolatilityRelationship.CONFIRMING_BULLISH:
      return ['Volatility confirms bullish underlying movement'];
    case VolatilityRelationship.DIVERGENCE:
      return ['Volatility and the underlying are moving in conflict'];
    case VolatilityRelationship.NEUTRAL:
      return ['Volatility neither confirms nor contradicts the underlying'];
    default:
      return [];
  }
}

/** Do the level, trend and momentum readings tell the same story? */
function internalAgreement(vix: VixAnalysis): number {
  const trend = vix.trend;
  const momentum = vix.momentum;
  if (
    trend === VolatilityTrend.UNKNOWN ||
    momentum === VolatilityMomentum.UNKNOWN
  ) {
    return 0;
  }
  const rising =
    momentum === VolatilityMomentum.RISING ||
    momentum === VolatilityMomentum.RISING_FAST;
  const falling =
    momentum === VolatilityMomentum.FALLING ||
    momentum === VolatilityMomentum.FALLING_FAST;

  if (
    (trend === VolatilityTrend.RISING && rising) ||
    (trend === VolatilityTrend.FALLING && falling)
  ) {
    return 1;
  }
  if (trend === VolatilityTrend.FLAT && momentum === VolatilityMomentum.FLAT) {
    return 0.8;
  }
  if (
    (trend === VolatilityTrend.RISING && falling) ||
    (trend === VolatilityTrend.FALLING && rising)
  ) {
    return 0.2;
  }
  return vix.state === VolatilityState.UNKNOWN ? 0.3 : 0.6;
}

function relationshipClarity(assessment: RelationshipAssessment): number {
  switch (assessment.strength) {
    case ConfirmationStrength.STRONG:
      return 1;
    case ConfirmationStrength.MODERATE:
      return 0.7;
    case ConfirmationStrength.WEAK:
      return assessment.relationship === VolatilityRelationship.NEUTRAL
        ? 0.5
        : 0.4;
    default:
      return 0;
  }
}

function describeMove(percent: number): string {
  const direction = percent >= 0 ? 'up' : 'down';
  return `${direction} ${Math.abs(percent).toFixed(2)}%`;
}
