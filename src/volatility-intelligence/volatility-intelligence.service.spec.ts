import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  buildSeriesSnapshot,
  buildSessionSnapshot,
  SESSION_OPEN,
} from '../../test/factories/session-snapshot.js';
import { easternInstant } from '../../test/factories/session-candles.js';
import type { MarketSessionConfig } from '../market-data/market-data.config.js';
import { MarketDataService } from '../market-data/market-data.service.js';
import { MarketSession } from '../market-data/session/market-session.enum.js';
import type { MarketSessionSnapshot } from '../market-data/session/session-context.interface.js';
import { MarketSignal } from '../signal/enums/market-signal.enum.js';
import type { SignalResult } from '../signal/interfaces/signal-result.interface.js';
import { SignalService } from '../signal/signal.service.js';
import {
  VolatilityMomentum,
  VolatilityRelationship,
  VolatilityState,
  VolatilityTrend,
} from './enums/volatility.enum.js';
import {
  VOLATILITY_CONFIG_KEY,
  type VolatilityConfig,
} from './volatility-intelligence.config.js';
import { VolatilityIntelligenceService } from './volatility-intelligence.service.js';

const VIX_SYMBOL = 'I:VIX';

const volatilityConfig: VolatilityConfig = {
  vixSymbol: VIX_SYMBOL,
  momentumLookbackCandles: 3,
  maxStalenessMinutes: 6,
};

const sessionConfig: MarketSessionConfig = {
  primaryTimeframeMinutes: 3,
  maxIndicatorCandles: 80,
  openingSettlementMinutes: 15,
};

function signalFor(snapshot: MarketSessionSnapshot): SignalResult {
  return {
    symbol: snapshot.symbol,
    timestamp: snapshot.asOf,
    signal: MarketSignal.BULLISH,
    confidence: 0.7,
    tradeEvaluationAllowed: snapshot.context.tradeEvaluationAllowed,
    scores: { bullish: 6, bearish: 1, noTrade: 0 },
    confirmations: [],
    conflicts: [],
    reasoning: [],
    marketContext: {
      regime: 'TRENDING_BULLISH' as SignalResult['marketContext']['regime'],
      regimeConfidence: 0.7,
      trendDirection:
        'BULLISH' as SignalResult['marketContext']['trendDirection'],
      trendStrength: 'STRONG' as SignalResult['marketContext']['trendStrength'],
      volatility: 'NORMAL' as SignalResult['marketContext']['volatility'],
    },
    riskFlags: [],
  };
}

/** Walks every nested number of a result and asserts it is usable. */
function everyNumber(value: unknown, visit: (value: number) => void): void {
  if (typeof value === 'number') {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => everyNumber(entry, visit));
    return;
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    Object.values(value).forEach((entry) => everyNumber(entry, visit));
  }
}

