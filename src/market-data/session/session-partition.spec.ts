import {
  candleAt,
  candleSeries,
  easternInstant,
  EST_OFFSET_HOURS,
} from '../../../test/factories/session-candles.js';
import type { MarketCandle } from '../interfaces/market-candle.interface.js';
import { MarketSession, SessionMaturity } from './market-session.enum.js';
import { resolveMarketSession } from './session-clock.js';
import { partitionSessionCandles } from './session-partition.js';

const TIMEFRAME = 3;

/** Thursday 2026-08-27 and Friday 2026-08-28, both EDT. */
const PREVIOUS_SESSION_OPEN = easternInstant(2026, 8, 27, 9, 30);
const SESSION_OPEN = easternInstant(2026, 8, 28, 9, 30);

function partition(
  candles: MarketCandle[],
  now: Date,
  overrides: {
    maxIndicatorCandles?: number;
    openingSettlementMinutes?: number;
  } = {},
) {
  return partitionSessionCandles(candles, {
    symbol: 'SPY',
    now,
    timeframeMinutes: TIMEFRAME,
    maxIndicatorCandles: overrides.maxIndicatorCandles ?? 80,
    openingSettlementMinutes: overrides.openingSettlementMinutes ?? 15,
  });
}

/** A full previous regular session: 130 completed 3-minute candles. */
function previousSession(step = 0.02): MarketCandle[] {
  return candleSeries(PREVIOUS_SESSION_OPEN, 130, {
    timeframeMinutes: TIMEFRAME,
    startPrice: 100,
    step,
  });
}

