import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { MarketDataService } from '../market-data/market-data.service.js';
import { MarketRegime } from '../regime/enums/market-regime.enum.js';
import type { OptionContract } from '../options-data/interfaces/option-contract.interface.js';
import type { OptionChain } from '../options-data/interfaces/option-chain.interface.js';
import { OptionsDataService } from '../options-data/options-data.service.js';
import { MarketSignal } from '../signal/enums/market-signal.enum.js';
import type { SignalResult } from '../signal/interfaces/signal-result.interface.js';
import { SignalService } from '../signal/signal.service.js';
import { OptionSelectionStatus } from './enums/option-selection-status.enum.js';
import type { OptionCandidate } from './interfaces/option-candidate-score.interface.js';
import type { OptionSelectionResult } from './interfaces/option-selection-result.interface.js';
import {
  OptionSelectionService,
  type OptionSelectionOptions,
} from './option-selection.service.js';
import {
  UNDERLYING_PRICE,
  buildContract,
  withQuote,
} from './testing/contract-factory.js';

function buildSignal(signal: MarketSignal, confidence = 0.8): SignalResult {
  return {
    symbol: 'TEST',
    timestamp: new Date('2026-09-02T14:30:00.000Z'),
    signal,
    confidence,
    scores: { bullish: 6, bearish: 1, noTrade: 0 },
    confirmations: [],
    conflicts: [],
    reasoning: [],
    marketContext: {
      regime: MarketRegime.TRENDING_BULLISH,
      regimeConfidence: confidence,
      trendDirection: 'BULLISH',
      trendStrength: 'STRONG',
      volatility: 'NORMAL',
    },
    riskFlags: [],
  };
}

function buildChain(contracts: OptionContract[]): OptionChain {
  return {
    underlyingSymbol: 'TEST',
    underlyingPrice: UNDERLYING_PRICE,
    timestamp: new Date('2026-09-02T14:30:00.000Z'),
    contracts,
    calls: contracts.filter((contract) => contract.contractType === 'CALL'),
    puts: contracts.filter((contract) => contract.contractType === 'PUT'),
    dataQuality: {
      contractCount: contracts.length,
      rejectedCount: 0,
      warnings: [],
    },
  };
}

