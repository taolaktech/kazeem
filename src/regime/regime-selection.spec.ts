import { MarketRegime } from './enums/market-regime.enum.js';
import { selectPrimaryRegime } from './regime-scoring.js';

function scores(
  overrides: Partial<Record<MarketRegime, number>>,
): Record<MarketRegime, number> {
  return {
    [MarketRegime.TRENDING_BULLISH]: 0,
    [MarketRegime.TRENDING_BEARISH]: 0,
    [MarketRegime.RANGE_BOUND]: 0,
    [MarketRegime.HIGH_VOLATILITY]: 0,
    [MarketRegime.LOW_VOLATILITY]: 0,
    ...overrides,
  };
}

describe('primary regime selection', () => {
  const bearishVsRange = scores({
    [MarketRegime.TRENDING_BEARISH]: 8.5,
    [MarketRegime.RANGE_BOUND]: 8,
  });

  it('keeps RANGE_BOUND when a higher-scoring trend fails the ADX gate', () => {
    const selection = selectPrimaryRegime(bearishVsRange, 14.2);

    expect(selection.regime).toBe(MarketRegime.RANGE_BOUND);
    expect(selection.suppressedTrend).toEqual({
      regime: MarketRegime.TRENDING_BEARISH,
      score: 8.5,
      adx: 14.2,
    });
  });

  it('lets the higher-scoring trend win once ADX clears the gate', () => {
    const selection = selectPrimaryRegime(bearishVsRange, 20);

    expect(selection.regime).toBe(MarketRegime.TRENDING_BEARISH);
    expect(selection.suppressedTrend).toBeUndefined();
  });

  it('keeps RANGE_BOUND when it also outscores the trend', () => {
    const selection = selectPrimaryRegime(
      scores({
        [MarketRegime.TRENDING_BEARISH]: 8,
        [MarketRegime.RANGE_BOUND]: 8.5,
      }),
      28,
    );

    expect(selection.regime).toBe(MarketRegime.RANGE_BOUND);
  });

  it('suppresses bearish structure while ADX is weak, whatever the margin', () => {
    const selection = selectPrimaryRegime(
      scores({
        [MarketRegime.TRENDING_BEARISH]: 9.5,
        [MarketRegime.RANGE_BOUND]: 4,
        [MarketRegime.LOW_VOLATILITY]: 2,
      }),
      11,
    );

    expect(selection.regime).toBe(MarketRegime.RANGE_BOUND);
    expect(selection.suppressedTrend?.regime).toBe(
      MarketRegime.TRENDING_BEARISH,
    );
  });

  it('selects TRENDING_BEARISH on a clearly bearish trend', () => {
    const selection = selectPrimaryRegime(
      scores({
        [MarketRegime.TRENDING_BEARISH]: 9.5,
        [MarketRegime.RANGE_BOUND]: 1,
      }),
      38,
    );

    expect(selection.regime).toBe(MarketRegime.TRENDING_BEARISH);
    expect(selection.suppressedTrend).toBeUndefined();
  });

  it('promotes a strongly supported trend over a leading volatility regime', () => {
    const selection = selectPrimaryRegime(
      scores({
        [MarketRegime.TRENDING_BEARISH]: 7,
        [MarketRegime.HIGH_VOLATILITY]: 8,
      }),
      30,
    );

    expect(selection.regime).toBe(MarketRegime.TRENDING_BEARISH);
  });

  it('breaks exact ties by declaration order', () => {
    const selection = selectPrimaryRegime(
      scores({
        [MarketRegime.TRENDING_BEARISH]: 8,
        [MarketRegime.RANGE_BOUND]: 8,
      }),
      25,
    );

    expect(selection.regime).toBe(MarketRegime.TRENDING_BEARISH);
  });
});
