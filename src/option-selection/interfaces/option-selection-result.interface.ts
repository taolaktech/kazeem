import type { OptionType } from '../../options-data/enums/option-type.enum.js';
import type { MarketSignal } from '../../signal/enums/market-signal.enum.js';
import type { OptionSelectionStatus } from '../enums/option-selection-status.enum.js';
import type { OptionCandidate } from './option-candidate-score.interface.js';

export interface OptionSelectionResult {
  symbol: string;
  timestamp: Date;
  /** Direction as decided by the signal engine; never re-evaluated here. */
  signal: MarketSignal;
  /** `null` whenever the signal is not directional. */
  optionType: OptionType | null;
  status: OptionSelectionStatus;
  /** Mirrors the signal engine: false means no actionable recommendation. */
  tradeEvaluationAllowed: boolean;
  confidence: number;
  /** Maximum total premium, in dollars, allowed for one contract position. */
  maxBudget: number;
  /** Latest underlying price from market data, not from the options payload. */
  underlyingPrice: number | null;
  selectedContract: OptionCandidate | null;
  alternatives: OptionCandidate[];
  reasoning: string[];
  riskFlags: string[];
  /** True only when the selection could be traded on a real quote right now. */
  executionReady: boolean;
}
