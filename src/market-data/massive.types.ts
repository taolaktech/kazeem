/** Shape of a single aggregate bar returned by the Massive REST API. */
export interface MassiveAggregate {
  /** Open. */
  o: number;
  /** High. */
  h: number;
  /** Low. */
  l: number;
  /** Close. */
  c: number;
  /** Volume. Index aggregates carry no volume. */
  v?: number;
  /** Volume weighted average price. */
  vw?: number;
  /** Bar start, Unix milliseconds. */
  t: number;
  /** Number of transactions. */
  n?: number;
}

export interface MassiveAggregatesResponse {
  ticker?: string;
  status?: string;
  adjusted?: boolean;
  queryCount?: number;
  resultsCount?: number;
  request_id?: string;
  results?: MassiveAggregate[];
  next_url?: string;
  error?: string;
  message?: string;
}

export function isMassiveAggregate(value: unknown): value is MassiveAggregate {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.o === 'number' &&
    typeof candidate.h === 'number' &&
    typeof candidate.l === 'number' &&
    typeof candidate.c === 'number' &&
    (typeof candidate.v === 'number' || candidate.v === undefined) &&
    typeof candidate.t === 'number'
  );
}

export function isMassiveAggregatesResponse(
  value: unknown,
): value is MassiveAggregatesResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.results === undefined || Array.isArray(candidate.results);
}
