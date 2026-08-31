import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service.js';
import type { OptionType } from '../options-data/enums/option-type.enum.js';
import type { OptionContract } from '../options-data/interfaces/option-contract.interface.js';
import { OptionsDataService } from '../options-data/options-data.service.js';
import { MarketSignal } from '../signal/enums/market-signal.enum.js';
import type { SignalResult } from '../signal/interfaces/signal-result.interface.js';
import { SignalService } from '../signal/signal.service.js';
import { scoreCandidate } from './candidate-scoring.js';
import {
  CANDIDATE_POOL_SATURATION,
  CONFIDENCE_WEIGHTS,
  DEFAULT_MAX_ALTERNATIVES,
  MAX_SCORE,
  MISSING_QUOTE_CONFIDENCE_PENALTY,
  MIN_EXECUTION_COMPLETENESS,
  SELECTION_FILTERS,
  SPREAD_MAX_PERCENT,
} from './constants/option-selection-thresholds.js';
import { OptionSelectionStatus } from './enums/option-selection-status.enum.js';
import type { OptionCandidate } from './interfaces/option-candidate-score.interface.js';
import type { OptionSelectionResult } from './interfaces/option-selection-result.interface.js';

export interface OptionSelectionOptions {
  maxAlternatives?: number;
}

/**
 * Layer 2 of the decision architecture: given the signal engine's direction,
 * picks the best long CALL/PUT candidate. It never revisits direction, never
 * builds multi-leg structures and never executes anything.
 */
@Injectable()
export class OptionSelectionService {
  private readonly logger = new Logger(OptionSelectionService.name);

  constructor(
    private readonly signalService: SignalService,
    private readonly optionsDataService: OptionsDataService,
    private readonly marketDataService: MarketDataService,
  ) {}

  async selectForSymbol(
    symbol: string,
    options: OptionSelectionOptions = {},
  ): Promise<OptionSelectionResult> {
    const signal = await this.signalService.getSignalForSymbol(symbol);
    return this.selectForSignal(symbol, signal, options);
  }

  async selectForSignal(
    symbol: string,
    signal: SignalResult,
    options: OptionSelectionOptions = {},
  ): Promise<OptionSelectionResult> {
    const optionType = optionTypeFor(signal.signal);
    if (optionType === null) {
      return noSelection(symbol, signal, null, null, [
        `Signal engine returned ${signal.signal}; option contract selection was skipped.`,
      ]);
    }

    const underlyingPrice = await this.marketDataService.getLatestPrice(symbol);
    const contracts = await this.fetchContracts(symbol, optionType);
    const candidates = contracts
      .map((contract) => scoreCandidate(contract, underlyingPrice))
      .sort((left, right) => right.score - left.score);

    if (candidates.length === 0) {
      return noSelection(symbol, signal, optionType, underlyingPrice, [
        `Signal engine returned ${signal.signal}`,
        `No ${optionType} contracts met the minimum selection criteria.`,
      ]);
    }

    const [selected, ...rest] = candidates;
    const alternatives = rest.slice(
      0,
      options.maxAlternatives ?? DEFAULT_MAX_ALTERNATIVES,
    );
    const executionReady = isExecutionReady(selected);

    return {
      symbol,
      timestamp: signal.timestamp,
      signal: signal.signal,
      optionType,
      status: OptionSelectionStatus.SELECTED,
      confidence: this.computeConfidence(selected, candidates, signal),
      underlyingPrice,
      selectedContract: selected,
      alternatives,
      reasoning: [
        `Signal engine returned ${signal.signal}`,
        `${optionType} contracts were evaluated against an underlying price of ${underlyingPrice}`,
        `${candidates.length} contract(s) qualified; the top candidate scored ${selected.score} of ${MAX_SCORE}`,
        `Selected ${selected.symbol}: ${selected.moneyness}, ${selected.daysToExpiration} DTE, delta ${selected.delta ?? 'n/a'}`,
      ],
      riskFlags: selectionRiskFlags(selected, executionReady),
      executionReady,
    };
  }

