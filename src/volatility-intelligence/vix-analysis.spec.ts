import {
  buildSeriesSnapshot,
  SESSION_OPEN,
  TIMEFRAME_MINUTES,
  type SeriesSnapshotOptions,
} from '../../test/factories/session-snapshot.js';
import {
  candleSeries,
  easternInstant,
} from '../../test/factories/session-candles.js';
import {
  VolatilityMomentum,
  VolatilityState,
  VolatilityTrend,
} from './enums/volatility.enum.js';
import {
  analyzeVix,
  unavailableVix,
  type VixAnalysis,
} from './vix-analysis.js';

const VIX_SYMBOL = 'I:VIX';
const MOMENTUM_LOOKBACK = 3;

function analyze(
  currentCloses: number[],
  options: Partial<Omit<SeriesSnapshotOptions, 'currentCloses'>> = {},
): VixAnalysis {
  return analyzeVix(
    buildSeriesSnapshot({ symbol: VIX_SYMBOL, currentCloses, ...options }),
    { symbol: VIX_SYMBOL, momentumLookbackCandles: MOMENTUM_LOOKBACK },
  );
}

/** A flat session sitting at `level`, long enough for both EMAs. */
function flatAt(level: number): VixAnalysis {
  return analyze(
    Array.from({ length: 25 }, () => level),
    {
      previousLevel: level,
    },
  );
}

function rising(from: number, step: number, count = 25): number[] {
  return Array.from({ length: count }, (_unused, index) => from + step * index);
}

