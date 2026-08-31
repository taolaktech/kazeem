import { CatalystType } from '../enums/catalyst-type.enum.js';
import { NewsImpact } from '../enums/news-impact.enum.js';

export const DEFAULT_LOOKBACK_HOURS = 24;
export const MAX_LOOKBACK_HOURS = 72;
export const DEFAULT_ARTICLE_LIMIT = 30;
export const MAX_ARTICLE_LIMIT = 100;

/** Articles a provider may return before the service trims by relevance. */
export const PROVIDER_FETCH_MULTIPLIER = 2;

/** Recency weights, newest band first. Bounds are exclusive upper hours. */
export const RECENCY_WEIGHT_BANDS: readonly {
  maxAgeHours: number;
  weight: number;
}[] = [
  { maxAgeHours: 1, weight: 1 },
  { maxAgeHours: 4, weight: 0.8 },
  { maxAgeHours: 12, weight: 0.5 },
  { maxAgeHours: 24, weight: 0.3 },
];

/** Weight applied to anything older than the last band. */
export const STALE_RECENCY_WEIGHT = 0.1;

/** Relative contribution of each relevance component; sums to 1. */
export const RELEVANCE_WEIGHTS = {
  directSymbol: 0.34,
  entity: 0.16,
  symbolContext: 0.2,
  macro: 0.12,
  catalystImportance: 0.1,
  recency: 0.08,
} as const;

/** Articles under this relevance never reach HIGH impact. */
export const HIGH_IMPACT_RELEVANCE_THRESHOLD = 0.55;
export const MEDIUM_IMPACT_RELEVANCE_THRESHOLD = 0.3;

/** Below this, an article contributes nothing to the aggregate direction. */
export const AGGREGATION_RELEVANCE_FLOOR = 0.2;

export const IMPACT_WEIGHTS: Record<NewsImpact, number> = {
  [NewsImpact.HIGH]: 1,
  [NewsImpact.MEDIUM]: 0.5,
  [NewsImpact.LOW]: 0.2,
};

/** Catalysts capable of moving an entire index on their own. */
export const HIGH_IMPACT_CATALYSTS: readonly CatalystType[] = [
  CatalystType.FEDERAL_RESERVE,
  CatalystType.INTEREST_RATES,
  CatalystType.CPI,
  CatalystType.PPI,
  CatalystType.INFLATION,
  CatalystType.JOBS,
  CatalystType.GDP,
  CatalystType.TREASURY_YIELDS,
  CatalystType.GEOPOLITICAL,
  CatalystType.TARIFFS,
  CatalystType.CREDIT,
  CatalystType.MARKET_MOVING,
];

/** Catalysts that matter for an issuer or a sector but rarely for the tape. */
export const MEDIUM_IMPACT_CATALYSTS: readonly CatalystType[] = [
  CatalystType.EARNINGS,
  CatalystType.GUIDANCE,
  CatalystType.REGULATORY,
  CatalystType.LEGAL,
  CatalystType.MERGER_ACQUISITION,
  CatalystType.SEMICONDUCTORS,
  CatalystType.AI,
  CatalystType.ENERGY,
  CatalystType.ANALYST_UPGRADE,
  CatalystType.ANALYST_DOWNGRADE,
];

/** Minimum share of directional weight one side needs to own the verdict. */
export const DOMINANCE_THRESHOLD = 0.65;

/** Directional weight below which the aggregate stays NEUTRAL. */
export const MIN_DIRECTIONAL_WEIGHT = 0.25;

export const LOW_CONFIDENCE_THRESHOLD = 0.35;

/** Article count below which recent coverage is treated as thin. */
export const LIMITED_NEWS_ARTICLE_COUNT = 3;

/** Token overlap at which two headlines are treated as the same story. */
export const DUPLICATE_TITLE_SIMILARITY = 0.72;

/** Publication gap within which similar headlines can be duplicates. */
export const DUPLICATE_TIME_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Catalysts reported as dominant, at most this many. */
export const MAX_DOMINANT_CATALYSTS = 4;