  /** Returns an empty list rather than throwing when the chain has nothing usable. */
  private async fetchContracts(
    symbol: string,
    optionType: OptionType,
  ): Promise<OptionContract[]> {
    try {
      const chain = await this.optionsDataService.getOptionChain(symbol, {
        contractType: optionType,
        minDaysToExpiration: SELECTION_FILTERS.minDaysToExpiration,
        maxDaysToExpiration: SELECTION_FILTERS.maxDaysToExpiration,
        minVolume: SELECTION_FILTERS.minVolume,
        minOpenInterest: SELECTION_FILTERS.minOpenInterest,
      });
      return chain.contracts.filter(
        (contract) =>
          contract.contractType === optionType &&
          Math.abs(contract.strikePrice - chain.underlyingPrice) /
            chain.underlyingPrice <=
            SELECTION_FILTERS.maxStrikeDistancePercent,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.log(`No ${optionType} contracts available for ${symbol}`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Blends how good the winner is, how clearly it beats the runner-up, how
   * complete its data is, how confident the underlying signal was and how much
   * choice the chain offered — then discounts a selection with no real quote.
   */
  private computeConfidence(
    selected: OptionCandidate,
    candidates: OptionCandidate[],
    signal: SignalResult,
  ): number {
    const runnerUpScore = candidates[1]?.score ?? 0;
    const separation =
      selected.score > 0
        ? (selected.score - runnerUpScore) / selected.score
        : 0;

    const confidence =
      (CONFIDENCE_WEIGHTS.bestScore * clamp(selected.score / MAX_SCORE) +
        CONFIDENCE_WEIGHTS.separation * clamp(separation) +
        CONFIDENCE_WEIGHTS.completeness * clamp(selected.dataCompleteness) +
        CONFIDENCE_WEIGHTS.signal * clamp(signal.confidence) +
        CONFIDENCE_WEIGHTS.poolSize *
          clamp(candidates.length / CANDIDATE_POOL_SATURATION)) *
      (selected.quoteAvailable ? 1 : MISSING_QUOTE_CONFIDENCE_PENALTY);

    return Math.round(clamp(confidence) * 100) / 100;
  }
}

function optionTypeFor(signal: MarketSignal): OptionType | null {
  if (signal === MarketSignal.BULLISH) {
    return 'CALL';
  }
  return signal === MarketSignal.BEARISH ? 'PUT' : null;
}

function isExecutionReady(candidate: OptionCandidate): boolean {
  if (
    !candidate.quoteAvailable ||
    candidate.bid === null ||
    candidate.ask === null
  ) {
    return false;
  }
  const midpoint = (candidate.bid + candidate.ask) / 2;
  const spreadPercent = ((candidate.ask - candidate.bid) / midpoint) * 100;
  return (
    spreadPercent <= SPREAD_MAX_PERCENT &&
    candidate.dataCompleteness >= MIN_EXECUTION_COMPLETENESS
  );
}

function selectionRiskFlags(
  selected: OptionCandidate,
  executionReady: boolean,
): string[] {
  const flags = [...selected.riskFlags];
  if (!executionReady) {
    flags.push(
      'Selected analytically only; the contract is not ready for execution',
    );
  }
  return flags;
}

function noSelection(
  symbol: string,
  signal: SignalResult,
  optionType: OptionType | null,
  underlyingPrice: number | null,
  reasoning: string[],
): OptionSelectionResult {
  return {
    symbol,
    timestamp: signal.timestamp,
    signal: signal.signal,
    optionType,
    status: OptionSelectionStatus.NO_SELECTION,
    confidence: 0,
    underlyingPrice,
    selectedContract: null,
    alternatives: [],
    reasoning,
    riskFlags: [],
    executionReady: false,
  };
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
