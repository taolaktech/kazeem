import {
  MarketRegime,
  MARKET_REGIMES,
} from '../../regime/enums/market-regime.enum.js';
import type { RegimeFeatures } from '../../regime/interfaces/indicator-features.interface.js';
import type {
  RegimeClassificationResult,
  RegimeDataQuality,
  RegimeSecondaryCharacteristics,
} from '../../regime/interfaces/regime-result.interface.js';
import type { SessionSnapshotContext } from '../../market-data/session/session-context.interface.js';

export interface RegimeOverrides {
  symbol?: string;
  primaryRegime?: MarketRegime;
  confidence?: number;
  features?: Partial<RegimeFeatures>;
  secondaryCharacteristics?: Partial<RegimeSecondaryCharacteristics>;
  dataQuality?: Partial<RegimeDataQuality>;
  sessionContext?: SessionSnapshotContext;
  tradeEvaluationAllowed?: boolean;
  riskFlags?: string[];
}

/** Builds a regime classification fixture; no market data provider involved. */
export function buildRegime(
  overrides: RegimeOverrides = {},
): RegimeClassificationResult {
  const primaryRegime = overrides.primaryRegime ?? MarketRegime.RANGE_BOUND;
  return {
    symbol: overrides.symbol ?? 'SPY',
    timestamp: new Date('2026-09-01T14:00:00.000Z'),
    primaryRegime,
    confidence: overrides.confidence ?? 0.85,
    scores: Object.fromEntries(
      MARKET_REGIMES.map((regime) => [
        regime,
        regime === primaryRegime ? 8 : 1,
      ]),
    ) as Record<MarketRegime, number>,
    secondaryCharacteristics: {
      trendDirection: 'NEUTRAL',
      trendStrength: 'MODERATE',
      volatility: 'NORMAL',
      ...overrides.secondaryCharacteristics,
    },
    features: {
      currentPrice: 650,
      ema9: 650,
      ema21: 650,
      ema50: 650,
      adx: 15,
      plusDI: 20,
      minusDI: 20,
      rsi: 50,
      atr: 3,
      atrPercent: 0.5,
      bollingerWidth: 0.02,
      relativeVolume: 1,
      ...overrides.features,
    },
    reasoning: [],
    dataQuality: {
      candleCount: 500,
      sufficientData: true,
      warnings: [],
      ...overrides.dataQuality,
    },
    sessionContext: overrides.sessionContext,
    tradeEvaluationAllowed: overrides.tradeEvaluationAllowed,
    riskFlags: overrides.riskFlags,
  };
}

/** Price above EMA9 > EMA21 > EMA50, i.e. a clean bullish stack. */
export const BULLISH_EMAS: Partial<RegimeFeatures> = {
  currentPrice: 655,
  ema9: 653,
  ema21: 650,
  ema50: 645,
};

/** Price below EMA9 < EMA21 < EMA50, i.e. a clean bearish stack. */
export const BEARISH_EMAS: Partial<RegimeFeatures> = {
  currentPrice: 640,
  ema9: 642,
  ema21: 646,
  ema50: 650,
};

/** EMAs interleaved around the price: no structural direction. */
export const MIXED_EMAS: Partial<RegimeFeatures> = {
  currentPrice: 650,
  ema9: 648,
  ema21: 652,
  ema50: 649,
};
