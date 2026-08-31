/** Candidate filters applied before any contract is scored. */
export const SELECTION_FILTERS = {
  minDaysToExpiration: 0,
  maxDaysToExpiration: 7,
  minVolume: 0,
  minOpenInterest: 0,
  /** Strikes further than this fraction from the underlying are discarded. */
  maxStrikeDistancePercent: 0.05,
} as const;

/** Score weights; they sum to 100, so a candidate's score reads as a percentage. */
export const SCORE_WEIGHTS = {
  delta: 25,
  strikeProximity: 20,
  dte: 15,
  volume: 12,
  openInterest: 10,
  iv: 8,
  spread: 6,
  dataQuality: 4,
} as const;

export const MAX_SCORE = Object.values(SCORE_WEIGHTS).reduce(
  (total, weight) => total + weight,
  0,
);

/** Preferred |delta| band for a directional intraday long option. */
export const DELTA_BAND = { min: 0.4, max: 0.75 } as const;
/** |delta| distance beyond the band at which the delta score reaches zero. */
export const DELTA_FALLOFF = 0.35;

/** |strike - underlying| / underlying under which a contract counts as ATM. */
export const ATM_TOLERANCE_PERCENT = 0.002;

/** Multipliers per days-to-expiration band; 0DTE is viable but not favoured. */
export const DTE_BAND_SCORES = {
  zero: 0.6,
  oneToTwo: 1,
  threeToSeven: 0.8,
  beyond: 0.5,
} as const;

/** Volume/open interest at which the respective score saturates. */
export const VOLUME_SATURATION = 5_000;
export const OPEN_INTEREST_SATURATION = 10_000;

/** IV band treated as normal; outside it the premium is cheap or expensive. */
export const IV_BAND = { min: 0.1, max: 0.6 } as const;
export const IV_ELEVATED = 0.8;
export const IV_ELEVATED_SCORE = 0.3;
/** Score used when the provider reports no IV at all. */
export const IV_UNKNOWN_SCORE = 0.5;

/** Bid/ask spread band, in percent of the midpoint. */
export const SPREAD_TIGHT_PERCENT = 2;
export const SPREAD_MAX_PERCENT = 10;

/** Fields counted towards a candidate's data completeness. */
export const COMPLETENESS_FIELDS = [
  'delta',
  'gamma',
  'theta',
  'vega',
  'impliedVolatility',
  'volume',
  'openInterest',
  'bid',
  'ask',
  'lastPrice',
] as const;

/** Minimum completeness a contract needs before it may be executed. */
export const MIN_EXECUTION_COMPLETENESS = 0.7;

/** Liquidity levels below which a candidate carries a risk flag. */
export const LOW_VOLUME_FLAG = 100;
export const LOW_OPEN_INTEREST_FLAG = 500;

export const DEFAULT_MAX_ALTERNATIVES = 4;

/** Candidate count at which the "enough choice" confidence input saturates. */
export const CANDIDATE_POOL_SATURATION = 5;

/** Confidence weighting of its components (must sum to 1). */
export const CONFIDENCE_WEIGHTS = {
  bestScore: 0.35,
  separation: 0.2,
  completeness: 0.2,
  signal: 0.15,
  poolSize: 0.1,
} as const;

/** Confidence multiplier applied when the selection has no real quote. */
export const MISSING_QUOTE_CONFIDENCE_PENALTY = 0.85;
