import {
  filterRegularSession,
  normalizeAggregates,
} from './candle-normalizer.js';

describe('filterRegularSession', () => {
  const candleAt = (iso: string) => ({
    timestamp: new Date(iso),
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 1,
  });

  it('keeps only 09:30-16:00 ET bars on weekdays', () => {
    const kept = filterRegularSession([
      candleAt('2026-08-28T12:00:00Z'), // 08:00 ET pre-market
      candleAt('2026-08-28T13:30:00Z'), // 09:30 ET open
      candleAt('2026-08-28T19:59:00Z'), // 15:59 ET last bar
      candleAt('2026-08-28T20:00:00Z'), // 16:00 ET close
      candleAt('2026-08-29T14:00:00Z'), // Saturday
    ]);

    expect(kept.map((candle) => candle.timestamp.toISOString())).toEqual([
      '2026-08-28T13:30:00.000Z',
      '2026-08-28T19:59:00.000Z',
    ]);
  });
});

describe('normalizeAggregates', () => {
  it('reports rejected and duplicate counts', () => {
    const base = { o: 1, h: 2, l: 0.5, c: 1.5, v: 10 };

    const result = normalizeAggregates([
      { ...base, t: 2_000 },
      { ...base, t: 1_000 },
      { ...base, t: 1_000 },
      { ...base, t: 3_000, h: -1 },
      'garbage',
    ]);

    expect(result.candles.map((candle) => candle.timestamp.getTime())).toEqual([
      1_000, 2_000,
    ]);
    expect(result.rejected).toBe(2);
    expect(result.duplicates).toBe(1);
  });

  it('accepts index bars, which are quoted without volume', () => {
    const result = normalizeAggregates([
      { o: 18.1, h: 18.4, l: 18, c: 18.3, t: 1_000 },
    ]);

    expect(result.rejected).toBe(0);
    expect(result.candles[0].volume).toBe(0);
    expect(result.candles[0].close).toBe(18.3);
  });
});
