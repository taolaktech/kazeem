import type {
  MarketRegime,
  TrendDirection,
  TrendStrength,
  VolatilityLevel,
} from '../enums/market-regime.enum.js';
import type {
  CurrentSessionFeatures,
  OpeningRangeContext,
  PremarketContext,
  PreviousSessionContext,
  SessionSnapshotContext,
} from '../../market-data/session/session-context.interface.js';
import type { MarketCandle } from './market-data.interface.js';
import type { RegimeFeatures } from './indicator-features.interface.js';

export interface RegimeSecondaryCharacteristics {
  trendDirection: TrendDirection;
  trendStrength: TrendStrength;
  volatility: VolatilityLevel;
}

export interface RegimeDataQuality {
  candleCount: number;
  sufficientData: boolean;
  warnings: string[];
}

export interface RegimeClassificationResult {
  symbol: string;
  timestamp: Date;
  primaryRegime: MarketRegime;
  confidence: number;
  scores: Record<MarketRegime, number>;
  secondaryCharacteristics: RegimeSecondaryCharacteristics;
  features: RegimeFeatures;
  reasoning: string[];
  dataQuality: RegimeDataQuality;
  /** Present only for session-aware classifications fetched from market data. */
  sessionContext?: SessionSnapshotContext;
  premarketContext?: PremarketContext;
  /** 09:30–09:45 ET reference levels; frozen once the window closes. */
  openingRange?: OpeningRangeContext;
  previousSessionContext?: PreviousSessionContext;
  currentSessionFeatures?: CurrentSessionFeatures;
  /**
   * False while the market is outside regular hours or still inside the
   * opening settlement period. The classification is still produced.
   */
  tradeEvaluationAllowed?: boolean;
  riskFlags?: string[];
}

export interface RegimeClassifier {
  classify(
    symbol: string,
    candles: MarketCandle[],
  ): Promise<RegimeClassificationResult>;
}
