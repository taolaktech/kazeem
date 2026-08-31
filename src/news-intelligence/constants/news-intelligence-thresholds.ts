import { NewsImpact } from '../enums/news-impact.enum.js';
import { NewsScope } from '../enums/news-scope.enum.js';

export const DEFAULT_LOOKBACK_HOURS = 24;
export const MAX_LOOKBACK_HOURS = 72;
export const DEFAULT_ARTICLE_LIMIT = 30;
export const MAX_ARTICLE_LIMIT = 100;

/** Articles a provider may return before the service trims by relevance. */
export const PROVIDER_FETCH_MULTIPLIER = 2;

/**
 * Recency weights, newest band first, tuned for intraday use: a print from the
 * last half hour carries far more than an overnight story. Bounds are
 * exclusive upper hours.
 */
export const RECENCY_WEIGHT_BANDS: readonly {
  maxAgeHours: number;
  weight: number;
}[] = [
  { maxAgeHours: 0.5, weight: 1 },
  { maxAgeHours: 1, weight: 0.95 },
  { maxAgeHours: 4, weight: 0.85 },
  { maxAgeHours: 12, weight: 0.6 },
  { maxAgeHours: 24, weight: 0.35 },
];

/** Weight applied to anything older than the last band. */
export const STALE_RECENCY_WEIGHT = 0.15;

/**
 * Applied to stories published before the current US/Eastern session date.
 * Overnight news still explains the opening regime, so it is discounted
 * rather than discarded.
 */
export const PRIOR_SESSION_FACTOR = 0.75;

/** Relative contribution of each relevance component; sums to 1. */
export const RELEVANCE_WEIGHTS = {
  directSymbol: 0.34,
  entity: 0.14,
  symbolContext: 0.18,
  macro: 0.14,
  catalystImportance: 0.12,
  recency: 0.08,
} as const;

/** Composite impact score at which an article becomes HIGH / MEDIUM impact. */
export const HIGH_IMPACT_SCORE = 0.55;
export const MEDIUM_IMPACT_SCORE = 0.3;

/**
 * How much of the market an article's scope can move, before relevance is
 * applied. A story naming the requested symbol always counts as full breadth.
 */
export const SCOPE_BREADTH: Record<NewsScope, number> = {
  [NewsScope.MACRO]: 1,
  [NewsScope.MARKET]: 0.95,
  [NewsScope.SECTOR]: 0.8,
  [NewsScope.SYMBOL]: 0.7,
};

/** Below this, an article contributes nothing to the aggregate direction. */
export const AGGREGATION_RELEVANCE_FLOOR = 0.2;

export const IMPACT_WEIGHTS: Record<NewsImpact, number> = {
  [NewsImpact.HIGH]: 1,
  [NewsImpact.MEDIUM]: 0.5,
  [NewsImpact.LOW]: 0.2,
};

/** Severity at which a catalyst is treated as a broad risk event. */
export const BROAD_RISK_SEVERITY = 0.7;

/** Minimum share of directional weight one side needs to own the verdict. */
export const DOMINANCE_THRESHOLD = 0.65;

/** Directional weight below which the aggregate stays NEUTRAL. */
export const MIN_DIRECTIONAL_WEIGHT = 0.25;

/** Risk-bias weight below which the aggregate risk environment stays NEUTRAL. */
export const MIN_RISK_BIAS_WEIGHT = 0.15;

/** Minimum share of risk weight one side needs to own the risk verdict. */
export const RISK_DOMINANCE_THRESHOLD = 0.6;

export const LOW_CONFIDENCE_THRESHOLD = 0.35;

/** Article count below which recent coverage is treated as thin. */
export const LIMITED_NEWS_ARTICLE_COUNT = 3;

/** Token overlap at which two headlines are treated as the same story. */
export const DUPLICATE_TITLE_SIMILARITY = 0.72;

/** Publication gap within which similar headlines can be duplicates. */
export const DUPLICATE_TIME_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Catalysts reported as dominant, at most this many. */
export const MAX_DOMINANT_CATALYSTS = 4;
