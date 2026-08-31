import {
  RECENCY_WEIGHT_BANDS,
  STALE_RECENCY_WEIGHT,
} from '../constants/news-intelligence-thresholds.js';

export function ageInHours(publishedAt: Date, now: Date): number {
  const ms = now.getTime() - publishedAt.getTime();
  if (!Number.isFinite(ms)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, ms) / 3_600_000;
}

/** Band-based recency weight; older stories keep only a residual weight. */
export function recencyWeight(publishedAt: Date, now: Date): number {
  const age = ageInHours(publishedAt, now);
  for (const band of RECENCY_WEIGHT_BANDS) {
    if (age < band.maxAgeHours) {
      return band.weight;
    }
  }
  return STALE_RECENCY_WEIGHT;
}

export function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}
