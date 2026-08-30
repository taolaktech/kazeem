import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { filterRegularSession } from './candle-normalizer.js';
import type { MarketCandle } from './interfaces/market-candle.interface.js';
import {
  MASSIVE_CONFIG_KEY,
  type MassiveConfig,
} from './market-data.config.js';
import { MassiveService } from './massive.service.js';

export const DEFAULT_CANDLE_COUNT = 500;

/** Minute bars in one US regular trading session (09:30–16:00 ET). */
const CANDLES_PER_TRADING_DAY = 390;
/** Calendar days per trading week, used to absorb weekends. */
const CALENDAR_DAYS_PER_TRADING_WEEK = 7 / 5;
/** Extra calendar days requested to absorb market holidays and long weekends. */
const HOLIDAY_BUFFER_DAYS = 5;
const MIN_LOOKBACK_DAYS = 7;
const MAX_LOOKBACK_DAYS = 60;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Provider-agnostic entry point for market data. Callers receive canonical
 * candles and never see provider-specific payloads.
 */
@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly config: MassiveConfig;

  constructor(
    private readonly provider: MassiveService,
    configService: ConfigService,
  ) {
    this.config = configService.getOrThrow<MassiveConfig>(MASSIVE_CONFIG_KEY);
  }

  /**
   * Returns up to `count` of the most recent 1-minute candles for `symbol`.
   * The lookback window is expressed in calendar days and deliberately
   * over-requests, because weekends, holidays and overnight gaps mean N
   * calendar minutes never equal N trading candles.
   */
  async getRecentMinuteCandles(
    symbol: string,
    count: number = DEFAULT_CANDLE_COUNT,
  ): Promise<MarketCandle[]> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const lookbackDays = this.lookbackDaysFor(count);
    const now = new Date();

    const candles = await this.provider.getHistoricalCandles(normalizedSymbol, {
      multiplier: 1,
      timespan: 'minute',
      from: toDateString(
        new Date(now.getTime() - lookbackDays * MILLISECONDS_PER_DAY),
      ),
      to: toDateString(now),
    });

    const sessionCandles = this.config.regularHoursOnly
      ? filterRegularSession(candles)
      : candles;

    if (sessionCandles.length === 0) {
      throw new NotFoundException(
        `No market data found for symbol ${normalizedSymbol}`,
      );
    }

    const recent = sessionCandles.slice(-count);
    if (recent.length < count) {
      this.logger.warn(
        `Only ${recent.length} of the requested ${count} minute candle(s) were available for ${normalizedSymbol} over the last ${lookbackDays} calendar day(s)`,
      );
    }

    return recent;
  }

  /**
   * Latest traded price for `symbol`, taken from the close of the most recent
   * 1-minute candle. Subject to the same session filtering as candle fetches.
   */
  async getLatestPrice(symbol: string): Promise<number> {
    const [candle] = await this.getRecentMinuteCandles(symbol, 1);
    return candle.close;
  }

  private lookbackDaysFor(count: number): number {
    const tradingDays = Math.ceil(Math.max(count, 1) / CANDLES_PER_TRADING_DAY);
    const days =
      Math.ceil(tradingDays * CALENDAR_DAYS_PER_TRADING_WEEK) +
      HOLIDAY_BUFFER_DAYS;
    return Math.min(Math.max(days, MIN_LOOKBACK_DAYS), MAX_LOOKBACK_DAYS);
  }
}

/** Massive expects range bounds as YYYY-MM-DD dates. */
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
