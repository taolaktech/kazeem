import { Injectable } from '@nestjs/common';
import type { MarketSessionSnapshot } from '../market-data/session/session-context.interface.js';
import type { RegimeClassificationResult } from '../regime/interfaces/regime-result.interface.js';
import { RegimeService } from '../regime/regime.service.js';
import {
  CONFIDENCE_WEIGHTS,
  DATA_QUALITY_PENALTY,
  MAX_DIRECTIONAL_SCORE,
  MIN_DIRECTIONAL_MARGIN,
  MIN_DIRECTIONAL_SCORE,
  NO_TRADE_SCORE_THRESHOLD,
  REGIME_CONFIDENCE_FLOOR,
} from './constants/signal-thresholds.js';
import { MarketSignal } from './enums/market-signal.enum.js';
import type {
  SignalResult,
  SignalScores,
} from './interfaces/signal-result.interface.js';
import { evaluateFactors, type SignalFactor } from './signal-factors.js';

/**
 * Layer 1 of the decision architecture: a deterministic, rule-based
 * directional bias derived from an existing regime classification. It never
 * selects contracts, sizes positions or executes anything.
 */
@Injectable()
export class SignalService {
  constructor(private readonly regimeService: RegimeService) {}

  /** Classifies `symbol`'s current regime and derives its directional bias. */
  async getSignalForSymbol(
    symbol: string,
    count?: number,
  ): Promise<SignalResult> {
    const regime = await this.regimeService.classifySymbol(symbol, count);
    return this.generateSignal(symbol, regime);
  }

  /**
   * Derives the directional bias from an already fetched session snapshot, so
   * callers that need both the signal and the underlying's price features pay
   * for a single market data request.
   */
  getSignalForSession(
    symbol: string,
    session: MarketSessionSnapshot,
  ): SignalResult {
    return this.generateSignal(
      symbol,
      this.regimeService.classifySession(symbol, session),
    );
  }

  generateSignal(
    symbol: string,
    regime: RegimeClassificationResult,
  ): SignalResult {
    const factors = evaluateFactors(regime);
    const scores = tally(factors);
    const confirmations = collect(factors, 'confirmation');
    const conflicts = collect(factors, 'conflict');
    const riskFlags = [
      ...collect(factors, 'riskFlag'),
      ...(regime.riskFlags ?? []),
    ];

    const leaderScore = Math.max(scores.bullish, scores.bearish);
    const opposingScore = Math.min(scores.bullish, scores.bearish);
    const margin = leaderScore - opposingScore;
    const contested =
      leaderScore >= MIN_DIRECTIONAL_SCORE && margin < MIN_DIRECTIONAL_MARGIN;
    if (contested) {
      conflicts.push('Bullish and bearish directional scores are close');
    }

    const signal = this.decide(scores, leaderScore, margin, contested);
    const directionalConfirmations =
      signal === MarketSignal.BULLISH || signal === MarketSignal.BEARISH
        ? confirmations
        : [];

    return {
      symbol,
      timestamp: regime.timestamp,
      signal,
      tradeEvaluationAllowed: regime.tradeEvaluationAllowed ?? true,
      confidence: this.computeConfidence(
        signal,
        scores,
        regime,
        directionalConfirmations.length,
        conflicts.length,
      ),
      scores,
      confirmations: directionalConfirmations,
      conflicts,
      reasoning: this.buildReasoning(
        signal,
        scores,
        directionalConfirmations,
        conflicts,
      ),
      marketContext: {
        regime: regime.primaryRegime,
        regimeConfidence: regime.confidence,
        ...regime.secondaryCharacteristics,
        marketSession: regime.sessionContext?.marketSession,
        sessionMaturity: regime.sessionContext?.sessionMaturity,
        timeframeMinutes: regime.sessionContext?.timeframeMinutes,
        currentSessionCandleCount:
          regime.sessionContext?.currentSessionCandleCount,
        indicatorCandleCount: regime.sessionContext?.indicatorCandleCount,
      },
      riskFlags,
    };
  }

  /**
   * Caution first, then the absence of direction, then a contested lead.
   * Only evidence that clearly beats its opposite becomes a tradable bias.
   */
  private decide(
    scores: SignalScores,
    leaderScore: number,
    margin: number,
    contested: boolean,
  ): MarketSignal {
    if (scores.noTrade >= NO_TRADE_SCORE_THRESHOLD) {
      return MarketSignal.NO_TRADE;
    }
    if (leaderScore < MIN_DIRECTIONAL_SCORE || margin === 0) {
      return MarketSignal.NEUTRAL;
    }
    if (contested) {
      return MarketSignal.NO_TRADE;
    }
    return scores.bullish > scores.bearish
      ? MarketSignal.BULLISH
      : MarketSignal.BEARISH;
  }

