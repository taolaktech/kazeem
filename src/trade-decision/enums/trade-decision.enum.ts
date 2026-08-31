/**
 * Outcome of the deterministic decision layer.
 *
 * `TRADE` means the 3-minute thesis is strong enough to proceed to the future
 * 5-minute entry confirmation layer. It never means "place an order now".
 */
export enum TradeDecision {
  TRADE = 'TRADE',
  WAIT = 'WAIT',
  NO_TRADE = 'NO_TRADE',
}

/** Long-only instrument implied by the directional thesis. */
export enum TradeDirection {
  CALL = 'CALL',
  PUT = 'PUT',
  NONE = 'NONE',
}

/**
 * Quality of the current evidence, not a probability of profit: `A` means the
 * evidence looks like a strong setup, not that the trade is likely to win.
 */
export enum SetupGrade {
  A_PLUS = 'A+',
  A = 'A',
  B_PLUS = 'B+',
  B = 'B',
  C_PLUS = 'C+',
  C = 'C',
}

export enum ConflictSeverity {
  MINOR = 'MINOR',
  MODERATE = 'MODERATE',
  MAJOR = 'MAJOR',
  CRITICAL = 'CRITICAL',
}

/** The six evidence categories the decision score is built from. */
export enum DecisionCategory {
  DIRECTIONAL_SIGNAL = 'directionalSignal',
  REGIME_AND_STRUCTURE = 'regimeAndStructure',
  MOMENTUM_AND_VOLUME = 'momentumAndVolume',
  OPTION_QUALITY = 'optionQuality',
  NEWS = 'news',
  VOLATILITY = 'volatility',
}

/**
 * CORE categories must be available: their weight always stays in the
 * denominator so missing core intelligence can never be normalized away into a
 * high grade. OPTIONAL categories leave the denominator when unavailable.
 */
export const CORE_CATEGORIES: readonly DecisionCategory[] = [
  DecisionCategory.DIRECTIONAL_SIGNAL,
  DecisionCategory.REGIME_AND_STRUCTURE,
  DecisionCategory.MOMENTUM_AND_VOLUME,
  DecisionCategory.OPTION_QUALITY,
];

export const OPTIONAL_CATEGORIES: readonly DecisionCategory[] = [
  DecisionCategory.NEWS,
  DecisionCategory.VOLATILITY,
];
