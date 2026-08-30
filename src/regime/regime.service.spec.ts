import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { MarketRegime } from './enums/market-regime.enum.js';
import { InsufficientMarketDataException } from './errors/insufficient-market-data.exception.js';
import { IndicatorService } from './indicators/indicator.service.js';
import { RegimeService } from './regime.service.js';
import { buildCandles } from './testing/candle-factory.js';
import type { MarketCandle } from './interfaces/market-data.interface.js';

const CANDLE_COUNT = 150;

function bullishCandles(): MarketCandle[] {
  return buildCandles(CANDLE_COUNT, {
    close: (index) => 100 * 1.004 ** index,
    range: () => 0.003,
  });
}

function bearishCandles(): MarketCandle[] {
  return buildCandles(CANDLE_COUNT, {
    close: (index) => 300 * 0.996 ** index,
    range: () => 0.003,
  });
}

function rangeBoundCandles(): MarketCandle[] {
  return buildCandles(CANDLE_COUNT, {
    close: (index) => 100 + Math.sin(index / 2.5) * 0.6,
    range: () => 0.002,
  });
}

function highVolatilityCandles(): MarketCandle[] {
  return buildCandles(CANDLE_COUNT, {
    close: (index) =>
      index < 120
        ? 100 + Math.sin(index / 3) * 0.5
        : 100 + Math.sin(index / 1.5) * 6,
    range: (index) => (index < 120 ? 0.002 : 0.05),
    volume: (index) => (index < 140 ? 1_000_000 : 4_000_000),
  });
}

function lowVolatilityCandles(): MarketCandle[] {
  return buildCandles(CANDLE_COUNT, {
    close: (index) =>
      index < 120
        ? 100 + Math.sin(index / 3) * 3
        : 100 + Math.sin(index / 3) * 0.05,
    range: (index) => (index < 120 ? 0.02 : 0.0005),
    volume: (index) => (index < 140 ? 2_000_000 : 700_000),
  });
}

/** Overlapping swings: trend and range signals fire against each other. */
function conflictingCandles(): MarketCandle[] {
  return buildCandles(CANDLE_COUNT, {
    close: (index) => 100 + Math.sin(index / 7) * 5 + Math.sin(index / 2) * 1.5,
    range: () => 0.008,
    volume: (index) => 1_000_000 + (index % 7) * 50_000,
  });
}

describe('RegimeService', () => {
  let service: RegimeService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [IndicatorService, RegimeService],
    }).compile();

    service = moduleRef.get(RegimeService);
  });

  it('classifies a strong uptrend as TRENDING_BULLISH', async () => {
    const result = await service.classify('SPY', bullishCandles());

    expect(result.primaryRegime).toBe(MarketRegime.TRENDING_BULLISH);
    expect(result.secondaryCharacteristics.trendDirection).toBe('BULLISH');
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.features.ema9).toBeGreaterThan(result.features.ema21 ?? 0);
    expect(result.reasoning.length).toBeGreaterThan(1);
    expect(result.dataQuality.sufficientData).toBe(true);
  });

  it('classifies a strong downtrend as TRENDING_BEARISH', async () => {
    const result = await service.classify('QQQ', bearishCandles());

    expect(result.primaryRegime).toBe(MarketRegime.TRENDING_BEARISH);
    expect(result.secondaryCharacteristics.trendDirection).toBe('BEARISH');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('classifies an oscillating market as RANGE_BOUND', async () => {
    const result = await service.classify('IWM', rangeBoundCandles());

    expect(result.primaryRegime).toBe(MarketRegime.RANGE_BOUND);
    expect(result.scores[MarketRegime.TRENDING_BULLISH]).toBeLessThan(
      result.scores[MarketRegime.RANGE_BOUND],
    );
  });

  it('classifies an expanding, high-ATR market as HIGH_VOLATILITY', async () => {
    const result = await service.classify('TSLA', highVolatilityCandles());

    expect(result.primaryRegime).toBe(MarketRegime.HIGH_VOLATILITY);
    expect(result.secondaryCharacteristics.volatility).toBe('HIGH');
  });

  it('classifies a compressed market as LOW_VOLATILITY', async () => {
    const result = await service.classify('KO', lowVolatilityCandles());

    expect(result.primaryRegime).toBe(MarketRegime.LOW_VOLATILITY);
    expect(result.secondaryCharacteristics.volatility).toBe('LOW');
  });

  it('keeps a strong trend primary when volatility is also elevated', async () => {
    const result = await service.classify(
      'NVDA',
      buildCandles(CANDLE_COUNT, {
        close: (index) => 100 * 1.006 ** index,
        range: (index) => (index < 120 ? 0.004 : 0.03),
        volume: (index) => (index < 120 ? 1_000_000 : 3_000_000),
      }),
    );

    expect(result.primaryRegime).toBe(MarketRegime.TRENDING_BULLISH);
    expect(result.secondaryCharacteristics.volatility).toBe('HIGH');
    expect(result.scores[MarketRegime.HIGH_VOLATILITY]).toBeGreaterThan(0);
  });

  it('rejects insufficient history instead of guessing', async () => {
    const candles = buildCandles(30, { close: (index) => 100 + index });

    await expect(service.classify('SPY', candles)).rejects.toBeInstanceOf(
      InsufficientMarketDataException,
    );
  });

  it('sorts unsorted candles and reports it as a data-quality warning', async () => {
    const sorted = bullishCandles();
    const shuffled = [...sorted.slice(50), ...sorted.slice(0, 50)];

    const fromSorted = await service.classify('SPY', sorted);
    const fromShuffled = await service.classify('SPY', shuffled);

    expect(fromShuffled.primaryRegime).toBe(fromSorted.primaryRegime);
    expect(fromShuffled.features).toEqual(fromSorted.features);
    expect(fromShuffled.dataQuality.warnings).toContain(
      'Candles were not chronologically ordered and were sorted.',
    );
  });

  it('rejects malformed candle values', async () => {
    const withNaN = bullishCandles();
    withNaN[10] = { ...withNaN[10], close: Number.NaN };
    const withBadRange = bullishCandles();
    withBadRange[10] = { ...withBadRange[10], high: 1, low: 500 };
    const withNegativeVolume = bullishCandles();
    withNegativeVolume[10] = { ...withNegativeVolume[10], volume: -5 };

    await expect(service.classify('SPY', withNaN)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.classify('SPY', withBadRange)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.classify('SPY', withNegativeVolume),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.classify('SPY', [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reports low confidence when indicators conflict', async () => {
    const conflicted = await service.classify('AMD', conflictingCandles());
    const trending = await service.classify('SPY', bullishCandles());

    const [topScore, runnerUp] = Object.values(conflicted.scores).sort(
      (left, right) => right - left,
    );

    expect(topScore - runnerUp).toBeLessThan(1);
    expect(conflicted.confidence).toBeLessThan(0.5);
    expect(conflicted.confidence).toBeLessThan(trending.confidence);
  });

  it('tolerates zero-volume candles', async () => {
    const result = await service.classify(
      'SPY',
      buildCandles(CANDLE_COUNT, {
        close: (index) => 100 * 1.004 ** index,
        volume: () => 0,
      }),
    );

    expect(result.features.relativeVolume).toBeUndefined();
    expect(result.dataQuality.warnings.length).toBeGreaterThan(0);
  });
});
