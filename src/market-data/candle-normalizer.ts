import type { MarketCandle } from './interfaces/market-candle.interface.js';
import { isMassiveAggregate, type MassiveAggregate } from './massive.types.js';

export interface NormalizationResult {
  candles: MarketCandle[];
  rejected: number;
  duplicates: number;
}

/**
 * Converts raw provider aggregates into canonical candles: invalid bars are
 * dropped, the series is sorted oldest to newest and duplicate timestamps keep
 * only their most recent occurrence.
 */
export function normalizeAggregates(
  aggregates: readonly unknown[],
): NormalizationResult {
  let rejected = 0;
  const byTimestamp = new Map<number, MarketCandle>();

  for (const aggregate of aggregates) {
    if (!isMassiveAggregate(aggregate)) {
      rejected += 1;
      continue;
    }
    const candle = toCandle(aggregate);
    if (candle === undefined) {
      rejected += 1;
      continue;
    }
    byTimestamp.set(candle.timestamp.getTime(), candle);
  }

  const duplicates = aggregates.length - rejected - byTimestamp.size;
  const candles = [...byTimestamp.values()].sort(
    (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
  );

  return { candles, rejected, duplicates };
}

function toCandle(aggregate: MassiveAggregate): MarketCandle | undefined {
  const { o: open, h: high, l: low, c: close, v: volume, t } = aggregate;

  if (![open, high, low, close, volume, t].every(Number.isFinite)) {
    return undefined;
  }
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) {
    return undefined;
  }
  if (high < low || high < open || high < close || low > open || low > close) {
    return undefined;
  }

  const timestamp = new Date(t);
  if (Number.isNaN(timestamp.getTime())) {
    return undefined;
  }

  return { timestamp, open, high, low, close, volume };
}

const REGULAR_SESSION_OPEN_MINUTE = 9 * 60 + 30;
const REGULAR_SESSION_CLOSE_MINUTE = 16 * 60;

const easternTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  weekday: 'short',
});

/**
 * Massive aggregates cover pre-market and after-hours trading, so bars outside
 * the 09:30–16:00 ET regular session are filtered out here.
 */
export function filterRegularSession(
  candles: readonly MarketCandle[],
): MarketCandle[] {
  return candles.filter((candle) => {
    const parts = easternTimeFormatter.formatToParts(candle.timestamp);
    const weekday = parts.find((part) => part.type === 'weekday')?.value;
    if (weekday === 'Sat' || weekday === 'Sun') {
      return false;
    }
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return false;
    }
    const minutesOfDay = (hour % 24) * 60 + minute;
    return (
      minutesOfDay >= REGULAR_SESSION_OPEN_MINUTE &&
      minutesOfDay < REGULAR_SESSION_CLOSE_MINUTE
    );
  });
}
