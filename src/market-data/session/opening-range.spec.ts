import { describe, expect, it } from 'vitest';
import {
  candleAt,
  candleSeries,
  easternInstant,
} from '../../../test/factories/session-candles.js';
import type { MarketCandle } from '../interfaces/market-candle.interface.js';
import { partitionSessionCandles } from './session-partition.js';
import type { MarketSessionSnapshot } from './session-context.interface.js';

const TIMEFRAME_MINUTES = 3;
const PREVIOUS_OPEN = easternInstant(2026, 8, 27, 9, 30);

/** Five candles spanning 09:30–09:45, one per three-minute slot. */
const OPENING_CANDLES: MarketCandle[] = [
  candleAt(at(9, 30), {
    open: 100,
    close: 100.4,
    high: 100.5,
    low: 99.8,
    volume: 1_000,
  }),
  candleAt(at(9, 33), {
    open: 100.4,
    close: 100.9,
    high: 101,
    low: 100.3,
    volume: 1_000,
  }),
  candleAt(at(9, 36), {
    open: 100.9,
    close: 100.2,
    high: 101.2,
    low: 100.1,
    volume: 1_000,
  }),
  candleAt(at(9, 39), {
    open: 100.2,
    close: 99.9,
    high: 100.3,
    low: 99.5,
    volume: 1_000,
  }),
  candleAt(at(9, 42), {
    open: 99.9,
    close: 100.6,
    high: 100.8,
    low: 99.7,
    volume: 1_000,
  }),
];

const OPENING_HIGH = 101.2;
const OPENING_LOW = 99.5;

function at(hour: number, minute: number): Date {
  return easternInstant(2026, 8, 28, hour, minute);
}

function warmup(): MarketCandle[] {
  return candleSeries(PREVIOUS_OPEN, 130, {
    timeframeMinutes: TIMEFRAME_MINUTES,
    startPrice: 100,
    step: 0,
  });
}

function snapshotOf(
  candles: MarketCandle[],
  now: Date,
  options: { breakoutTolerancePercent?: number } = {},
): MarketSessionSnapshot {
  return partitionSessionCandles([...warmup(), ...candles], {
    symbol: 'SPY',
    now,
    timeframeMinutes: TIMEFRAME_MINUTES,
    maxIndicatorCandles: 200,
    openingSettlementMinutes: 15,
    openingRangeMinutes: 15,
    openingRangeBreakoutTolerancePercent: options.breakoutTolerancePercent,
  });
}

/** Post-range candles that close progressively above the opening high. */
function breakoutCandles(volume = 3_000): MarketCandle[] {
  return [
    candleAt(at(9, 45), {
      open: 100.6,
      close: 101.5,
      high: 101.6,
      low: 100.5,
      volume,
    }),
    candleAt(at(9, 48), {
      open: 101.5,
      close: 102,
      high: 102.1,
      low: 101.4,
      volume,
    }),
  ];
}