describe('session partitioning', () => {
  it('treats a candle whose interval has elapsed as completed and excludes the forming one', () => {
    const candles = [
      ...previousSession(),
      ...candleSeries(SESSION_OPEN, 6, {
        timeframeMinutes: TIMEFRAME,
        startPrice: 110,
        step: 0.1,
      }),
    ];

    const atOpenPlus15 = partition(candles, easternInstant(2026, 8, 28, 9, 45));
    expect(atOpenPlus15.context.currentSessionCandleCount).toBe(5);
    expect(
      atOpenPlus15.warnings.some((warning) =>
        warning.includes('still-forming'),
      ),
    ).toBe(true);

    const atOpenPlus18 = partition(candles, easternInstant(2026, 8, 28, 9, 48));
    expect(atOpenPlus18.context.currentSessionCandleCount).toBe(6);
  });

  it('evaluates five completed candles at 09:45 without waiting for a full indicator window', () => {
    const snapshot = partition(
      [
        ...previousSession(),
        ...candleSeries(SESSION_OPEN, 5, {
          timeframeMinutes: TIMEFRAME,
          startPrice: 110,
          step: 0.1,
        }),
      ],
      easternInstant(2026, 8, 28, 9, 45),
    );

    expect(snapshot.context.currentSessionCandleCount).toBe(5);
    expect(snapshot.context.indicatorCandleCount).toBe(80);
    expect(snapshot.context.previousSessionWarmupCandleCount).toBe(75);
    expect(snapshot.context.sessionMaturity).toBe(SessionMaturity.EARLY);
    expect(snapshot.context.tradeEvaluationAllowed).toBe(true);
  });

  it('caps indicator history at the configured maximum instead of requiring it', () => {
    const snapshot = partition(
      [
        ...previousSession(),
        ...candleSeries(SESSION_OPEN, 5, { timeframeMinutes: TIMEFRAME }),
      ],
      easternInstant(2026, 8, 28, 9, 45),
      { maxIndicatorCandles: 40 },
    );

    expect(snapshot.context.indicatorCandleCount).toBe(40);
    expect(snapshot.context.currentSessionCandleCount).toBe(5);
  });

  it('keeps premarket candles out of the indicator and current-session sets', () => {
    const premarket = candleSeries(easternInstant(2026, 8, 28, 7, 0), 10, {
      timeframeMinutes: TIMEFRAME,
      startPrice: 108,
      step: -0.05,
    });
    const snapshot = partition(
      [
        ...previousSession(),
        ...premarket,
        ...candleSeries(SESSION_OPEN, 5, {
          timeframeMinutes: TIMEFRAME,
          startPrice: 110,
        }),
      ],
      easternInstant(2026, 8, 28, 9, 45),
    );

    expect(snapshot.premarketCandles).toHaveLength(10);
    expect(snapshot.context.premarketCandleCount).toBe(10);
    expect(snapshot.currentSessionCandles).toHaveLength(5);
    expect(
      snapshot.indicatorCandles.some((candle) =>
        premarket.some(
          (pm) => pm.timestamp.getTime() === candle.timestamp.getTime(),
        ),
      ),
    ).toBe(false);
  });

  it('excludes after-hours candles from regular-session evidence', () => {
    const afterHours = candleSeries(easternInstant(2026, 8, 28, 16, 30), 8, {
      timeframeMinutes: TIMEFRAME,
      startPrice: 120,
    });
    const snapshot = partition(
      [
        ...previousSession(),
        ...candleSeries(SESSION_OPEN, 20, { timeframeMinutes: TIMEFRAME }),
        ...afterHours,
      ],
      easternInstant(2026, 8, 28, 17, 0),
    );

    expect(snapshot.context.currentSessionCandleCount).toBe(20);
    expect(
      snapshot.indicatorCandles.some(
        (candle) =>
          candle.timestamp.getTime() >= afterHours[0].timestamp.getTime(),
      ),
    ).toBe(false);
    expect(
      snapshot.warnings.some((warning) => warning.includes('after-hours')),
    ).toBe(true);
  });

  it('uses previous regular-session candles for indicator warm-up', () => {
    const snapshot = partition(
      [
        ...previousSession(),
        ...candleSeries(SESSION_OPEN, 3, { timeframeMinutes: TIMEFRAME }),
      ],
      easternInstant(2026, 8, 28, 9, 39),
    );

    expect(snapshot.context.previousSessionWarmupCandleCount).toBe(77);
    expect(snapshot.indicatorCandles).toHaveLength(80);
    expect(snapshot.previousSession.available).toBe(true);
    expect(snapshot.previousSession.date).toBe('2026-08-27');
  });

  it('identifies Friday as the previous session on a Monday', () => {
    const friday = candleSeries(easternInstant(2026, 8, 28, 9, 30), 130, {
      timeframeMinutes: TIMEFRAME,
      startPrice: 100,
      step: 0.02,
    });
    const monday = candleSeries(easternInstant(2026, 8, 31, 9, 30), 5, {
      timeframeMinutes: TIMEFRAME,
      startPrice: 110,
    });

    const snapshot = partition(
      [...friday, ...monday],
      easternInstant(2026, 8, 31, 9, 45),
    );

    expect(snapshot.previousSession.date).toBe('2026-08-28');
    expect(snapshot.context.sessionDate).toBe('2026-08-31');
  });

  it('falls back to the most recent available session across a holiday gap', () => {
    // 2026-07-03 is the observed Independence Day holiday; nothing trades.
    const wednesday = candleSeries(easternInstant(2026, 7, 1, 9, 30), 130, {
      timeframeMinutes: TIMEFRAME,
      startPrice: 100,
      step: 0.02,
    });
    const thursday = candleSeries(easternInstant(2026, 7, 2, 9, 30), 10, {
      timeframeMinutes: TIMEFRAME,
      startPrice: 105,
    });

    const snapshot = partition(
      [...wednesday, ...thursday],
      easternInstant(2026, 7, 6, 10, 0),
    );

    expect(snapshot.context.sessionDate).toBe('2026-07-02');
    expect(snapshot.previousSession.date).toBe('2026-07-01');
    expect(snapshot.context.tradeEvaluationAllowed).toBe(false);
  });

  it('resolves session boundaries in New York across DST changes', () => {
    // 14:00 UTC is 10:00 EDT in August but 09:00 EST in January.
    const august = easternInstant(2026, 8, 28, 10, 0);
    const januaryOpen = easternInstant(2026, 1, 8, 10, 0, EST_OFFSET_HOURS);

    expect(resolveMarketSession(august, 15)).toBe(MarketSession.REGULAR);
    expect(resolveMarketSession(januaryOpen, 15)).toBe(MarketSession.REGULAR);
    expect(august.getTime()).not.toBe(januaryOpen.getTime());

    const januaryPremarket = easternInstant(2026, 1, 8, 9, 0, EST_OFFSET_HOURS);
    expect(resolveMarketSession(januaryPremarket, 15)).toBe(
      MarketSession.PREMARKET,
    );

    const winterCandles = [
      ...candleSeries(
        easternInstant(2026, 1, 7, 9, 30, EST_OFFSET_HOURS),
        130,
        {
          timeframeMinutes: TIMEFRAME,
          startPrice: 100,
          step: 0.02,
        },
      ),
      ...candleSeries(easternInstant(2026, 1, 8, 9, 30, EST_OFFSET_HOURS), 5, {
        timeframeMinutes: TIMEFRAME,
        startPrice: 110,
      }),
    ];
    const snapshot = partition(
      winterCandles,
      easternInstant(2026, 1, 8, 9, 45, EST_OFFSET_HOURS),
    );
    expect(snapshot.context.currentSessionCandleCount).toBe(5);
  });

  it('computes a negative premarket gap, range and bearish trend', () => {
    const previous = previousSession();
    const previousClose = previous[previous.length - 1].close;
    const premarketStart = previousClose * 0.99;
    const premarket = candleSeries(easternInstant(2026, 8, 28, 8, 0), 10, {
      timeframeMinutes: TIMEFRAME,
      startPrice: premarketStart,
      step: -0.05,
    });

    const snapshot = partition(
      [...previous, ...premarket],
      easternInstant(2026, 8, 28, 9, 29),
    );

    expect(snapshot.context.marketSession).toBe(MarketSession.PREMARKET);
    expect(snapshot.premarket.available).toBe(true);
    expect(snapshot.premarket.gapPercentFromPreviousClose).toBeLessThan(0);
    expect(snapshot.premarket.trendDirection).toBe('BEARISH');
    expect(snapshot.premarket.high).toBeGreaterThan(
      snapshot.premarket.low ?? 0,
    );
    expect(snapshot.premarket.range).toBeGreaterThan(0);
    expect(snapshot.context.tradeEvaluationAllowed).toBe(false);
  });

  it('computes a positive premarket gap and bullish trend', () => {
    const previous = previousSession();
    const previousClose = previous[previous.length - 1].close;
    const premarket = candleSeries(easternInstant(2026, 8, 28, 8, 0), 10, {
      timeframeMinutes: TIMEFRAME,
      startPrice: previousClose * 1.005,
      step: 0.05,
    });

    const snapshot = partition(
      [...previous, ...premarket],
      easternInstant(2026, 8, 28, 9, 29),
    );

    expect(snapshot.premarket.gapPercentFromPreviousClose).toBeGreaterThan(0);
    expect(snapshot.premarket.trendDirection).toBe('BULLISH');
    expect(snapshot.premarket.positionInRange).toBeGreaterThan(0.6);
  });

  it('keeps a bearish premarket and a bullish regular session visible together', () => {
    const previous = previousSession();
    const previousClose = previous[previous.length - 1].close;
    const premarket = candleSeries(easternInstant(2026, 8, 28, 8, 0), 10, {
      timeframeMinutes: TIMEFRAME,
      startPrice: previousClose * 0.99,
      step: -0.05,
    });
    const recovery = candleSeries(SESSION_OPEN, 10, {
      timeframeMinutes: TIMEFRAME,
      startPrice: previousClose * 0.985,
      step: 0.08,
    });

    const snapshot = partition(
      [...previous, ...premarket, ...recovery],
      easternInstant(2026, 8, 28, 10, 0),
    );

    expect(snapshot.premarket.trendDirection).toBe('BEARISH');
    expect(snapshot.currentSessionFeatures.aboveSessionOpen).toBe(true);
    expect(
      snapshot.currentSessionFeatures.changeFromOpenPercent,
    ).toBeGreaterThan(0);
  });

  it('reports session state and maturity across the trading day', () => {
    const candles = [
      ...previousSession(),
      ...candleSeries(SESSION_OPEN, 40, { timeframeMinutes: TIMEFRAME }),
    ];

    expect(
      partition(candles, easternInstant(2026, 8, 28, 8, 30)).context
        .marketSession,
    ).toBe(MarketSession.PREMARKET);
    expect(
      partition(candles, easternInstant(2026, 8, 28, 9, 36)).context
        .marketSession,
    ).toBe(MarketSession.OPENING_SETTLEMENT);
    expect(
      partition(candles, easternInstant(2026, 8, 28, 9, 44)).context
        .marketSession,
    ).toBe(MarketSession.OPENING_SETTLEMENT);
    expect(
      partition(candles, easternInstant(2026, 8, 28, 9, 45)).context
        .marketSession,
    ).toBe(MarketSession.REGULAR);
    expect(
      partition(candles, easternInstant(2026, 8, 28, 13, 0)).context
        .marketSession,
    ).toBe(MarketSession.REGULAR);
    expect(
      partition(candles, easternInstant(2026, 8, 28, 16, 30)).context
        .marketSession,
    ).toBe(MarketSession.AFTER_HOURS);

    expect(
      partition(candles, easternInstant(2026, 8, 28, 10, 0)).context
        .sessionMaturity,
    ).toBe(SessionMaturity.DEVELOPING);
    expect(
      partition(candles, easternInstant(2026, 8, 28, 10, 30)).context
        .sessionMaturity,
    ).toBe(SessionMaturity.ESTABLISHED);
  });

  it('honours a configurable opening settlement duration', () => {
    const candles = [
      ...previousSession(),
      ...candleSeries(SESSION_OPEN, 20, { timeframeMinutes: TIMEFRAME }),
    ];
    const at940 = easternInstant(2026, 8, 28, 9, 40);

    expect(partition(candles, at940).context.marketSession).toBe(
      MarketSession.OPENING_SETTLEMENT,
    );
    expect(
      partition(candles, at940, { openingSettlementMinutes: 5 }).context
        .marketSession,
    ).toBe(MarketSession.REGULAR);
    // Trade evaluation still needs completed evidence, not just the clock:
    // only three candles have closed by 09:40.
    expect(
      partition(candles, at940, { openingSettlementMinutes: 5 }).context
        .tradeEvaluationAllowed,
    ).toBe(false);
    expect(
      partition(candles, easternInstant(2026, 8, 28, 9, 45), {
        openingSettlementMinutes: 5,
      }).context.tradeEvaluationAllowed,
    ).toBe(true);
  });

  it('blocks trade evaluation before the open and during settlement', () => {
    const candles = [
      ...previousSession(),
      ...candleSeries(SESSION_OPEN, 20, { timeframeMinutes: TIMEFRAME }),
    ];

    expect(
      partition(candles, easternInstant(2026, 8, 28, 9, 29)).context
        .tradeEvaluationAllowed,
    ).toBe(false);
    expect(
      partition(candles, easternInstant(2026, 8, 28, 9, 44)).context
        .tradeEvaluationAllowed,
    ).toBe(false);
    expect(
      partition(candles, easternInstant(2026, 8, 28, 10, 30)).context
        .tradeEvaluationAllowed,
    ).toBe(true);
  });

  it('produces finite numbers for every derived session value', () => {
    const snapshot = partition(
      [
        ...previousSession(),
        candleAt(easternInstant(2026, 8, 28, 8, 0), { open: 105, close: 105 }),
        ...candleSeries(SESSION_OPEN, 7, { timeframeMinutes: TIMEFRAME }),
      ],
      easternInstant(2026, 8, 28, 10, 0),
    );

    const numbers = [
      ...Object.values(snapshot.premarket),
      ...Object.values(snapshot.previousSession),
      ...Object.values(snapshot.currentSessionFeatures),
    ].filter((value): value is number => typeof value === 'number');

    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers.every((value) => Number.isFinite(value))).toBe(true);
  });

  describe('working-set cap', () => {
    /** A full trading day is 130 completed 3-minute regular-session candles. */
    function fullDay(count = 130): MarketCandle[] {
      return candleSeries(SESSION_OPEN, count, {
        timeframeMinutes: TIMEFRAME,
        startPrice: 110,
        step: 0.1,
      });
    }

    const afterClose = easternInstant(2026, 8, 28, 16, 30);

    it('keeps all candles when the session has exactly the maximum', () => {
      const snapshot = partition(fullDay(80), afterClose);

      expect(snapshot.context.currentSessionCandleCount).toBe(80);
      expect(snapshot.currentSessionCandles).toHaveLength(80);
      expect(snapshot.currentSessionFeatures.candleCount).toBe(80);
    });

    it.each([81, 130, 300])(
      'caps a %i-candle session to the most recent 80',
      (count) => {
        const session = fullDay(count).slice(0, count);
        const snapshot = partition(session, afterClose);

        expect(snapshot.context.currentSessionCandleCount).toBe(80);
        expect(snapshot.context.indicatorCandleCount).toBe(80);
        expect(snapshot.currentSessionCandles).toHaveLength(80);
        expect(snapshot.currentSessionFeatures.candleCount).toBe(80);
      },
    );

    it('uses the capped candles for the analytics, not just the metadata', () => {
      const session = fullDay(130);
      const snapshot = partition(session, afterClose);
      const working = session.slice(-80);

      expect(snapshot.currentSessionCandles[0].timestamp).toEqual(
        working[0].timestamp,
      );
      expect(snapshot.currentSessionFeatures.high).toBe(
        Math.max(...working.map((candle) => candle.high)),
      );
      expect(snapshot.currentSessionFeatures.low).toBe(
        Math.min(...working.map((candle) => candle.low)),
      );
      expect(snapshot.currentSessionFeatures.bullishCandleCount).toBe(
        working.filter((candle) => candle.close > candle.open).length,
      );
      expect(snapshot.warnings).toContainEqual(
        expect.stringContaining('outside the 80-candle working set'),
      );
    });

    it('keeps the real session open as preserved context after truncation', () => {
      const session = fullDay(130);
      const snapshot = partition(session, afterClose);

      expect(snapshot.currentSessionFeatures.open).toBe(session[0].open);
    });

    it('keeps the opening range correct once the session exceeds the cap', () => {
      const session = fullDay(130);
      const early = partition(session, easternInstant(2026, 8, 28, 10, 0));
      const late = partition(session, afterClose);
      const openingCandles = session.slice(0, 5);

      expect(late.openingRange.status).toBe('COMPLETE');
      expect(late.openingRange.high).toBe(early.openingRange.high);
      expect(late.openingRange.low).toBe(early.openingRange.low);
      expect(late.openingRange.high).toBe(
        Math.max(...openingCandles.map((candle) => candle.high)),
      );
      expect(late.openingRange.low).toBe(
        Math.min(...openingCandles.map((candle) => candle.low)),
      );
    });

    it('keeps premarket and previous-session context after truncation', () => {
      const snapshot = partition(
        [
          ...previousSession(),
          candleAt(easternInstant(2026, 8, 28, 8, 0), {
            open: 105,
            close: 106,
          }),
          ...fullDay(130),
        ],
        afterClose,
      );

      expect(snapshot.premarket.available).toBe(true);
      expect(snapshot.premarket.candleCount).toBe(1);
      expect(snapshot.previousSession.available).toBe(true);
      expect(snapshot.previousSession.date).toBe('2026-08-27');
      expect(snapshot.context.currentSessionCandleCount).toBe(80);
      expect(snapshot.context.previousSessionWarmupCandleCount).toBe(0);
    });

    it('still reports an established session when the day is truncated', () => {
      const snapshot = partition(
        fullDay(130),
        easternInstant(2026, 8, 28, 15, 0),
      );

      expect(snapshot.context.sessionMaturity).toBe(
        SessionMaturity.ESTABLISHED,
      );
      expect(snapshot.context.tradeEvaluationAllowed).toBe(true);
    });
  });
});
