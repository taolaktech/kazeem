import { SessionMaturity } from '../market-data/session/market-session.enum.js';
import { MarketSignal } from '../signal/enums/market-signal.enum.js';
import { buildSeriesSnapshot } from '../../test/factories/session-snapshot.js';
import {
  ConfirmationStrength,
  SignalAlignment,
  VolatilityRelationship,
} from './enums/volatility.enum.js';
import type { UnderlyingMetrics } from './interfaces/volatility-intelligence-result.interface.js';
import {
  assessRelationship,
  resolveSignalAlignment,
  volatilityPressureScore,
} from './relationship.js';
import { buildUnderlyingMetrics } from './underlying-metrics.js';
import {
  analyzeVix,
  unavailableVix,
  type VixAnalysis,
} from './vix-analysis.js';

const VIX_SYMBOL = 'I:VIX';
const MOMENTUM_LOOKBACK = 3;

function vix(currentCloses: number[], previousLevel: number): VixAnalysis {
  return analyzeVix(
    buildSeriesSnapshot({
      symbol: VIX_SYMBOL,
      currentCloses,
      previousLevel,
    }),
    { symbol: VIX_SYMBOL, momentumLookbackCandles: MOMENTUM_LOOKBACK },
  );
}

function underlying(
  currentCloses: number[],
  previousLevel: number,
): UnderlyingMetrics {
  return buildUnderlyingMetrics(
    buildSeriesSnapshot({ symbol: 'SPY', currentCloses, previousLevel }),
    MOMENTUM_LOOKBACK,
  );
}

const risingVix = (): VixAnalysis =>
  vix([18, 18.2, 18.5, 18.9, 19.3, 19.8], 18);
const fallingVix = (): VixAnalysis =>
  vix([18, 17.8, 17.5, 17.1, 16.7, 16.2], 18);
const flatVix = (): VixAnalysis => vix([18, 18.01, 18, 17.99, 18, 18.01], 18);

const risingSpy = (): UnderlyingMetrics =>
  underlying([500, 500.6, 501.3, 502.1, 503, 504], 500);
const fallingSpy = (): UnderlyingMetrics =>
  underlying([500, 499.4, 498.7, 497.9, 497, 496], 500);
const flatSpy = (): UnderlyingMetrics =>
  underlying([500, 500.05, 500, 499.95, 500, 500.05], 500);

describe('volatility/underlying relationship', () => {
  it('confirms a bullish underlying when VIX is falling', () => {
    const assessment = assessRelationship(fallingVix(), risingSpy());

    expect(assessment.relationship).toBe(
      VolatilityRelationship.CONFIRMING_BULLISH,
    );
    expect(assessment.confirmations).toContain(
      'Underlying advance is confirmed by falling VIX',
    );
    expect(assessment.divergences).toHaveLength(0);
  });

  it('confirms a bearish underlying when VIX is rising', () => {
    const assessment = assessRelationship(risingVix(), fallingSpy());

    expect(assessment.relationship).toBe(
      VolatilityRelationship.CONFIRMING_BEARISH,
    );
    expect(assessment.strength).not.toBe(ConfirmationStrength.UNKNOWN);
  });

  it('reports a divergence when the underlying and VIX both rise materially', () => {
    const assessment = assessRelationship(risingVix(), risingSpy());

    expect(assessment.relationship).toBe(VolatilityRelationship.DIVERGENCE);
    expect(assessment.riskFlags).toContain(
      'VIX expansion conflicts with bullish underlying movement',
    );
  });

  it('reports a divergence when the underlying and VIX both fall materially', () => {
    const assessment = assessRelationship(fallingVix(), fallingSpy());

    expect(assessment.relationship).toBe(VolatilityRelationship.DIVERGENCE);
    expect(assessment.riskFlags).toContain(
      'VIX contraction conflicts with bearish underlying movement',
    );
  });

  it('stays neutral when both series are flat', () => {
    const assessment = assessRelationship(flatVix(), flatSpy());

    expect(assessment.relationship).toBe(VolatilityRelationship.NEUTRAL);
    expect(assessment.strength).toBe(ConfirmationStrength.WEAK);
  });

  it('stays neutral when only the underlying moves', () => {
    expect(assessRelationship(flatVix(), risingSpy()).relationship).toBe(
      VolatilityRelationship.NEUTRAL,
    );
  });

  it('is unknown when VIX data is unavailable', () => {
    const assessment = assessRelationship(
      unavailableVix(VIX_SYMBOL),
      risingSpy(),
    );

    expect(assessment.relationship).toBe(VolatilityRelationship.UNKNOWN);
    expect(assessment.strength).toBe(ConfirmationStrength.UNKNOWN);
    expect(assessment.vixDirection).toBe('UNKNOWN');
  });
});

describe('signal alignment', () => {
  it('conflicts when a bullish signal meets a volatility divergence', () => {
    expect(
      resolveSignalAlignment(
        MarketSignal.BULLISH,
        VolatilityRelationship.DIVERGENCE,
      ),
    ).toBe(SignalAlignment.CONFLICTS);
  });

  it('confirms when a bearish signal meets a bearish confirmation', () => {
    expect(
      resolveSignalAlignment(
        MarketSignal.BEARISH,
        VolatilityRelationship.CONFIRMING_BEARISH,
      ),
    ).toBe(SignalAlignment.CONFIRMS);
  });

  it('is neutral for a non-directional signal', () => {
    expect(
      resolveSignalAlignment(
        MarketSignal.NEUTRAL,
        VolatilityRelationship.CONFIRMING_BULLISH,
      ),
    ).toBe(SignalAlignment.NEUTRAL);
  });

  it('is unknown without a relationship', () => {
    expect(
      resolveSignalAlignment(
        MarketSignal.BULLISH,
        VolatilityRelationship.UNKNOWN,
      ),
    ).toBe(SignalAlignment.UNKNOWN);
  });
});

describe('volatility pressure score', () => {
  it('is positive while volatility expands and negative while it contracts', () => {
    const expanding = volatilityPressureScore(
      risingVix().metrics,
      fallingSpy(),
      SessionMaturity.ESTABLISHED,
    );
    const contracting = volatilityPressureScore(
      fallingVix().metrics,
      risingSpy(),
      SessionMaturity.ESTABLISHED,
    );

    expect(expanding).toBeGreaterThan(0);
    expect(contracting).toBeLessThan(0);
    expect(Math.abs(expanding)).toBeLessThanOrEqual(1);
  });

  it('is zero and finite when VIX data is unavailable', () => {
    const score = volatilityPressureScore(
      unavailableVix(VIX_SYMBOL).metrics,
      flatSpy(),
      SessionMaturity.EARLY,
    );

    expect(score).toBe(0);
  });
});
