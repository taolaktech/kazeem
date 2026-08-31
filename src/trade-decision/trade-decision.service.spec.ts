import { ServiceUnavailableException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketDataService } from '../market-data/market-data.service.js';
import { NewsIntelligenceService } from '../news-intelligence/news-intelligence.service.js';
import { OptionSelectionService } from '../option-selection/option-selection.service.js';
import { RegimeService } from '../regime/regime.service.js';
import { SignalService } from '../signal/signal.service.js';
import { VolatilityIntelligenceService } from '../volatility-intelligence/volatility-intelligence.service.js';
import { TradeDecision, TradeDirection } from './enums/trade-decision.enum.js';
import {
  NOW,
  buildDecisionInput,
  buildNews,
  buildSelection,
  buildVolatility,
} from './testing/decision-factory.js';
import { TradeDecisionService } from './trade-decision.service.js';

describe('TradeDecisionService', () => {
  const base = buildDecisionInput();

  const marketDataService = { getSessionSnapshot: vi.fn() };
  const regimeService = { classifySession: vi.fn() };
  const signalService = { generateSignal: vi.fn() };
  const optionSelectionService = { selectForSignal: vi.fn() };
  const newsIntelligenceService = { getNewsIntelligence: vi.fn() };
  const volatilityIntelligenceService = { analyzeForSession: vi.fn() };

  let service: TradeDecisionService;

  beforeEach(async () => {
    vi.resetAllMocks();
    marketDataService.getSessionSnapshot.mockResolvedValue(base.snapshot);
    regimeService.classifySession.mockReturnValue(base.regime);
    signalService.generateSignal.mockReturnValue(base.signal);
    optionSelectionService.selectForSignal.mockResolvedValue(
      base.optionSelection,
    );
    newsIntelligenceService.getNewsIntelligence.mockResolvedValue(buildNews());
    volatilityIntelligenceService.analyzeForSession.mockResolvedValue(
      buildVolatility(),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeDecisionService,
        { provide: MarketDataService, useValue: marketDataService },
        { provide: RegimeService, useValue: regimeService },
        { provide: SignalService, useValue: signalService },
        { provide: OptionSelectionService, useValue: optionSelectionService },
        {
          provide: NewsIntelligenceService,
          useValue: newsIntelligenceService,
        },
        {
          provide: VolatilityIntelligenceService,
          useValue: volatilityIntelligenceService,
        },
      ],
    }).compile();

    service = module.get(TradeDecisionService);
  });

  it('fetches the underlying snapshot once and reuses it downstream', async () => {
    await service.evaluate('spy', { maxBudget: 500, now: NOW });

    expect(marketDataService.getSessionSnapshot).toHaveBeenCalledTimes(1);
    expect(marketDataService.getSessionSnapshot).toHaveBeenCalledWith('SPY', {
      now: NOW,
    });
    expect(regimeService.classifySession).toHaveBeenCalledWith(
      'SPY',
      base.snapshot,
    );
    expect(
      volatilityIntelligenceService.analyzeForSession,
    ).toHaveBeenCalledWith(base.snapshot, base.signal, NOW);
  });

  it('forwards maxBudget to option selection and never re-filters on price', async () => {
    const result = await service.evaluate('SPY', {
      maxBudget: 250,
      now: NOW,
    });

    expect(optionSelectionService.selectForSignal).toHaveBeenCalledWith(
      'SPY',
      base.signal,
      { maxBudget: 250 },
    );
    expect(result.maxBudget).toBe(250);
  });

  it('returns a normal decision when every dependency answers', async () => {
    const result = await service.evaluate('SPY', {
      maxBudget: 500,
      now: NOW,
    });

    expect(result.decision).toBe(TradeDecision.TRADE);
    expect(result.direction).toBe(TradeDirection.CALL);
  });

  it('degrades gracefully when news and volatility fail', async () => {
    newsIntelligenceService.getNewsIntelligence.mockRejectedValue(
      new ServiceUnavailableException('news down'),
    );
    volatilityIntelligenceService.analyzeForSession.mockRejectedValue(
      new ServiceUnavailableException('vix down'),
    );

    const result = await service.evaluate('SPY', {
      maxBudget: 500,
      now: NOW,
    });

    expect(result.availableWeight).toBe(90);
    expect(result.missingIntelligence).toContain('News provider unavailable');
    expect(result.missingIntelligence).toContain(
      'Real-time VIX confirmation unavailable',
    );
    expect(result.decision).toBe(TradeDecision.TRADE);
  });

  it('treats an option chain provider failure as a blocker, not a rejection', async () => {
    optionSelectionService.selectForSignal.mockRejectedValue(
      new ServiceUnavailableException('chain down'),
    );

    const result = await service.evaluate('SPY', {
      maxBudget: 500,
      now: NOW,
    });

    expect(result.decision).toBe(TradeDecision.WAIT);
    expect(result.hardBlockers).toContain(
      'Option chain provider is unavailable',
    );
    expect(result.selectedContract).toBeNull();
  });

  it('passes a legitimate NO_SELECTION straight through', async () => {
    optionSelectionService.selectForSignal.mockResolvedValue(
      buildSelection({ status: base.optionSelection.status, confidence: 0 }),
    );

    const result = await service.evaluate('SPY', {
      maxBudget: 500,
      now: NOW,
    });

    expect(result.optionSelectionStatus).toBe(base.optionSelection.status);
  });
});