describe('opening range', () => {
  it('is built from the five 09:30–09:45 candles', () => {
    const range = snapshotOf(OPENING_CANDLES, at(9, 45)).openingRange;

    expect(range.available).toBe(true);
    expect(range.startTime).toBe('09:30');
    expect(range.endTime).toBe('09:45');
    expect(range.candleCount).toBe(5);
    expect(range.expectedCandleCount).toBe(5);
  });

  it('excludes premarket candles from the range', () => {
    const premarket = [
      candleAt(at(9, 0), {
        open: 98,
        close: 98.5,
        high: 105,
        low: 90,
        volume: 500,
      }),
    ];
    const snapshot = snapshotOf([...premarket, ...OPENING_CANDLES], at(9, 45));

    expect(snapshot.openingRange.candleCount).toBe(5);
    expect(snapshot.openingRange.high).toBe(OPENING_HIGH);
    expect(snapshot.openingRange.low).toBe(OPENING_LOW);
    expect(snapshot.premarket.high).toBe(105);
  });

  it('excludes the 09:45 candle from the range', () => {
    const range = snapshotOf(
      [
        ...OPENING_CANDLES,
        candleAt(at(9, 45), {
          open: 100.6,
          close: 103,
          high: 103.5,
          low: 100.5,
        }),
      ],
      at(9, 48),
    ).openingRange;

    expect(range.candleCount).toBe(5);
    expect(range.high).toBe(OPENING_HIGH);
    expect(range.close).toBe(100.6);
    expect(range.postRangeCandleCount).toBe(1);
  });

  it('takes open, close, high, low and volume from the window', () => {
    const range = snapshotOf(OPENING_CANDLES, at(9, 45)).openingRange;

    expect(range.open).toBe(100);
    expect(range.close).toBe(100.6);
    expect(range.high).toBe(OPENING_HIGH);
    expect(range.low).toBe(OPENING_LOW);
    expect(range.volume).toBe(5_000);
  });

  it('derives range and rangePercent from the window levels', () => {
    const range = snapshotOf(OPENING_CANDLES, at(9, 45)).openingRange;

    expect(range.range).toBeCloseTo(OPENING_HIGH - OPENING_LOW, 4);
    expect(range.rangePercent).toBeCloseTo(
      ((OPENING_HIGH - OPENING_LOW) / 100) * 100,
      3,
    );
  });

  it('is FORMING before 09:45 and never claims a final range', () => {
    const snapshot = snapshotOf(OPENING_CANDLES.slice(0, 3), at(9, 40));

    expect(snapshot.openingRange.status).toBe('FORMING');
    expect(snapshot.openingRange.candleCount).toBe(3);
    expect(snapshot.openingRange.currentPricePosition).toBe('UNKNOWN');
    expect(snapshot.openingRange.breakoutAbove).toBe(false);
    expect(snapshot.context.tradeEvaluationAllowed).toBe(false);
  });

  it('is COMPLETE once the window has elapsed', () => {
    expect(snapshotOf(OPENING_CANDLES, at(9, 45)).openingRange.status).toBe(
      'COMPLETE',
    );
  });

  it('keeps the levels fixed while session high and low keep moving', () => {
    const later = [
      ...OPENING_CANDLES,
      ...breakoutCandles(),
      candleAt(at(10, 27), {
        open: 102,
        close: 104,
        high: 104.5,
        low: 101.9,
        volume: 2_000,
      }),
    ];
    const snapshot = snapshotOf(later, at(10, 30));

    expect(snapshot.openingRange.high).toBe(OPENING_HIGH);
    expect(snapshot.openingRange.low).toBe(OPENING_LOW);
    expect(snapshot.currentSessionFeatures.high).toBe(104.5);
    expect(snapshot.currentSessionFeatures.low).toBe(OPENING_LOW);
  });

  it('confirms a breakout from a completed close above the high', () => {
    const range = snapshotOf(
      [...OPENING_CANDLES, ...breakoutCandles()],
      at(9, 51),
    ).openingRange;

    expect(range.currentPricePosition).toBe('ABOVE');
    expect(range.breakoutAbove).toBe(true);
    expect(range.closesAboveHigh).toBe(2);
    expect(range.breakoutStrength).not.toBe('NONE');
  });

  it('does not treat a wick above the high as a confirmed breakout', () => {
    const range = snapshotOf(
      [
        ...OPENING_CANDLES,
        candleAt(at(9, 45), {
          open: 100.6,
          close: 100.7,
          high: 102,
          low: 100.5,
          volume: 3_000,
        }),
      ],
      at(9, 48),
    ).openingRange;

    expect(range.breakoutAbove).toBe(false);
    expect(range.closesAboveHigh).toBe(0);
    expect(range.currentPricePosition).toBe('INSIDE');
    expect(range.failedBreakoutAbove).toBe(true);
  });

  it('confirms a breakdown from a completed close below the low', () => {
    const range = snapshotOf(
      [
        ...OPENING_CANDLES,
        candleAt(at(9, 45), {
          open: 100.6,
          close: 99,
          high: 100.7,
          low: 98.9,
          volume: 3_000,
        }),
      ],
      at(9, 48),
    ).openingRange;

    expect(range.breakdownBelow).toBe(true);
    expect(range.currentPricePosition).toBe('BELOW');
    expect(range.closesBelowLow).toBe(1);
    expect(range.failedBreakdownBelow).toBe(false);
  });

  it('recognises a rejected breakdown back into the range', () => {
    const range = snapshotOf(
      [
        ...OPENING_CANDLES,
        candleAt(at(9, 45), {
          open: 100.6,
          close: 100.2,
          high: 100.7,
          low: 98.9,
          volume: 3_000,
        }),
      ],
      at(9, 48),
    ).openingRange;

    expect(range.breakdownBelow).toBe(false);
    expect(range.failedBreakdownBelow).toBe(true);
    expect(range.currentPricePosition).toBe('INSIDE');
  });

  it('ignores a move inside the breakout tolerance', () => {
    const barelyAbove = OPENING_HIGH * 1.0001;
    const range = snapshotOf(
      [
        ...OPENING_CANDLES,
        candleAt(at(9, 45), {
          open: 100.6,
          close: barelyAbove,
          high: barelyAbove,
          low: 100.5,
          volume: 3_000,
        }),
      ],
      at(9, 48),
      { breakoutTolerancePercent: 0.05 },
    ).openingRange;

    expect(range.breakoutAbove).toBe(false);
    expect(range.currentPricePosition).toBe('INSIDE');
  });

  it('marks volume confirmation from breakout participation', () => {
    const heavy = snapshotOf(
      [...OPENING_CANDLES, ...breakoutCandles(3_000)],
      at(9, 51),
    ).openingRange;
    const light = snapshotOf(
      [...OPENING_CANDLES, ...breakoutCandles(200)],
      at(9, 51),
    ).openingRange;

    expect(heavy.volumeConfirmation).toBe('CONFIRMED');
    expect(heavy.relativeBreakoutVolume).toBeGreaterThan(1);
    expect(light.volumeConfirmation).toBe('NOT_CONFIRMED');
  });

  it('classifies price that stays inside the range', () => {
    const range = snapshotOf(
      [
        ...OPENING_CANDLES,
        candleAt(at(9, 45), {
          open: 100.6,
          close: 100.5,
          high: 100.8,
          low: 100.2,
          volume: 1_000,
        }),
      ],
      at(9, 48),
    ).openingRange;

    expect(range.currentPricePosition).toBe('INSIDE');
    expect(range.breakoutAbove).toBe(false);
    expect(range.breakdownBelow).toBe(false);
    expect(range.breakoutStrength).toBe('NONE');
  });

  it('keeps premarket levels independent of the opening range', () => {
    const snapshot = snapshotOf(
      [
        candleAt(at(8, 0), {
          open: 99,
          close: 102,
          high: 103,
          low: 98.5,
          volume: 400,
        }),
        ...OPENING_CANDLES,
      ],
      at(9, 45),
    );

    expect(snapshot.premarket.high).toBe(103);
    expect(snapshot.openingRange.high).toBe(OPENING_HIGH);
    expect(snapshot.premarket.high).not.toBe(snapshot.openingRange.high);
  });

  it('never looks ahead of the evaluation instant', () => {
    const full = [
      ...OPENING_CANDLES,
      ...breakoutCandles(),
      candleAt(at(11, 0), {
        open: 102,
        close: 110,
        high: 111,
        low: 101,
        volume: 9_000,
      }),
    ];
    const asOf0951 = snapshotOf(full, at(9, 51)).openingRange;

    expect(asOf0951.high).toBe(OPENING_HIGH);
    expect(asOf0951.postRangeCandleCount).toBe(2);
    expect(asOf0951.currentPrice).toBe(102);
  });

  it('reports UNAVAILABLE when the session produced no opening candles', () => {
    const range = snapshotOf(
      [
        candleAt(at(9, 0), {
          open: 99,
          close: 99.5,
          high: 100,
          low: 98,
          volume: 100,
        }),
      ],
      at(11, 0),
    ).openingRange;

    expect(range.available).toBe(false);
    expect(range.status).toBe('UNAVAILABLE');
    expect(range.high).toBeNull();
  });
});
