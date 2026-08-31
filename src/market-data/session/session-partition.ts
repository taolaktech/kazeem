import type { MarketCandle } from '../interfaces/market-candle.interface.js';
import { MarketSession } from './market-session.enum.js';
import {
  buildCurrentSessionFeatures,
  buildPremarketContext,
  buildPreviousSessionContext,
} from './session-features.js';
import {
  candlePhase,
  isCompletedCandle,
  MARKET_TIMEZONE,
  resolveMarketSession,
  toEastern,
} from './session-clock.js';
import {
  MATURITY_THRESHOLDS,
  resolveSessionMaturity,
} from './session-maturity.js';
import type { MarketSessionSnapshot } from './session-context.interface.js';
import { buildOpeningRangeContext } from './opening-range.js';

export interface PartitionOptions {
  symbol: string;
  now: Date;
  timeframeMinutes: number;
  /** Upper bound on the indicator window; not a minimum before evaluating. */
  maxIndicatorCandles: number;
  openingSettlementMinutes: number;
  /** Minutes after the 09:30 ET open that define the opening range. */
  openingRangeMinutes?: number;
  openingRangeBreakoutTolerancePercent?: number;
}

/**
 * Splits one raw candle series into previous-session warm-up history, current
 * regular-session evidence and premarket context. After-hours bars and the
 * still-forming candle never reach any of the three.
 */
export function partitionSessionCandles(
  candles: readonly MarketCandle[],
  options: PartitionOptions,
): MarketSessionSnapshot {
  const {
    symbol,
    now,
    timeframeMinutes,
    maxIndicatorCandles,
    openingSettlementMinutes,
  } = options;
  const warnings: string[] = [];

  const completed = candles.filter((candle) =>
    isCompletedCandle(candle, timeframeMinutes, now),
  );
  const incomplete = candles.length - completed.length;
  if (incomplete > 0) {
    warnings.push(
      `${incomplete} still-forming ${timeframeMinutes}-minute candle(s) were excluded.`,
    );
  }

  const regularByDate = new Map<string, MarketCandle[]>();
  const premarketByDate = new Map<string, MarketCandle[]>();
  let afterHours = 0;

  for (const candle of completed) {
    const phase = candlePhase(candle);
    const { date } = toEastern(candle.timestamp);
    if (phase === 'REGULAR') {
      append(regularByDate, date, candle);
    } else if (phase === 'PREMARKET') {
      append(premarketByDate, date, candle);
    } else {
      afterHours += 1;
    }
  }
  if (afterHours > 0) {
    warnings.push(
      `${afterHours} after-hours candle(s) were excluded from regular-session evidence.`,
    );
  }

  // The current session is today when the market has produced any bar today,
  // otherwise the most recent day that did — which also covers holidays.
  const today = toEastern(now).date;
  const sessionDate =
    regularByDate.has(today) || premarketByDate.has(today)
      ? today
      : (latestDate([...regularByDate.keys()]) ?? today);

  const currentSessionCandles = regularByDate.get(sessionDate) ?? [];
  const premarketCandles = premarketByDate.get(sessionDate) ?? [];

  const previousDates = [...regularByDate.keys()]
    .filter((date) => date < sessionDate)
    .sort();
  const previousSessionDate = previousDates[previousDates.length - 1] ?? null;
  const previousSessionCandles =
    previousSessionDate === null
      ? []
      : (regularByDate.get(previousSessionDate) ?? []);
  const warmupCandles = previousDates.flatMap(
    (date) => regularByDate.get(date) ?? [],
  );

  const indicatorCandles = [...warmupCandles, ...currentSessionCandles].slice(
    -maxIndicatorCandles,
  );
  const previousSessionWarmupCandleCount = Math.max(
    0,
    indicatorCandles.length - currentSessionCandles.length,
  );

  const previousSession = buildPreviousSessionContext(
    previousSessionCandles,
    previousSessionDate,
  );
  const premarket = buildPremarketContext(
    premarketCandles,
    previousSession.previousClose,
  );
  const currentSessionFeatures = buildCurrentSessionFeatures(
    currentSessionCandles,
    premarket,
  );
  const openingRangeMinutes =
    options.openingRangeMinutes ?? openingSettlementMinutes;
  const openingRange = buildOpeningRangeContext(currentSessionCandles, {
    now,
    sessionDate,
    timeframeMinutes,
    windowMinutes: openingRangeMinutes,
    breakoutTolerancePercent: options.openingRangeBreakoutTolerancePercent,
  });

  const marketSession = resolveMarketSession(now, openingSettlementMinutes);
  const sessionMaturity = resolveSessionMaturity(
    marketSession,
    currentSessionCandles.length,
  );
  const tradeEvaluationAllowed =
    marketSession === MarketSession.REGULAR &&
    sessionDate === today &&
    currentSessionCandles.length >= MATURITY_THRESHOLDS.early;

  if (marketSession === MarketSession.OPENING_SETTLEMENT) {
    warnings.push(
      `Opening ${openingSettlementMinutes}-minute settlement period active.`,
    );
  }
  if (sessionDate !== today) {
    warnings.push(
      `No candles are available for ${today}; current-session evidence comes from ${sessionDate}.`,
    );
  }

  return {
    symbol,
    asOf: now,
    context: {
      timezone: MARKET_TIMEZONE,
      marketSession,
      sessionMaturity,
      timeframeMinutes,
      openingSettlementMinutes,
      tradeEvaluationAllowed,
      sessionDate,
      currentSessionCandleCount: currentSessionCandles.length,
      indicatorCandleCount: indicatorCandles.length,
      previousSessionWarmupCandleCount,
      premarketCandleCount: premarketCandles.length,
      openingRangeMinutes,
    },
    indicatorCandles,
    currentSessionCandles,
    premarketCandles,
    premarket,
    openingRange,
    previousSession,
    currentSessionFeatures,
    warnings,
  };
}

function append(
  buckets: Map<string, MarketCandle[]>,
  date: string,
  candle: MarketCandle,
): void {
  const existing = buckets.get(date);
  if (existing === undefined) {
    buckets.set(date, [candle]);
    return;
  }
  existing.push(candle);
}

function latestDate(dates: string[]): string | undefined {
  return [...dates].sort().pop();
}
