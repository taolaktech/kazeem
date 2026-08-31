import { describe, expect, it } from 'vitest';
import { buildSessionSnapshot } from '../../test/factories/session-snapshot.js';
import type {
  MarketSessionSnapshot,
  OpeningRangeContext,
} from '../market-data/session/session-context.interface.js';
import { COMPLETE_OPENING_RANGE } from '../signal/testing/regime-factory.js';
import { evaluateSessionEvidence } from './session-evidence.js';

function withOpeningRange(
  overrides: Partial<OpeningRangeContext>,
): MarketSessionSnapshot {
  const snapshot = buildSessionSnapshot({ atHour: 11 });
  return {
    ...snapshot,
    openingRange: { ...COMPLETE_OPENING_RANGE, ...overrides },
  };
}

describe('opening range as regime evidence', () => {
  it('adds bullish evidence for a confirmed breakout above the range', () => {
    const inside = evaluateSessionEvidence(withOpeningRange({}));
    const breakout = evaluateSessionEvidence(
      withOpeningRange({
        currentPricePosition: 'ABOVE',
        breakoutAbove: true,
        closesAboveHigh: 3,
        volumeConfirmation: 'CONFIRMED',
        breakoutStrength: 'STRONG',
      }),
    );

    expect(breakout.bullish).toBeGreaterThan(inside.bullish);
    expect(breakout.reasoning.join(' ')).toContain('broke out above');
  });

  it('adds bearish evidence for a confirmed breakdown below the range', () => {
    const evidence = evaluateSessionEvidence(
      withOpeningRange({
        currentPricePosition: 'BELOW',
        breakdownBelow: true,
        closesBelowLow: 2,
        volumeConfirmation: 'NOT_CONFIRMED',
      }),
    );

    expect(evidence.bearish).toBeGreaterThan(0);
    expect(evidence.riskFlags).toContain(
      'Opening-range break lacks volume confirmation',
    );
  });

  it('adds range-bound evidence while price stays inside the range', () => {
    const evidence = evaluateSessionEvidence(withOpeningRange({}));

    expect(evidence.rangeBound).toBeGreaterThan(0);
    expect(evidence.reasoning.join(' ')).toContain('inside the opening range');
  });

  it('weakens the attempting side after a rejected breakout', () => {
    const clean = evaluateSessionEvidence(withOpeningRange({}));
    const rejected = evaluateSessionEvidence(
      withOpeningRange({ failedBreakoutAbove: true }),
    );

    expect(rejected.bullish).toBeLessThanOrEqual(clean.bullish);
    expect(rejected.bearish).toBe(clean.bearish);
    expect(rejected.riskFlags).toContain('Opening-range breakout was rejected');
  });

  it('contributes no levels evidence while the range is still forming', () => {
    const evidence = evaluateSessionEvidence(
      withOpeningRange({ status: 'FORMING', currentPricePosition: 'UNKNOWN' }),
    );

    expect(evidence.rangeBound).toBe(0);
    expect(evidence.riskFlags.join(' ')).toContain('still forming');
  });

  it('never lets the opening range alone decide the direction', () => {
    const snapshot = buildSessionSnapshot({ atHour: 11 });
    const evidence = evaluateSessionEvidence({
      ...snapshot,
      openingRange: {
        ...COMPLETE_OPENING_RANGE,
        currentPricePosition: 'ABOVE',
        breakoutAbove: true,
        closesAboveHigh: 4,
        volumeConfirmation: 'CONFIRMED',
      },
    });
    const withoutRange = evaluateSessionEvidence({
      ...snapshot,
      openingRange: { ...COMPLETE_OPENING_RANGE, available: false },
    });

    // Opening-range evidence is additive on top of the indicator baseline.
    expect(evidence.bullish - withoutRange.bullish).toBeLessThanOrEqual(3.5);
  });
});
