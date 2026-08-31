import {
  PRIOR_SESSION_FACTOR,
  RECENCY_WEIGHT_BANDS,
  STALE_RECENCY_WEIGHT,
} from '../constants/news-intelligence-thresholds.js';

const EASTERN_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function ageInHours(publishedAt: Date, now: Date): number {
  const ms = now.getTime() - publishedAt.getTime();
  if (!Number.isFinite(ms)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, ms) / 3_600_000;
}

/** Calendar date in US/Eastern, the session boundary US equities trade on. */
export function easternSessionDate(value: Date): string {
  return EASTERN_DATE.format(value);
}

export function isSameSession(publishedAt: Date, now: Date): boolean {
  return easternSessionDate(publishedAt) === easternSessionDate(now);
}

/**
 * Band-based recency weight, discounted further once a story predates the
 * current US/Eastern session: day-trading cares about what is happening now,
 * but overnight news still explains the open, so it is never zeroed out.
 */
export function recencyWeight(publishedAt: Date, now: Date): number {
  const age = ageInHours(publishedAt, now);
  const band =
    RECENCY_WEIGHT_BANDS.find((candidate) => age < candidate.maxAgeHours)
      ?.weight ?? STALE_RECENCY_WEIGHT;
  return isSameSession(publishedAt, now) ? band : band * PRIOR_SESSION_FACTOR;
}

export function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}
