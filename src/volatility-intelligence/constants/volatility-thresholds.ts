import { SessionMaturity } from '../../market-data/session/market-session.enum.js';

/**
 * Contextual starting bands for the absolute VIX level, in index points. They
 * describe the environment; they never decide the VIX/underlying relationship
 * on their own, because intraday the rate of change matters more than the
 * level (VIX 14 rising 9% is not a calm tape).
 */
export const VIX_LEVEL_THRESHOLDS = {
  /** Below this the environment is LOW. */
  normal: 15,
  /** Below this NORMAL, at or above it ELEVATED. */
  elevated: 20,
  /** At or above this HIGH. */
  high: 25,
  /** At or above this EXTREME. */
  extreme: 35,
} as const;

/**
 * Percentage moves of VIX over the short momentum window that separate the
 * momentum buckets. Symmetric for rising and falling.
 */
export const VIX_MOMENTUM_PERCENT = {
  moving: 0.5,
  fast: 1.5,
} as const;

/**
 * How much faster the latest short window must be moving than the window
 * before it, in percentage points, to count as accelerating.
 */
export const VIX_ACCELERATION_PERCENT = 0.5;

/** Short-window VIX move, in percent, treated as a spike. */
export const VIX_SPIKE_PERCENT = 2.5;

/** VIX move from previous close or session open that is materially directional. */
export const VIX_MATERIAL_MOVE_PERCENT = 1.5;

/** Underlying move from the session open that is materially directional. */
export const UNDERLYING_MATERIAL_MOVE_PERCENT = 0.15;

/** Points of trend evidence required before VIX is called rising or falling. */
export const VIX_TREND_SCORE_THRESHOLD = 2;

/** Agreement points required for each confirmation strength. */
export const CONFIRMATION_STRENGTH_SCORE = {
  strong: 4,
  moderate: 2,
} as const;

/** Contributions to the volatility intelligence confidence, summing to 1. */
export const CONFIDENCE_WEIGHTS = {
  dataAvailability: 0.3,
  sessionMaturity: 0.2,
  internalAgreement: 0.2,
  relationshipClarity: 0.2,
  freshness: 0.1,
} as const;

/**
 * Weight of premarket direction as the regular session develops. Reference
 * levels (premarket high, low, gap) stay available all day; only the
 * directional read decays.
 */
export const PREMARKET_DIRECTIONAL_DECAY: Record<SessionMaturity, number> = {
  [SessionMaturity.SETTLING]: 1,
  [SessionMaturity.EARLY]: 0.7,
  [SessionMaturity.DEVELOPING]: 0.4,
  [SessionMaturity.ESTABLISHED]: 0.15,
};

/** Components of the explainable volatility pressure score, summing to 1. */
export const PRESSURE_WEIGHTS = {
  changePercent: 0.35,
  changeFromOpenPercent: 0.25,
  momentum: 0.25,
  level: 0.1,
  premarketGap: 0.05,
} as const;

/**
 * VIX percentage move that saturates a pressure component. Moves beyond it
 * cannot push the score past its bound.
 */
export const PRESSURE_SATURATION_PERCENT = 8;
