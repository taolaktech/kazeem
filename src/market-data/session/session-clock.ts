import type { MarketCandle } from '../interfaces/market-candle.interface.js';
import { MarketSession, type CandlePhase } from './market-session.enum.js';

export const MARKET_TIMEZONE = 'America/New_York';

/** Session boundaries, as minutes after midnight in {@link MARKET_TIMEZONE}. */
export const PREMARKET_OPEN_MINUTE = 4 * 60;
export const REGULAR_OPEN_MINUTE = 9 * 60 + 30;
export const REGULAR_CLOSE_MINUTE = 16 * 60;
export const AFTER_HOURS_CLOSE_MINUTE = 20 * 60;

const MILLISECONDS_PER_MINUTE = 60_000;

/**
 * Offsets are resolved by the runtime's IANA database rather than a hardcoded
 * EST/EDT shift, so every calculation stays correct across DST transitions.
 */
const easternFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: MARKET_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  weekday: 'short',
});

export interface EasternMoment {
  /** Calendar day in New York, as YYYY-MM-DD. */
  date: string;
  /** Minutes after New York midnight. */
  minutesOfDay: number;
  weekday: string;
  isWeekend: boolean;
}

export function toEastern(date: Date): EasternMoment {
  const parts = easternFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  const hour = Number(value('hour')) % 24;
  const minute = Number(value('minute'));
  const weekday = value('weekday');

  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minutesOfDay: hour * 60 + minute,
    weekday,
    isWeekend: weekday === 'Sat' || weekday === 'Sun',
  };
}

/**
 * Resolves the session state from the wall clock. `settlementMinutes` is how
 * long after the 09:30 open prices are considered to still be settling.
 */
export function resolveMarketSession(
  now: Date,
  settlementMinutes: number,
): MarketSession {
  const { minutesOfDay, isWeekend } = toEastern(now);
  if (isWeekend) {
    return MarketSession.CLOSED;
  }
  if (minutesOfDay < PREMARKET_OPEN_MINUTE) {
    return MarketSession.CLOSED;
  }
  if (minutesOfDay < REGULAR_OPEN_MINUTE) {
    return MarketSession.PREMARKET;
  }
  if (minutesOfDay < REGULAR_OPEN_MINUTE + settlementMinutes) {
    return MarketSession.OPENING_SETTLEMENT;
  }
  if (minutesOfDay < REGULAR_CLOSE_MINUTE) {
    return MarketSession.REGULAR;
  }
  return minutesOfDay < AFTER_HOURS_CLOSE_MINUTE
    ? MarketSession.AFTER_HOURS
    : MarketSession.CLOSED;
}

/** Phase of the trading day the candle's opening timestamp falls in. */
export function candlePhase(candle: MarketCandle): CandlePhase {
  const { minutesOfDay, isWeekend } = toEastern(candle.timestamp);
  if (isWeekend) {
    return 'CLOSED';
  }
  if (minutesOfDay < PREMARKET_OPEN_MINUTE) {
    return 'CLOSED';
  }
  if (minutesOfDay < REGULAR_OPEN_MINUTE) {
    return 'PREMARKET';
  }
  if (minutesOfDay < REGULAR_CLOSE_MINUTE) {
    return 'REGULAR';
  }
  return minutesOfDay < AFTER_HOURS_CLOSE_MINUTE ? 'AFTER_HOURS' : 'CLOSED';
}

/** End of the bar that opened at `candle.timestamp`. */
export function candleCloseTime(
  candle: MarketCandle,
  timeframeMinutes: number,
): Date {
  return new Date(
    candle.timestamp.getTime() + timeframeMinutes * MILLISECONDS_PER_MINUTE,
  );
}

/**
 * A bar counts as market evidence only once its interval has elapsed, so the
 * currently forming candle is never treated as completed.
 */
export function isCompletedCandle(
  candle: MarketCandle,
  timeframeMinutes: number,
  now: Date,
): boolean {
  return candleCloseTime(candle, timeframeMinutes).getTime() <= now.getTime();
}