describe('VolatilityIntelligenceService', () => {
  let service: VolatilityIntelligenceService;
  const getSessionSnapshot = vi.fn();

  const vixSnapshot = (
    currentCloses: number[],
    previousLevel: number,
    now?: Date,
  ): MarketSessionSnapshot =>
    buildSeriesSnapshot({
      symbol: VIX_SYMBOL,
      currentCloses,
      previousLevel,
      now,
    });

  /** Underlying is fetched first, the volatility reference second. */
  function respondWith(
    underlying: MarketSessionSnapshot,
    vix: MarketSessionSnapshot | Error,
  ): void {
    getSessionSnapshot.mockImplementation((symbol: string) => {
      if (symbol === VIX_SYMBOL) {
        return vix instanceof Error
          ? Promise.reject(vix)
          : Promise.resolve(vix);
      }
      return Promise.resolve(underlying);
    });
  }

  beforeEach(async () => {
    getSessionSnapshot.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolatilityIntelligenceService,
        { provide: MarketDataService, useValue: { getSessionSnapshot } },
        {
          provide: SignalService,
          useValue: {
            getSignalForSession: vi.fn(
              (_symbol: string, snapshot: MarketSessionSnapshot) =>
                signalFor(snapshot),
            ),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) =>
              key === VOLATILITY_CONFIG_KEY ? volatilityConfig : sessionConfig,
          },
        },
      ],
    }).compile();

    service = module.get(VolatilityIntelligenceService);
  });

  it('retrieves the volatility reference under the configured index symbol', async () => {
    const now = easternInstant(2026, 8, 28, 11, 0);
    respondWith(
      buildSessionSnapshot({ atHour: 11 }),
      vixSnapshot([18, 18.2, 18.5, 18.9, 19.3, 19.8], 18, now),
    );

    const result = await service.analyze('spy', { now });

    expect(getSessionSnapshot).toHaveBeenCalledWith('SPY', { now });
    expect(getSessionSnapshot).toHaveBeenCalledWith(VIX_SYMBOL, { now });
    expect(result.volatilitySymbol).toBe(VIX_SYMBOL);
    expect(result.symbol).toBe('SPY');
    expect(result.vix.available).toBe(true);
  });

  it('degrades safely when the provider has no VIX data', async () => {
    respondWith(
      buildSessionSnapshot(),
      new ServiceUnavailableException('Market data provider is unreachable.'),
    );

    const result = await service.analyze('SPY');

    expect(result.vix.available).toBe(false);
    expect(result.volatilityState).toBe(VolatilityState.UNKNOWN);
    expect(result.volatilityTrend).toBe(VolatilityTrend.UNKNOWN);
    expect(result.volatilityMomentum).toBe(VolatilityMomentum.UNKNOWN);
    expect(result.relationship).toBe(VolatilityRelationship.UNKNOWN);
    expect(result.confidence).toBe(0);
    expect(result.volatilityPressureScore).toBe(0);
    expect(result.riskFlags).toContain(
      'VIX data is unavailable from the market data provider',
    );
  });

  it('still reports observations during the opening settlement period', async () => {
    const now = easternInstant(2026, 8, 28, 9, 42);
    respondWith(
      buildSessionSnapshot({ atHour: 9, atMinute: 42, currentCandles: 4 }),
      vixSnapshot([18, 18.2, 18.5, 18.9], 18, now),
    );

    const result = await service.analyze('SPY', { now });

    expect(result.sessionContext.marketSession).toBe(
      MarketSession.OPENING_SETTLEMENT,
    );
    expect(result.tradeEvaluationAllowed).toBe(false);
    expect(result.riskFlags).toContain('Opening settlement period active');
    expect(result.vix.current).not.toBeNull();
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it('handles a closed market without pretending the data is live', async () => {
    const now = easternInstant(2026, 8, 28, 20, 30);
    respondWith(
      buildSessionSnapshot({ atHour: 20, atMinute: 30 }),
      vixSnapshot([18, 18.1, 18.2, 18.3], 18, now),
    );

    const result = await service.analyze('SPY', { now });

    expect(result.sessionContext.marketSession).toBe(MarketSession.CLOSED);
    expect(result.tradeEvaluationAllowed).toBe(false);
  });

  it('flags stale and misaligned VIX data', async () => {
    const now = easternInstant(2026, 8, 28, 11, 0);
    respondWith(
      buildSessionSnapshot({ atHour: 11 }),
      vixSnapshot(
        [18, 18.1, 18.2, 18.3],
        18,
        new Date(SESSION_OPEN.getTime() + 4 * 3 * 60_000),
      ),
    );

    const result = await service.analyze('SPY', { now });

    expect(result.riskFlags).toContain(
      'VIX data is stale relative to underlying market data',
    );
    expect(result.riskFlags).toContain(
      'VIX and underlying timestamps are misaligned',
    );
  });

  it('lowers confidence when the VIX session history is thin', async () => {
    const now = easternInstant(2026, 8, 28, 11, 0);
    const rich = [18, 18.2, 18.5, 18.9, 19.3, 19.8, 20.2, 20.6];

    respondWith(
      buildSessionSnapshot({ atHour: 11 }),
      vixSnapshot(rich, 18, now),
    );
    const established = await service.analyze('SPY', { now });

    respondWith(
      buildSessionSnapshot({ atHour: 11 }),
      vixSnapshot(rich.slice(0, 2), 18, now),
    );
    const thin = await service.analyze('SPY', { now });

    expect(thin.confidence).toBeLessThan(established.confidence);
    expect(thin.riskFlags).toContain('Insufficient current-session VIX data');
  });

  it('never emits NaN, Infinity or an out-of-range confidence', async () => {
    const now = easternInstant(2026, 8, 28, 11, 0);
    respondWith(
      buildSessionSnapshot({ atHour: 11 }),
      vixSnapshot([18, 18.2, 18.5, 18.9, 19.3, 19.8], 18, now),
    );

    const result = await service.analyze('SPY', { now });

    everyNumber(result, (value) => {
      expect(Number.isFinite(value)).toBe(true);
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('reports the signal without overwriting it', async () => {
    const now = easternInstant(2026, 8, 28, 11, 0);
    respondWith(
      buildSessionSnapshot({ atHour: 11 }),
      vixSnapshot([18, 18.2, 18.5, 18.9, 19.3, 19.8], 18, now),
    );

    const result = await service.analyze('SPY', { now });

    expect(result.signal).toBe(MarketSignal.BULLISH);
  });
});
