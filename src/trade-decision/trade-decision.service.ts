import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service.js';
import type { NewsIntelligenceResult } from '../news-intelligence/interfaces/news-intelligence-result.interface.js';
import { NewsIntelligenceService } from '../news-intelligence/news-intelligence.service.js';
import { OptionSelectionStatus } from '../option-selection/enums/option-selection-status.enum.js';
import type { OptionSelectionResult } from '../option-selection/interfaces/option-selection-result.interface.js';
import { OptionSelectionService } from '../option-selection/option-selection.service.js';
import { RegimeService } from '../regime/regime.service.js';
import type { SignalResult } from '../signal/interfaces/signal-result.interface.js';
import { SignalService } from '../signal/signal.service.js';
import type { VolatilityIntelligenceResult } from '../volatility-intelligence/interfaces/volatility-intelligence-result.interface.js';
import { VolatilityIntelligenceService } from '../volatility-intelligence/volatility-intelligence.service.js';
import type { TradeDecisionResult } from './interfaces/trade-decision-result.interface.js';
import { decide } from './trade-decision.engine.js';

export interface TradeDecisionOptions {
  /** Hard cap, in dollars, on the premium of one contract position. */
  maxBudget: number;
  now?: Date;
}

/**
 * Central V1 decision layer. It consumes the structured results of the layers
 * below it — never raw candles — and answers one question: is the 3-minute
 * thesis strong enough to proceed to the future 5-minute entry confirmation?
 * It is deterministic and rule-based, and it never executes anything.
 */
@Injectable()
export class TradeDecisionService {
  private readonly logger = new Logger(TradeDecisionService.name);

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly regimeService: RegimeService,
    private readonly signalService: SignalService,
    private readonly optionSelectionService: OptionSelectionService,
    private readonly newsIntelligenceService: NewsIntelligenceService,
    private readonly volatilityIntelligenceService: VolatilityIntelligenceService,
  ) {}

  /**
   * One underlying fetch feeds the regime, the signal, the structure evidence
   * and the volatility comparison; option selection and volatility reuse those
   * computed results rather than recomputing them.
   */
  async evaluate(
    symbol: string,
    options: TradeDecisionOptions,
  ): Promise<TradeDecisionResult> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const now = options.now ?? new Date();

    const snapshot = await this.marketDataService.getSessionSnapshot(
      normalizedSymbol,
      { now },
    );
    const regime = this.regimeService.classifySession(
      normalizedSymbol,
      snapshot,
    );
    const signal = this.signalService.generateSignal(normalizedSymbol, regime);

    const [optionSelection, news, volatility] = await Promise.all([
      this.selectOption(normalizedSymbol, signal, options.maxBudget),
      this.loadNews(normalizedSymbol),
      this.loadVolatility(normalizedSymbol, snapshot, signal, now),
    ]);

    return decide({
      symbol: normalizedSymbol,
      now,
      maxBudget: options.maxBudget,
      snapshot,
      regime,
      signal,
      optionSelection: optionSelection.result,
      optionProviderFailed: optionSelection.providerFailed,
      news,
      volatility,
    });
  }

  /**
   * A provider outage and a legitimate "nothing qualifies" are different
   * facts, so they are reported separately to the decision engine.
   */
  private async selectOption(
    symbol: string,
    signal: SignalResult,
    maxBudget: number,
  ): Promise<{ result: OptionSelectionResult; providerFailed: boolean }> {
    try {
      const result = await this.optionSelectionService.selectForSignal(
        symbol,
        signal,
        { maxBudget },
      );
      return { result, providerFailed: false };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Option selection unavailable for ${symbol}: ${reason}`);
      return {
        result: unavailableSelection(symbol, signal, maxBudget),
        providerFailed: true,
      };
    }
  }

  private async loadNews(
    symbol: string,
  ): Promise<NewsIntelligenceResult | null> {
    try {
      return await this.newsIntelligenceService.getNewsIntelligence(symbol);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `News intelligence unavailable for ${symbol}: ${reason}`,
      );
      return null;
    }
  }

  private async loadVolatility(
    symbol: string,
    snapshot: Parameters<VolatilityIntelligenceService['analyzeForSession']>[0],
    signal: SignalResult,
    now: Date,
  ): Promise<VolatilityIntelligenceResult | null> {
    try {
      return await this.volatilityIntelligenceService.analyzeForSession(
        snapshot,
        signal,
        now,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Volatility intelligence unavailable for ${symbol}: ${reason}`,
      );
      return null;
    }
  }
}

function unavailableSelection(
  symbol: string,
  signal: SignalResult,
  maxBudget: number,
): OptionSelectionResult {
  return {
    symbol,
    timestamp: signal.timestamp,
    signal: signal.signal,
    optionType: null,
    status: OptionSelectionStatus.NO_SELECTION,
    tradeEvaluationAllowed: signal.tradeEvaluationAllowed,
    confidence: 0,
    maxBudget,
    underlyingPrice: null,
    selectedContract: null,
    alternatives: [],
    reasoning: [
      'Option chain provider is unavailable; no contract was evaluated.',
    ],
    riskFlags: ['Option chain provider unavailable'],
    executionReady: false,
  };
}
