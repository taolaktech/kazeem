import { Test, type TestingModule } from '@nestjs/testing';
import { MarketRegime } from '../regime/enums/market-regime.enum.js';
import { RegimeService } from '../regime/regime.service.js';
import { MarketSignal } from './enums/market-signal.enum.js';
import { SignalService } from './signal.service.js';
import {
  BEARISH_EMAS,
  BULLISH_EMAS,
  MIXED_EMAS,
  buildRegime,
} from './testing/regime-factory.js';
import {
  MarketSession,
  SessionMaturity,
} from '../market-data/session/market-session.enum.js';

describe('SignalService', () => {
  let service: SignalService;
  const classifySymbol = vi.fn();

  beforeEach(async () => {
    classifySymbol.mockReset();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SignalService,
        { provide: RegimeService, useValue: { classifySymbol } },
      ],
    }).compile();
    service = moduleRef.get(SignalService);
  });

  it('classifies a symbol then derives its signal', async () => {
    classifySymbol.mockResolvedValue(
      buildRegime({ primaryRegime: MarketRegime.TRENDING_BULLISH }),
    );

    const result = await service.getSignalForSymbol('SPY', 500);

    expect(classifySymbol).toHaveBeenCalledWith('SPY', 500);
    expect(result.symbol).toBe('SPY');
  });

  it('returns BULLISH when trend, EMAs, ADX and RSI align', () => {
    const result = service.generateSignal(
      'SPY',
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BULLISH,
        confidence: 0.9,
        secondaryCharacteristics: {
          trendDirection: 'BULLISH',
          trendStrength: 'STRONG',
        },
        features: {
          ...BULLISH_EMAS,
          adx: 32,
          plusDI: 30,
          minusDI: 14,
          rsi: 62,
        },
      }),
    );

    expect(result.signal).toBe(MarketSignal.BULLISH);
    expect(result.symbol).toBe('SPY');
    expect(result.scores.bullish).toBeGreaterThan(result.scores.bearish);
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.conflicts).toEqual([]);
    expect(result.confirmations).toContain('Market regime is TRENDING_BULLISH');
    expect(result.marketContext).toMatchObject({
      regime: MarketRegime.TRENDING_BULLISH,
      regimeConfidence: 0.9,
      trendDirection: 'BULLISH',
    });
  });

  it('returns BEARISH when trend, EMAs, ADX and RSI align downwards', () => {
    const result = service.generateSignal(
      'QQQ',
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BEARISH,
        confidence: 0.88,
        secondaryCharacteristics: {
          trendDirection: 'BEARISH',
          trendStrength: 'STRONG',
        },
        features: {
          ...BEARISH_EMAS,
          adx: 30,
          plusDI: 13,
          minusDI: 29,
          rsi: 38,
        },
      }),
    );

    expect(result.signal).toBe(MarketSignal.BEARISH);
    expect(result.scores.bearish).toBeGreaterThan(result.scores.bullish);
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.conflicts).toEqual([]);
  });

  it('returns NEUTRAL for a range-bound market', () => {
    const result = service.generateSignal(
      'IWM',
      buildRegime({
        primaryRegime: MarketRegime.RANGE_BOUND,
        features: { ...MIXED_EMAS, adx: 14, plusDI: 18, minusDI: 17, rsi: 51 },
      }),
    );

    expect(result.signal).toBe(MarketSignal.NEUTRAL);
    expect(result.confirmations).toEqual([]);
    expect(result.reasoning).toContain(
      'No direction reached the minimum directional score',
    );
  });

  it('returns NEUTRAL when ADX is weak and EMAs are mixed', () => {
    const result = service.generateSignal(
      'SPY',
      buildRegime({
        primaryRegime: MarketRegime.LOW_VOLATILITY,
        secondaryCharacteristics: { volatility: 'LOW' },
        features: { ...MIXED_EMAS, adx: 12, plusDI: 21, minusDI: 19, rsi: 53 },
      }),
    );

    expect(result.signal).toBe(MarketSignal.NEUTRAL);
    expect(result.scores.noTrade).toBeLessThan(4);
  });

  it('returns NO_TRADE when the regime conflicts with DI and RSI', () => {
    const result = service.generateSignal(
      'SPY',
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BULLISH,
        features: { ...MIXED_EMAS, adx: 26, plusDI: 15, minusDI: 28, rsi: 41 },
      }),
    );

    expect(result.signal).toBe(MarketSignal.NO_TRADE);
    expect(result.conflicts).toEqual([
      'Directional movement opposes the TRENDING_BULLISH regime',
      'RSI opposes the TRENDING_BULLISH regime',
      'Bullish and bearish directional scores are close',
    ]);
    expect(result.confirmations).toEqual([]);
  });

  it('returns NO_TRADE when volatility is high and direction is unclear', () => {
    const result = service.generateSignal(
      'NVDA',
      buildRegime({
        primaryRegime: MarketRegime.HIGH_VOLATILITY,
        secondaryCharacteristics: { volatility: 'HIGH' },
        features: { ...MIXED_EMAS, adx: 18, plusDI: 22, minusDI: 21, rsi: 52 },
      }),
    );

    expect(result.signal).toBe(MarketSignal.NO_TRADE);
    expect(result.riskFlags).toContain(
      'High volatility regime with no established direction',
    );
  });

  it('keeps a bullish bias but flags exhaustion at extreme RSI', () => {
    const result = service.generateSignal(
      'SPY',
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BULLISH,
        features: {
          ...BULLISH_EMAS,
          adx: 34,
          plusDI: 33,
          minusDI: 12,
          rsi: 78,
        },
      }),
    );

    expect(result.signal).toBe(MarketSignal.BULLISH);
    expect(result.riskFlags).toContain(
      'RSI is in overbought territory; exhaustion risk',
    );
  });

  it('keeps a bearish bias but flags reversal risk at extreme RSI', () => {
    const result = service.generateSignal(
      'SPY',
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BEARISH,
        features: {
          ...BEARISH_EMAS,
          adx: 33,
          plusDI: 11,
          minusDI: 31,
          rsi: 22,
        },
      }),
    );

    expect(result.signal).toBe(MarketSignal.BEARISH);
    expect(result.riskFlags).toContain(
      'RSI is in oversold territory; reversal risk',
    );
  });

  it('lowers confidence when regime confidence is low', () => {
    const features = {
      ...BULLISH_EMAS,
      adx: 32,
      plusDI: 30,
      minusDI: 14,
      rsi: 62,
    };
    const confident = service.generateSignal(
      'SPY',
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BULLISH,
        confidence: 0.9,
        features,
      }),
    );
    const unsure = service.generateSignal(
      'SPY',
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BULLISH,
        confidence: 0.55,
        features,
      }),
    );

    expect(unsure.signal).toBe(MarketSignal.BULLISH);
    expect(unsure.confidence).toBeLessThan(confident.confidence);
  });

  it('lowers confidence and flags risk when the classifier reported warnings', () => {
    const features = {
      ...BULLISH_EMAS,
      adx: 32,
      plusDI: 30,
      minusDI: 14,
      rsi: 62,
    };
    const clean = service.generateSignal(
      'SPY',
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BULLISH,
        features,
      }),
    );
    const flagged = service.generateSignal(
      'SPY',
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BULLISH,
        features,
        dataQuality: {
          candleCount: 80,
          sufficientData: false,
          warnings: ['Only 80 candles provided'],
        },
      }),
    );

    expect(flagged.confidence).toBeLessThan(clean.confidence);
    expect(flagged.riskFlags).toContain(
      'Classifier reported insufficient market data',
    );
  });

  it('refuses to trade a contested directional lead', () => {
    const result = service.generateSignal(
      'SPY',
      buildRegime({
        primaryRegime: MarketRegime.RANGE_BOUND,
        features: {
          ...BULLISH_EMAS,
          adx: 42,
          plusDI: 15,
          minusDI: 30,
          rsi: 62,
        },
      }),
    );

    expect(result.signal).toBe(MarketSignal.NO_TRADE);
    expect(result.conflicts).toContain(
      'Bullish and bearish directional scores are close',
    );
  });
  it('propagates session context and trade eligibility from the regime', () => {
    const result = service.generateSignal(
      'SPY',
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BULLISH,
        tradeEvaluationAllowed: false,
        riskFlags: ['Opening 15-minute settlement period active.'],
        sessionContext: {
          timezone: 'America/New_York',
          sessionDate: '2026-08-28',
          marketSession: MarketSession.OPENING_SETTLEMENT,
          sessionMaturity: SessionMaturity.SETTLING,
          timeframeMinutes: 3,
          currentSessionCandleCount: 3,
          indicatorCandleCount: 80,
          premarketCandleCount: 0,
          previousSessionWarmupCandleCount: 77,
          openingSettlementMinutes: 15,
          tradeEvaluationAllowed: false,
        },
      }),
    );

    expect(result.tradeEvaluationAllowed).toBe(false);
    expect(result.marketContext).toMatchObject({
      marketSession: MarketSession.OPENING_SETTLEMENT,
      sessionMaturity: SessionMaturity.SETTLING,
      timeframeMinutes: 3,
      currentSessionCandleCount: 3,
      indicatorCandleCount: 80,
    });
    expect(result.riskFlags).toContain(
      'Opening 15-minute settlement period active.',
    );
  });

  it('allows trade evaluation when the regime does not restrict it', () => {
    const result = service.generateSignal(
      'SPY',
      buildRegime({ primaryRegime: MarketRegime.TRENDING_BULLISH }),
    );

    expect(result.tradeEvaluationAllowed).toBe(true);
  });
});
