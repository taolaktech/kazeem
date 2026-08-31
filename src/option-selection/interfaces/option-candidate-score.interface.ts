import type { OptionType } from '../../options-data/enums/option-type.enum.js';
import type { Moneyness } from '../enums/option-selection-status.enum.js';
import type { PremiumPriceSource } from '../premium-pricing.js';

/** Points awarded per scoring dimension; the sum is the candidate's score. */
export interface OptionScoreBreakdown {
  delta: number;
  strikeProximity: number;
  dte: number;
  volume: number;
  openInterest: number;
  iv: number;
  spread: number;
  dataQuality: number;
}

export interface OptionCandidate {
  /** OCC contract symbol, e.g. `O:SPY260904C00650000`. */
  symbol: string;
  contractType: OptionType;
  strikePrice: number;
  expirationDate: Date;
  daysToExpiration: number;
  moneyness: Moneyness;
  /** `|strike - underlying| / underlying`, as a decimal fraction. */
  strikeDistancePercent: number;
  bid: number | null;
  ask: number | null;
  lastPrice: number | null;
  volume: number;
  openInterest: number;
  impliedVolatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  premiumPriceUsed: number | null;
  premiumPriceSource: PremiumPriceSource;
  estimatedContractCost: number | null;
  withinBudget: boolean;
  score: number;
  scoreBreakdown: OptionScoreBreakdown;
  /** True only when both sides of a real bid/ask quote are present. */
  quoteAvailable: boolean;
  /** Fraction of the tracked provider fields that carry a value. */
  dataCompleteness: number;
  riskFlags: string[];
}
