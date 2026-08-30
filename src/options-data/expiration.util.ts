const EXCHANGE_TIME_ZONE = 'America/New_York';
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const exchangeDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: EXCHANGE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar date at the exchange (US/Eastern) for `instant`, as `YYYY-MM-DD`. */
export function toExchangeDate(instant: Date): string {
  return exchangeDateFormatter.format(instant);
}

/** Parses a `YYYY-MM-DD` day into its 00:00 UTC instant, or null when invalid. */
export function parseExpirationDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    !parsed.toISOString().startsWith(value)
  ) {
    return null;
  }
  return parsed;
}

/**
 * Whole calendar days from today's exchange date to the expiration day.
 * `0` means the contract expires during today's session (0DTE). Weekends and
 * market holidays are counted, since expirations themselves are calendar dates.
 */
export function daysToExpiration(expiration: Date, now: Date): number {
  const today = new Date(`${toExchangeDate(now)}T00:00:00.000Z`).getTime();
  return Math.round((expiration.getTime() - today) / MILLISECONDS_PER_DAY);
}

/** Adds `days` calendar days to today's exchange date, as `YYYY-MM-DD`. */
export function exchangeDatePlusDays(now: Date, days: number): string {
  const today = new Date(`${toExchangeDate(now)}T00:00:00.000Z`).getTime();
  return new Date(today + days * MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}