  /**
   * Blends how much of the attainable evidence the decision earned, how far
   * it is ahead of the alternative, and how clean the evidence is. Directional
   * calls are additionally discounted by the confidence of the regime they
   * rest on, and any decision is discounted when data quality was flagged.
   */
  private computeConfidence(
    signal: MarketSignal,
    scores: SignalScores,
    regime: RegimeClassificationResult,
    confirmationCount: number,
    conflictCount: number,
  ): number {
    const directional =
      signal === MarketSignal.BULLISH || signal === MarketSignal.BEARISH;
    const leaderScore = Math.max(scores.bullish, scores.bearish);
    const opposingScore = Math.min(scores.bullish, scores.bearish);

    const { strength, separation, agreement } = directional
      ? {
          strength: leaderScore / MAX_DIRECTIONAL_SCORE,
          separation:
            leaderScore > 0 ? (leaderScore - opposingScore) / leaderScore : 0,
          agreement: ratio(confirmationCount, conflictCount),
        }
      : signal === MarketSignal.NO_TRADE
        ? {
            strength: Math.min(1, scores.noTrade / NO_TRADE_SCORE_THRESHOLD),
            separation:
              scores.noTrade > 0
                ? Math.min(1, scores.noTrade / Math.max(leaderScore, 1))
                : 0,
            agreement: ratio(conflictCount, confirmationCount),
          }
        : {
            strength: 1 - leaderScore / MAX_DIRECTIONAL_SCORE,
            separation:
              leaderScore > 0
                ? 1 - (leaderScore - opposingScore) / leaderScore
                : 1,
            agreement: ratio(1, confirmationCount + conflictCount),
          };

    const regimeFactor = directional
      ? REGIME_CONFIDENCE_FLOOR +
        (1 - REGIME_CONFIDENCE_FLOOR) * regime.confidence
      : 1;
    const dataQualityFactor =
      regime.dataQuality.warnings.length > 0 ||
      !regime.dataQuality.sufficientData
        ? DATA_QUALITY_PENALTY
        : 1;

    const confidence =
      (CONFIDENCE_WEIGHTS.strength * clamp(strength) +
        CONFIDENCE_WEIGHTS.separation * clamp(separation) +
        CONFIDENCE_WEIGHTS.agreement * clamp(agreement)) *
      regimeFactor *
      dataQualityFactor;

    return Math.round(clamp(confidence) * 100) / 100;
  }

  private buildReasoning(
    signal: MarketSignal,
    scores: SignalScores,
    confirmations: string[],
    conflicts: string[],
  ): string[] {
    const reasoning = [
      `Directional scores: bullish ${scores.bullish}, bearish ${scores.bearish}, caution ${scores.noTrade}`,
    ];
    switch (signal) {
      case MarketSignal.BULLISH:
      case MarketSignal.BEARISH:
        reasoning.push(
          `${confirmations.length} indicators support a ${signal.toLowerCase()} bias`,
        );
        break;
      case MarketSignal.NEUTRAL:
        reasoning.push('No direction reached the minimum directional score');
        break;
      case MarketSignal.NO_TRADE:
        reasoning.push(
          'Conditions are too cautionary or conflicting to justify an entry',
        );
        break;
    }
    return [...reasoning, ...confirmations, ...conflicts];
  }
}

function tally(factors: SignalFactor[]): SignalScores {
  return factors.reduce<SignalScores>(
    (totals, factor) => ({
      bullish: round(totals.bullish + (factor.bullish ?? 0)),
      bearish: round(totals.bearish + (factor.bearish ?? 0)),
      noTrade: round(totals.noTrade + (factor.noTrade ?? 0)),
    }),
    { bullish: 0, bearish: 0, noTrade: 0 },
  );
}

function collect(
  factors: SignalFactor[],
  key: 'confirmation' | 'conflict' | 'riskFlag',
): string[] {
  return factors.flatMap((factor) => {
    const value = factor[key];
    return value === undefined ? [] : [value];
  });
}

function ratio(supporting: number, opposing: number): number {
  const total = supporting + opposing;
  return total === 0 ? 0 : supporting / total;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