describe('VIX analysis', () => {
  describe('volatility state', () => {
    it.each([
      [13.8, VolatilityState.LOW],
      [17.4, VolatilityState.NORMAL],
      [22.1, VolatilityState.ELEVATED],
      [30.5, VolatilityState.HIGH],
      [41.2, VolatilityState.EXTREME],
    ])('classifies %s as %s', (level, expected) => {
      expect(flatAt(level).state).toBe(expected);
    });

    it('keeps a low but rapidly rising VIX from being dismissed as calm', () => {
      const analysis = analyze([13.5, 13.6, 13.75, 13.95, 14.25, 14.6], {
        previousLevel: 13.4,
      });

      expect(analysis.state).toBe(VolatilityState.LOW);
      expect(analysis.momentum).toBe(VolatilityMomentum.RISING_FAST);
      expect(analysis.trend).toBe(VolatilityTrend.RISING);
    });

    it('distinguishes a high but rapidly falling VIX from an expanding one', () => {
      const analysis = analyze([33, 32, 31.2, 30.1, 29.2, 28.4], {
        previousLevel: 34,
      });

      expect(analysis.state).toBe(VolatilityState.HIGH);
      expect(analysis.momentum).toBe(VolatilityMomentum.FALLING_FAST);
      expect(analysis.trend).toBe(VolatilityTrend.FALLING);
    });
  });

  describe('trend', () => {
    it('treats VIX above EMA9 above EMA21 with a positive session move as rising', () => {
      const { metrics, trend } = analyze(rising(18, 0.08), {
        previousLevel: 18,
      });

      expect(metrics.ema9).not.toBeNull();
      expect(metrics.ema21).not.toBeNull();
      expect(metrics.current).toBeGreaterThan(metrics.ema9 as number);
      expect(metrics.ema9 as number).toBeGreaterThan(metrics.ema21 as number);
      expect(trend).toBe(VolatilityTrend.RISING);
    });

    it('treats VIX below EMA9 below EMA21 with a negative session move as falling', () => {
      const { metrics, trend } = analyze(rising(22, -0.08), {
        previousLevel: 22,
      });

      expect(metrics.current).toBeLessThan(metrics.ema9 as number);
      expect(metrics.ema9 as number).toBeLessThan(metrics.ema21 as number);
      expect(trend).toBe(VolatilityTrend.FALLING);
    });

    it('warms EMAs up from previous-session candles when the day is young', () => {
      const { metrics } = analyze([18, 18.1, 18.2, 18.3, 18.4], {
        previousLevel: 18,
      });

      expect(metrics.currentSessionCandleCount).toBe(5);
      expect(metrics.ema21).not.toBeNull();
    });
  });

  describe('momentum and completed candles', () => {
    it('ignores the still-forming candle', () => {
      const analysis = analyze([18, 18.1, 18.2, 18.3, 18.4, 25], {
        previousLevel: 18,
        now: new Date(SESSION_OPEN.getTime() + 5 * TIMEFRAME_MINUTES * 60_000),
      });

      expect(analysis.metrics.currentSessionCandleCount).toBe(5);
      expect(analysis.metrics.current).toBe(18.4);
    });

    it('reports rising-fast short-term momentum', () => {
      const analysis = analyze([18, 18.05, 18.1, 18.4, 18.8, 19.2], {
        previousLevel: 18,
      });

      expect(analysis.metrics.shortMomentumPercent).toBeGreaterThan(1.5);
      expect(analysis.momentum).toBe(VolatilityMomentum.RISING_FAST);
    });

    it('reports falling-fast short-term momentum', () => {
      const analysis = analyze([22, 21.9, 21.8, 21.4, 21, 20.6], {
        previousLevel: 22,
      });

      expect(analysis.metrics.shortMomentumPercent).toBeLessThan(-1.5);
      expect(analysis.momentum).toBe(VolatilityMomentum.FALLING_FAST);
    });

    it('detects acceleration when the latest window outpaces the previous one', () => {
      const analysis = analyze([18, 18.05, 18.1, 18.15, 18.6, 19.1, 19.7], {
        previousLevel: 18,
      });

      expect(analysis.metrics.acceleration).toBeGreaterThan(0.5);
      expect(analysis.riskFlags).toContain(
        'VIX volatility expansion is accelerating',
      );
    });

    it('detects a spike', () => {
      const analysis = analyze([18, 18.1, 18.2, 19, 19.6], {
        previousLevel: 18,
      });

      expect(analysis.metrics.spikeDetected).toBe(true);
      expect(
        analysis.riskFlags.some((flag) => flag.includes('spiked higher')),
      ).toBe(true);
    });
  });

  describe('degraded data', () => {
    it('stays safe when the previous session close is missing', () => {
      const analysis = analyze([18, 18.2, 18.4, 18.6], {
        withoutPreviousSession: true,
      });

      expect(analysis.metrics.previousClose).toBeNull();
      expect(analysis.metrics.change).toBeNull();
      expect(analysis.metrics.changePercent).toBeNull();
      expect(analysis.state).toBe(VolatilityState.NORMAL);
    });

    it('reports premarket VIX data as unavailable when the provider omits it', () => {
      expect(flatAt(18).metrics.premarketAvailable).toBe(false);
    });

    it('reports premarket VIX data when the provider supplies it', () => {
      const premarket = candleSeries(easternInstant(2026, 8, 28, 8, 0), 10, {
        timeframeMinutes: TIMEFRAME_MINUTES,
        startPrice: 18,
        step: 0.01,
      });
      const analysis = analyze([18, 18.1, 18.2, 18.3], {
        previousLevel: 18,
        premarket,
      });

      expect(analysis.metrics.premarketAvailable).toBe(true);
    });

    it('returns an unknown, fully null analysis when VIX data is unavailable', () => {
      const analysis = unavailableVix(VIX_SYMBOL);

      expect(analysis.state).toBe(VolatilityState.UNKNOWN);
      expect(analysis.trend).toBe(VolatilityTrend.UNKNOWN);
      expect(analysis.momentum).toBe(VolatilityMomentum.UNKNOWN);
      expect(analysis.metrics.available).toBe(false);
      expect(analysis.metrics.current).toBeNull();
      expect(analysis.riskFlags).toContain(
        'VIX data is unavailable from the market data provider',
      );
    });

    it('never emits NaN or Infinity', () => {
      for (const analysis of [
        flatAt(18),
        analyze([18, 18.2], { withoutPreviousSession: true }),
        unavailableVix(VIX_SYMBOL),
      ]) {
        for (const value of Object.values(analysis.metrics)) {
          if (typeof value === 'number') {
            expect(Number.isFinite(value)).toBe(true);
          }
        }
      }
    });
  });
});
