import { describe, expect, it } from 'vitest';
import { MarketRegime } from '../regime/enums/market-regime.enum.js';
import { evaluateFactors } from './signal-factors.js';
import { BULLISH_EMAS, buildRegime } from './testing/regime-factory.js';

function totals(
  factors: ReturnType<typeof evaluateFactors>,
): Record<'bullish' | 'bearish' | 'noTrade', number> {
  return factors.reduce(
    (sums, factor) => ({
      bullish: sums.bullish + (factor.bullish ?? 0),
      bearish: sums.bearish + (factor.bearish ?? 0),
      noTrade: sums.noTrade + (factor.noTrade ?? 0),
    }),
    { bullish: 0, bearish: 0, noTrade: 0 },
  );
}

describe('opening range as signal evidence', () => {
  it('is ignored when the regime carries no opening range', () => {
    const factors = evaluateFactors(
      buildRegime({ primaryRegime: MarketRegime.TRENDING_BULLISH }),
    );

    expect(
      factors.some((factor) =>
        (factor.confirmation ?? factor.conflict ?? '').includes(
          'opening range',
        ),
      ),
    ).toBe(false);
  });

  it('adds bullish evidence for a sustained breakout above the range', () => {
    const factors = evaluateFactors(
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BULLISH,
        features: BULLISH_EMAS,
        openingRange: {
          currentPricePosition: 'ABOVE',
          breakoutAbove: true,
          closesAboveHigh: 3,
          breakoutStrength: 'STRONG',
          volumeConfirmation: 'CONFIRMED',
        },
      }),
    );

    expect(totals(factors).bullish).toBeGreaterThan(
      totals(
        evaluateFactors(
          buildRegime({
            primaryRegime: MarketRegime.TRENDING_BULLISH,
            features: BULLISH_EMAS,
          }),
        ),
      ).bullish,
    );
    expect(factors.map((factor) => factor.confirmation).join(' ')).toContain(
      'broke out above the opening range',
    );
  });

  it('flags a break that lacks volume confirmation', () => {
    const factors = evaluateFactors(
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BEARISH,
        openingRange: {
          currentPricePosition: 'BELOW',
          breakdownBelow: true,
          closesBelowLow: 1,
          volumeConfirmation: 'NOT_CONFIRMED',
        },
      }),
    );

    expect(totals(factors).bearish).toBeGreaterThan(0);
    expect(factors.map((factor) => factor.riskFlag)).toContain(
      'Opening-range break lacks volume confirmation',
    );
  });

  it('reports a conflict when price sits inside the range', () => {
    const factors = evaluateFactors(
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BULLISH,
        openingRange: {},
      }),
    );

    expect(factors.map((factor) => factor.conflict)).toContain(
      'Price is still inside the opening range',
    );
  });

  it('does not turn a failed breakout into bearish evidence', () => {
    const factors = evaluateFactors(
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BULLISH,
        features: BULLISH_EMAS,
        openingRange: { failedBreakoutAbove: true },
      }),
    );
    const sums = totals(factors);

    expect(sums.bearish).toBe(0);
    expect(sums.noTrade).toBeGreaterThan(0);
    expect(factors.map((factor) => factor.conflict)).toContain(
      'Price was rejected after trading above the opening range high',
    );
  });

  it('flags a bearish regime while price holds above the opening range', () => {
    const factors = evaluateFactors(
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BEARISH,
        openingRange: { currentPricePosition: 'ABOVE', breakoutAbove: true },
      }),
    );

    expect(factors.map((factor) => factor.conflict).join(' ')).toContain(
      'against the TRENDING_BEARISH regime',
    );
  });

  it('ignores a forming range entirely', () => {
    const factors = evaluateFactors(
      buildRegime({
        primaryRegime: MarketRegime.TRENDING_BULLISH,
        openingRange: { status: 'FORMING', currentPricePosition: 'UNKNOWN' },
      }),
    );

    expect(
      factors.some((factor) =>
        (factor.confirmation ?? factor.conflict ?? '').includes(
          'opening range',
        ),
      ),
    ).toBe(false);
  });
});