describe('OptionSelectionService', () => {
  let service: OptionSelectionService;
  const getSignalForSymbol = vi.fn();
  const getOptionChain = vi.fn();
  const getLatestPrice = vi.fn();

  beforeEach(async () => {
    getSignalForSymbol.mockReset();
    getOptionChain.mockReset();
    getLatestPrice.mockReset();
    getLatestPrice.mockResolvedValue(UNDERLYING_PRICE);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        OptionSelectionService,
        { provide: SignalService, useValue: { getSignalForSymbol } },
        { provide: OptionsDataService, useValue: { getOptionChain } },
        { provide: MarketDataService, useValue: { getLatestPrice } },
      ],
    }).compile();
    service = moduleRef.get(OptionSelectionService);
  });

  /** Budget high enough that it never filters the default fixtures. */
  const DEFAULT_BUDGET = 100_000;

  function select(
    options: Partial<OptionSelectionOptions> = {},
  ): Promise<OptionSelectionResult> {
    return service.selectForSymbol('TEST', {
      maxBudget: DEFAULT_BUDGET,
      ...options,
    });
  }

  function mock(signal: MarketSignal, contracts: OptionContract[]): void {
    getSignalForSymbol.mockResolvedValue(buildSignal(signal));
    getOptionChain.mockResolvedValue(buildChain(contracts));
  }

  /** Scores a single contract in isolation via the public selection path. */
  async function scoreOne(contract: OptionContract): Promise<OptionCandidate> {
    mock(
      contract.contractType === 'CALL'
        ? MarketSignal.BULLISH
        : MarketSignal.BEARISH,
      [contract],
    );
    const result = await select();
    if (result.selectedContract === null) {
      throw new Error('expected a selected contract');
    }
    return result.selectedContract;
  }

  it('selects only CALL contracts on a BULLISH signal', async () => {
    mock(MarketSignal.BULLISH, [
      buildContract({ symbol: 'CALL_1' }),
      buildContract({ symbol: 'PUT_1', contractType: 'PUT' }),
    ]);

    const result = await select();

    expect(result.status).toBe(OptionSelectionStatus.SELECTED);
    expect(result.optionType).toBe('CALL');
    expect(result.selectedContract?.symbol).toBe('CALL_1');
    expect(getOptionChain).toHaveBeenCalledWith(
      'TEST',
      expect.objectContaining({ contractType: 'CALL' }),
    );
  });

  it('selects only PUT contracts on a BEARISH signal', async () => {
    mock(MarketSignal.BEARISH, [
      buildContract({ symbol: 'PUT_1', contractType: 'PUT', delta: -0.55 }),
      buildContract({ symbol: 'CALL_1' }),
    ]);

    const result = await select();

    expect(result.optionType).toBe('PUT');
    expect(result.selectedContract?.symbol).toBe('PUT_1');
    expect(getOptionChain).toHaveBeenCalledWith(
      'TEST',
      expect.objectContaining({ contractType: 'PUT' }),
    );
  });

  it('returns NO_SELECTION without touching the chain on NEUTRAL', async () => {
    getSignalForSymbol.mockResolvedValue(buildSignal(MarketSignal.NEUTRAL));

    const result = await select();

    expect(result.status).toBe(OptionSelectionStatus.NO_SELECTION);
    expect(result.signal).toBe(MarketSignal.NEUTRAL);
    expect(result.selectedContract).toBeNull();
    expect(result.optionType).toBeNull();
    expect(getOptionChain).not.toHaveBeenCalled();
    expect(getLatestPrice).not.toHaveBeenCalled();
  });

  it('returns NO_SELECTION without touching the chain on NO_TRADE', async () => {
    getSignalForSymbol.mockResolvedValue(buildSignal(MarketSignal.NO_TRADE));

    const result = await select();

    expect(result.status).toBe(OptionSelectionStatus.NO_SELECTION);
    expect(result.signal).toBe(MarketSignal.NO_TRADE);
    expect(result.executionReady).toBe(false);
    expect(getOptionChain).not.toHaveBeenCalled();
  });

  it('ranks an ATM contract above a far OTM one', async () => {
    mock(MarketSignal.BULLISH, [
      buildContract({ symbol: 'FAR_OTM', strikePrice: 104, delta: 0.12 }),
      buildContract({ symbol: 'ATM' }),
    ]);

    const result = await select();

    expect(result.selectedContract?.symbol).toBe('ATM');
    expect(result.selectedContract?.moneyness).toBe('ATM');
    expect(result.alternatives[0].symbol).toBe('FAR_OTM');
    expect(result.alternatives[0].moneyness).toBe('OTM');
    expect(result.alternatives[0].score).toBeLessThan(
      result.selectedContract?.score ?? 0,
    );
  });

  it('scores a contract in the preferred delta band above a weak-delta one', async () => {
    const strong = await scoreOne(buildContract({ delta: 0.55 }));
    const weak = await scoreOne(buildContract({ delta: 0.08 }));

    expect(strong.scoreBreakdown.delta).toBeGreaterThan(
      weak.scoreBreakdown.delta,
    );
  });

  it('scores higher volume above lower volume', async () => {
    const heavy = await scoreOne(buildContract({ volume: 5_000 }));
    const thin = await scoreOne(buildContract({ volume: 5 }));

    expect(heavy.scoreBreakdown.volume).toBeGreaterThan(
      thin.scoreBreakdown.volume,
    );
  });

  it('scores higher open interest above lower open interest', async () => {
    const deep = await scoreOne(buildContract({ openInterest: 10_000 }));
    const shallow = await scoreOne(buildContract({ openInterest: 10 }));

    expect(deep.scoreBreakdown.openInterest).toBeGreaterThan(
      shallow.scoreBreakdown.openInterest,
    );
  });

  it('prefers near-term expirations over the far end of the window', async () => {
    const nearTerm = await scoreOne(buildContract({ daysToExpiration: 1 }));
    const weekOut = await scoreOne(buildContract({ daysToExpiration: 7 }));
    const zeroDte = await scoreOne(buildContract({ daysToExpiration: 0 }));

    expect(nearTerm.scoreBreakdown.dte).toBeGreaterThan(
      weekOut.scoreBreakdown.dte,
    );
    expect(nearTerm.scoreBreakdown.dte).toBeGreaterThan(
      zeroDte.scoreBreakdown.dte,
    );
  });

  it('flags 0DTE contracts without excluding them', async () => {
    const candidate = await scoreOne(buildContract({ daysToExpiration: 0 }));

    expect(candidate.riskFlags).toContain(
      '0DTE contract with elevated theta and gamma risk',
    );
  });

  it('still selects a contract when bid/ask are missing', async () => {
    mock(MarketSignal.BULLISH, [withQuote(null, null)]);

    const result = await select();

    expect(result.status).toBe(OptionSelectionStatus.SELECTED);
    expect(result.selectedContract?.quoteAvailable).toBe(false);
    expect(result.selectedContract?.riskFlags).toContain(
      'Real-time bid/ask quote unavailable',
    );
    expect(result.selectedContract?.scoreBreakdown.spread).toBe(0);
  });

  it('is not execution ready when bid/ask are missing', async () => {
    mock(MarketSignal.BULLISH, [withQuote(null, null, { lastPrice: 1.42 })]);

    const result = await select();

    expect(result.executionReady).toBe(false);
    expect(result.selectedContract?.lastPrice).toBe(1.42);
    expect(result.riskFlags).toContain(
      'Selected analytically only; the contract is not ready for execution',
    );
  });

  it('is execution ready on a complete, tightly quoted contract', async () => {
    mock(MarketSignal.BULLISH, [withQuote(1.0, 1.02)]);

    const result = await select();

    expect(result.executionReady).toBe(true);
    expect(result.selectedContract?.quoteAvailable).toBe(true);
  });

  it('scores a tight spread above a wide spread', async () => {
    const tight = await scoreOne(withQuote(1.0, 1.02));
    const wide = await scoreOne(withQuote(1.0, 1.3));

    expect(tight.scoreBreakdown.spread).toBeGreaterThan(
      wide.scoreBreakdown.spread,
    );
    expect(wide.scoreBreakdown.spread).toBe(0);
  });

  it('reduces data completeness when implied volatility is missing', async () => {
    const complete = await scoreOne(buildContract());
    const withoutIv = await scoreOne(
      buildContract({ impliedVolatility: null }),
    );

    expect(withoutIv.dataCompleteness).toBeLessThan(complete.dataCompleteness);
    expect(withoutIv.riskFlags).toContain('Implied volatility unavailable');
  });

  it('reduces data completeness when greeks are missing', async () => {
    const complete = await scoreOne(buildContract());
    const withoutGreeks = await scoreOne(
      buildContract({ delta: null, gamma: null, theta: null, vega: null }),
    );

    expect(withoutGreeks.dataCompleteness).toBeLessThan(
      complete.dataCompleteness,
    );
    expect(withoutGreeks.riskFlags).toContain('Greeks unavailable');
  });

  it('returns NO_SELECTION when no contract qualifies', async () => {
    mock(MarketSignal.BULLISH, [
      buildContract({ symbol: 'MILES_AWAY', strikePrice: 180 }),
    ]);

    const result = await select();

    expect(result.status).toBe(OptionSelectionStatus.NO_SELECTION);
    expect(result.selectedContract).toBeNull();
    expect(result.optionType).toBe('CALL');
    expect(result.confidence).toBe(0);
  });

  it('returns NO_SELECTION instead of failing when the chain is empty', async () => {
    getSignalForSymbol.mockResolvedValue(buildSignal(MarketSignal.BULLISH));
    getOptionChain.mockRejectedValue(new NotFoundException('no contracts'));

    const result = await select();

    expect(result.status).toBe(OptionSelectionStatus.NO_SELECTION);
  });

  it('returns alternatives ranked below the selection and capped', async () => {
    mock(
      MarketSignal.BULLISH,
      [0.55, 0.5, 0.45, 0.42, 0.3, 0.2].map((delta, index) =>
        buildContract({ symbol: `CALL_${index}`, delta }),
      ),
    );

    const result = await select({ maxAlternatives: 3 });

    expect(result.alternatives).toHaveLength(3);
    const scores = [
      result.selectedContract?.score ?? 0,
      ...result.alternatives.map((candidate) => candidate.score),
    ];
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('propagates signal confidence into selection confidence', async () => {
    getOptionChain.mockResolvedValue(buildChain([buildContract()]));

    getSignalForSymbol.mockResolvedValue(
      buildSignal(MarketSignal.BULLISH, 0.95),
    );
    const strong = await select();

    getSignalForSymbol.mockResolvedValue(
      buildSignal(MarketSignal.BULLISH, 0.3),
    );
    const weak = await select();

    expect(strong.confidence).toBeGreaterThan(weak.confidence);
    expect(strong.confidence).toBeLessThanOrEqual(1);
    expect(weak.confidence).toBeGreaterThanOrEqual(0);
  });

  it('lowers confidence when the selection has no quote', async () => {
    mock(MarketSignal.BULLISH, [withQuote(1.0, 1.02)]);
    const quoted = await select();

    mock(MarketSignal.BULLISH, [withQuote(null, null)]);
    const unquoted = await select();

    expect(unquoted.confidence).toBeLessThan(quoted.confidence);
  });

  it('rejects contracts whose estimated cost exceeds the max budget', async () => {
    mock(MarketSignal.BULLISH, [
      withQuote(6.0, 6.1, { symbol: 'EXPENSIVE' }),
      withQuote(3.1, 3.2, { symbol: 'AFFORDABLE', delta: 0.5 }),
    ]);

    const result = await select({ maxBudget: 500 });

    expect(result.selectedContract?.symbol).toBe('AFFORDABLE');
    expect(result.selectedContract?.estimatedContractCost).toBe(320);
    expect(result.selectedContract?.withinBudget).toBe(true);
    expect(result.maxBudget).toBe(500);
    expect(
      result.alternatives.map((candidate) => candidate.symbol),
    ).not.toContain('EXPENSIVE');
  });

  it('never ranks an over-budget contract even when it scores highest', async () => {
    mock(MarketSignal.BULLISH, [
      withQuote(6.0, 6.1, { symbol: 'BEST_BUT_PRICEY', delta: 0.55 }),
    ]);

    const result = await select({ maxBudget: 500 });

    expect(result.status).toBe(OptionSelectionStatus.NO_SELECTION);
    expect(result.selectedContract).toBeNull();
    expect(result.reasoning).toContain(
      'No qualifying CALL contract was available within the $500 maximum trade budget',
    );
  });

  it('prices the budget check from the ask, then midpoint, then last price', async () => {
    const quoted = await scoreOne(withQuote(3.0, 3.2));
    expect(quoted.premiumPriceSource).toBe('ASK');
    expect(quoted.estimatedContractCost).toBe(320);

    const midOnly = await scoreOne(
      buildContract({ bid: null, ask: null, midpoint: 2.5 }),
    );
    expect(midOnly.premiumPriceSource).toBe('MIDPOINT');
    expect(midOnly.estimatedContractCost).toBe(250);

    const lastOnly = await scoreOne(withQuote(null, null, { lastPrice: 1.4 }));
    expect(lastOnly.premiumPriceSource).toBe('LAST_PRICE');
    expect(lastOnly.estimatedContractCost).toBe(140);
    expect(lastOnly.riskFlags).toContain(
      'Budget eligibility estimated from last trade price; current ask unavailable.',
    );
  });

  it('rejects a contract with no usable premium price', async () => {
    mock(MarketSignal.BULLISH, [
      withQuote(null, null, { symbol: 'NO_PRICE', lastPrice: null }),
    ]);

    const result = await select({ maxBudget: 500 });

    expect(result.status).toBe(OptionSelectionStatus.NO_SELECTION);
    expect(result.reasoning).toContain(
      'Unable to verify contract cost against max budget for 1 contract(s).',
    );
  });

  it('is not execution ready when budget eligibility came from the last price', async () => {
    mock(MarketSignal.BULLISH, [withQuote(null, null, { lastPrice: 1.4 })]);

    const result = await select({ maxBudget: 500 });

    expect(result.status).toBe(OptionSelectionStatus.SELECTED);
    expect(result.executionReady).toBe(false);
  });

  it('reports the max budget on a non-directional signal', async () => {
    getSignalForSymbol.mockResolvedValue(buildSignal(MarketSignal.NEUTRAL));

    const result = await select({ maxBudget: 250 });

    expect(result.maxBudget).toBe(250);
  });

  it('classifies moneyness relative to the live underlying price', async () => {
    getLatestPrice.mockResolvedValue(UNDERLYING_PRICE);
    mock(MarketSignal.BEARISH, [
      buildContract({ contractType: 'PUT', strikePrice: 102, delta: -0.6 }),
    ]);

    const result = await select();

    expect(result.selectedContract?.moneyness).toBe('ITM');
    expect(result.selectedContract?.strikeDistancePercent).toBeCloseTo(0.02, 4);
    expect(getLatestPrice).toHaveBeenCalledWith('TEST');
  });
});
