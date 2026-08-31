import { Injectable } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service.js';
import { validateCandles } from './candle-validator.js';
import { IndicatorService } from './indicators/indicator.service.js';
import {
  MARKET_REGIMES,
  MarketRegime,
  TREND_REGIMES,
  VOLATILITY_REGIMES,
  type TrendDirection,
  type TrendStrength,
  type VolatilityLevel,
} from './enums/market-regime.enum.js';
import { InsufficientMarketDataException } from './errors/insufficient-market-data.exception.js';
import type { IndicatorSnapshot } from './interfaces/indicator-features.interface.js';
import type { MarketCandle } from './interfaces/market-data.interface.js';
import type {
  RegimeClassificationResult,
  RegimeClassifier,
  RegimeSecondaryCharacteristics,
} from './interfaces/regime-result.interface.js';
import {
  buildSignals,
  maxAttainableScore,
  scoreSignals,
  type RegimeSignals,
} from './regime-scoring.js';
import {
  ADX_RANGE_THRESHOLD,
  ADX_TREND_THRESHOLD,
  CONFIDENCE_WEIGHTS,
  HIGH_VOLATILITY_RANK,
  LOW_VOLATILITY_RANK,
  MIN_RECOMMENDED_CANDLES,
  MIN_REQUIRED_CANDLES,
  TREND_PRIORITY_MIN_SCORE,
  TREND_STRENGTH_MODERATE_ADX,
  TREND_STRENGTH_STRONG_ADX,
} from './regime.constants.js';

/** Deterministic, rule-based market regime classifier (version 1, no ML). */
@Injectable()
export class RegimeService implements RegimeClassifier {
  constructor(
    private readonly indicatorService: IndicatorService,
    private readonly marketDataService: MarketDataService,
  ) {}

  /** Classifies `symbol` from market data fetched on demand. */
  async classifySymbol(
    symbol: string,
    count?: number,
  ): Promise<RegimeClassificationResult> {
    const candles = await this.marketDataService.getRecentMinuteCandles(
      symbol,
      count,
    );
    return this.classify(symbol, candles);
  }

  async classify(
    symbol: string,
    candles: MarketCandle[],
  ): Promise<RegimeClassificationResult> {
    const validated = validateCandles(candles);
    const candleCount = validated.candles.length;
    if (candleCount < MIN_REQUIRED_CANDLES) {
      throw new InsufficientMarketDataException(
        symbol,
        candleCount,
        validated.warnings,
      );
    }

    const snapshot = this.indicatorService.computeSnapshot(validated.candles);
    const warnings = [...validated.warnings, ...snapshot.warnings];
    if (candleCount < MIN_RECOMMENDED_CANDLES) {
      warnings.push(
        `Only ${candleCount} candles provided; ${MIN_RECOMMENDED_CANDLES} are recommended for a stable classification.`,
      );
    }

    const signals = buildSignals(snapshot);
    const scores = scoreSignals(signals);
    const primaryRegime = this.selectPrimaryRegime(scores, snapshot);
    const confidence = this.computeConfidence(
      primaryRegime,
      scores,
      signals,
      candleCount,
    );

    return {
      symbol,
      timestamp: validated.candles[candleCount - 1].timestamp,
      primaryRegime,
      confidence,
      scores,
      secondaryCharacteristics: this.describeSecondaryCharacteristics(
        snapshot,
        scores,
      ),
      features: snapshot.features,
      reasoning: this.buildReasoning(primaryRegime, signals, scores),
      dataQuality: {
        candleCount,
        sufficientData: candleCount >= MIN_RECOMMENDED_CANDLES,
        warnings,
      },
    };
  }

  /**
   * Highest score wins, with two guards: a trend regime needs directional
   * strength (ADX) to be eligible at all, and a volatility regime never
   * overrides a strongly supported trend — volatility then only shows up in
   * the secondary characteristics.
   */
  private selectPrimaryRegime(
    scores: Record<MarketRegime, number>,
    snapshot: IndicatorSnapshot,
  ): MarketRegime {
    const adx = snapshot.features.adx ?? 0;
    const trendEligible = adx >= ADX_RANGE_THRESHOLD;
    const candidates = trendEligible
      ? MARKET_REGIMES
      : MARKET_REGIMES.filter((regime) => !TREND_REGIMES.includes(regime));

    const leader = this.rankRegimes(scores, candidates)[0];
    if (!VOLATILITY_REGIMES.includes(leader)) {
      return leader;
    }
    const bestTrend = this.bestOf(scores, TREND_REGIMES);
    return trendEligible &&
      adx >= ADX_TREND_THRESHOLD &&
      scores[bestTrend] >= TREND_PRIORITY_MIN_SCORE
      ? bestTrend
      : leader;
  }

