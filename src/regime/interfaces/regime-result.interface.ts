import type {
  MarketRegime,
  TrendDirection,
  TrendStrength,
  VolatilityLevel,
} from '../enums/market-regime.enum.js';
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
}

export interface RegimeClassifier {
  classify(
    symbol: string,
    candles: MarketCandle[],
  ): Promise<RegimeClassificationResult>;
}
