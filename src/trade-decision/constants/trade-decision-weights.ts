import {
  ConflictSeverity,
  DecisionCategory,
  SetupGrade,
} from '../enums/trade-decision.enum.js';

/**
 * V1 calibration defaults. Every number the decision layer scores with lives
 * here so future backtesting can recalibrate one file.
 */
export const CATEGORY_WEIGHTS: Record<DecisionCategory, number> = {
  [DecisionCategory.DIRECTIONAL_SIGNAL]: 25,
  [DecisionCategory.REGIME_AND_STRUCTURE]: 30,
  [DecisionCategory.MOMENTUM_AND_VOLUME]: 15,
  [DecisionCategory.OPTION_QUALITY]: 20,
  [DecisionCategory.NEWS]: 5,
  [DecisionCategory.VOLATILITY]: 5,
};

export const TOTAL_WEIGHT = 100;

/** Sub-weights inside the directional signal category (sum = 1). */
export const SIGNAL_SUB_WEIGHTS = {
  confidence: 0.5,
  separation: 0.3,
  cleanliness: 0.2,
} as const;

/** Sub-weights inside regime + structure, in points out of the category. */
export const STRUCTURE_SUB_WEIGHTS = {
  regimeAlignment: 14,
  sessionStructure: 8,
  openingRange: 8,
} as const;

/** Share of the regime sub-weight earned per regime/direction relationship. */
export const REGIME_ALIGNMENT_FACTORS = {
  aligned: 1,
  rangeBound: 0.5,
  volatilityRegime: 0.6,
  opposed: 0,
} as const;

/** Floor applied to regime alignment so low confidence still scores something. */
export const REGIME_CONFIDENCE_FLOOR = 0.6;

/**
 * Opening-range scoring is bonus evidence, never a requirement: a supportive
 * position inside the range still earns most of the sub-weight, so an inside-
 * range setup can reach A+ on the strength of everything else.
 */
export const OPENING_RANGE_FACTORS = {
  confirmedBreak: 1,
  sustainedBreak: 1,
  supportiveInsideRange: 0.8,
  neutralInsideRange: 0.5,
  rejectedBreak: 0.25,
  againstDirection: 0.15,
  unavailable: 0.5,
} as const;

/** Sub-weights inside momentum + volume, in points out of the category. */
export const MOMENTUM_SUB_WEIGHTS = {
  relativeVolume: 6,
  trendStrengthening: 5,
  participation: 4,
} as const;

export const MOMENTUM_THRESHOLDS = {
  strongRelativeVolume: 1.5,
  healthyRelativeVolume: 1,
  weakRelativeVolume: 0.7,
  strongAdx: 25,
  moderateAdx: 20,
  strongDiSpread: 10,
  moderateDiSpread: 5,
} as const;

/** Sub-weights inside option quality, in points out of the category. */
export const OPTION_QUALITY_SUB_WEIGHTS = {
  delta: 5,
  liquidity: 4,
  spread: 4,
  dte: 3,
  budgetFit: 2,
  selectionConfidence: 2,
} as const;

export const OPTION_QUALITY_THRESHOLDS = {
  idealDeltaLow: 0.35,
  idealDeltaHigh: 0.65,
  acceptableDeltaLow: 0.2,
  weakDelta: 0.15,
  healthyVolume: 500,
  healthyOpenInterest: 1000,
  minimumVolume: 50,
  minimumOpenInterest: 100,
  tightSpreadPercent: 5,
  acceptableSpreadPercent: 10,
  idealMinDte: 1,
  idealMaxDte: 7,
  acceptableMaxDte: 14,
  /** Share of the spread sub-weight kept when no quote exists at all. */
  unverifiedSpreadFactor: 0.4,
  /** Share of the budget sub-weight kept when cost came from last price. */
  estimatedCostFactor: 0.6,
} as const;

/** Neutral news/volatility earns the middle of its category, not zero. */
export const CONTEXT_BASELINE_FACTOR = 0.6;

/**
 * Share of the distance between neutral and a categorical news factor that a
 * zero-confidence read earns, so a 0.35-confidence RISK_OFF cannot score like
 * a conviction call.
 */
export const NEWS_CONFIDENCE_FLOOR = 0.3;

export const NEWS_FACTORS = {
  strongConfirmation: 1,
  confirmation: 0.85,
  neutral: CONTEXT_BASELINE_FACTOR,
  conflict: 0.3,
  strongConflict: 0.1,
} as const;

export const VOLATILITY_FACTORS = {
  confirms: 1,
  neutral: CONTEXT_BASELINE_FACTOR,
  diverges: 0.3,
  conflicts: 0.15,
} as const;

/** Lower bound of each grade on the normalized 0–100 decision score. */
export const GRADE_THRESHOLDS: readonly {
  grade: SetupGrade;
  minScore: number;
}[] = [
  { grade: SetupGrade.A_PLUS, minScore: 90 },
  { grade: SetupGrade.A, minScore: 83 },
  { grade: SetupGrade.B_PLUS, minScore: 76 },
  { grade: SetupGrade.B, minScore: 69 },
  { grade: SetupGrade.C_PLUS, minScore: 60 },
  { grade: SetupGrade.C, minScore: 0 },
];

/** Points deducted from the normalized score, once per distinct conflict. */
export const CONFLICT_PENALTIES: Record<ConflictSeverity, number> = {
  [ConflictSeverity.MINOR]: 0,
  [ConflictSeverity.MODERATE]: 3,
  [ConflictSeverity.MAJOR]: 8,
  [ConflictSeverity.CRITICAL]: 20,
};

/** A B+ setup still needs a clean board to become TRADE. */
export const DECISION_GUARDS = {
  maxModerateConflictsForTrade: 1,
  minScoreForTrade: 76,
} as const;

/**
 * Age, in minutes, beyond which the newest completed candle makes the core
 * market data too stale to act on during regular trading hours.
 */
export const STALE_MARKET_DATA_MINUTES = 15;

export const CONFIDENCE_WEIGHTS = {
  signal: 0.25,
  regime: 0.2,
  optionSelection: 0.2,
  agreement: 0.15,
  dataQuality: 0.1,
  gradeMargin: 0.1,
} as const;

export const CONFIDENCE_PENALTIES = {
  perMissingOptionalCategory: 0.05,
  perMajorConflict: 0.08,
  perModerateConflict: 0.03,
  settlingSession: 0.1,
} as const;