  private rankRegimes(
    scores: Record<MarketRegime, number>,
    candidates: readonly MarketRegime[],
  ): MarketRegime[] {
    return [...candidates].sort((left, right) => {
      const difference = scores[right] - scores[left];
      return difference !== 0
        ? difference
        : MARKET_REGIMES.indexOf(left) - MARKET_REGIMES.indexOf(right);
    });
  }

  private bestOf(
    scores: Record<MarketRegime, number>,
    candidates: readonly MarketRegime[],
  ): MarketRegime {
    return [...candidates].sort(
      (left, right) => scores[right] - scores[left],
    )[0];
  }

  /**
   * Blends how much of the winning regime's attainable score was earned, how
   * far ahead it is of the runner-up, and how many of its indicators agree.
   * Conflicting indicators shrink both the separation and agreement terms.
   * The result is scaled down when history is shorter than recommended.
   */
  private computeConfidence(
    primaryRegime: MarketRegime,
    scores: Record<MarketRegime, number>,
    signals: RegimeSignals,
    candleCount: number,
  ): number {
    const attainable = maxAttainableScore(signals[primaryRegime]);
    const strength = attainable > 0 ? scores[primaryRegime] / attainable : 0;

    const sorted = MARKET_REGIMES.map((regime) => scores[regime]).sort(
      (left, right) => right - left,
    );
    const top = sorted[0];
    const separation = top > 0 ? (top - sorted[1]) / top : 0;

    const applicable = signals[primaryRegime].filter(
      (candidate) => candidate.applicable,
    );
    const agreement =
      applicable.length > 0
        ? applicable.filter((candidate) => candidate.matched).length /
          applicable.length
        : 0;

    const dataQualityFactor = Math.min(
      1,
      candleCount / MIN_RECOMMENDED_CANDLES,
    );
    const confidence =
      (CONFIDENCE_WEIGHTS.scoreStrength * strength +
        CONFIDENCE_WEIGHTS.separation * separation +
        CONFIDENCE_WEIGHTS.agreement * agreement) *
      dataQualityFactor;

    return Math.round(Math.min(1, Math.max(0, confidence)) * 100) / 100;
  }

  private describeSecondaryCharacteristics(
    snapshot: IndicatorSnapshot,
    scores: Record<MarketRegime, number>,
  ): RegimeSecondaryCharacteristics {
    return {
      trendDirection: this.resolveTrendDirection(snapshot, scores),
      trendStrength: this.resolveTrendStrength(snapshot.features.adx),
      volatility: this.resolveVolatility(snapshot),
    };
  }

  private resolveTrendDirection(
    snapshot: IndicatorSnapshot,
    scores: Record<MarketRegime, number>,
  ): TrendDirection {
    const bullish = scores[MarketRegime.TRENDING_BULLISH];
    const bearish = scores[MarketRegime.TRENDING_BEARISH];
    if (bullish === bearish) {
      return 'NEUTRAL';
    }
    if (Math.max(bullish, bearish) < TREND_PRIORITY_MIN_SCORE) {
      return snapshot.emaAlignment === 'MIXED'
        ? 'NEUTRAL'
        : snapshot.emaAlignment;
    }
    return bullish > bearish ? 'BULLISH' : 'BEARISH';
  }

  private resolveTrendStrength(adx?: number): TrendStrength {
    if (adx === undefined || adx < TREND_STRENGTH_MODERATE_ADX) {
      return 'WEAK';
    }
    return adx >= TREND_STRENGTH_STRONG_ADX ? 'STRONG' : 'MODERATE';
  }

  private resolveVolatility(snapshot: IndicatorSnapshot): VolatilityLevel {
    const rank = snapshot.atrPercentRank;
    if (rank === undefined) {
      return 'NORMAL';
    }
    if (rank >= HIGH_VOLATILITY_RANK) {
      return 'HIGH';
    }
    return rank <= LOW_VOLATILITY_RANK ? 'LOW' : 'NORMAL';
  }

  private buildReasoning(
    primaryRegime: MarketRegime,
    signals: RegimeSignals,
    scores: Record<MarketRegime, number>,
  ): string[] {
    const matched = signals[primaryRegime]
      .filter((candidate) => candidate.matched)
      .map(
        (candidate) => `${candidate.description} (+${candidate.weight} points)`,
      );
    const conflicting = MARKET_REGIMES.filter(
      (regime) => regime !== primaryRegime && scores[regime] > 0,
    ).map((regime) => `${regime} also scored ${scores[regime]} points`);

    return [
      `Primary regime ${primaryRegime} scored ${scores[primaryRegime]} points.`,
      ...matched,
      ...conflicting,
    ];
  }
}
