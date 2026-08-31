import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { filterRegularSession } from './candle-normalizer.js';
import type { MarketCandle } from './interfaces/market-candle.interface.js';
import {
  MARKET_SESSION_CONFIG_KEY,
  MASSIVE_CONFIG_KEY,
  type MarketSessionConfig,
  type MassiveConfig,
} from './market-data.config.js';
import { MassiveService } from './massive.service.js';
import type { MarketSessionSnapshot } from './session/session-context.interface.js';
import { partitionSessionCandles } from './session/session-partition.js';

/** Fallback size of the indicator window when no caller override is given. */
export const DEFAULT_CANDLE_COUNT = 80;

/** Minutes in one US regular trading session (09:30–16:00 ET). */
const REGULAR_SESSION_MINUTES = 390;
/** Calendar days per trading week, used to absorb weekends. */
const CALENDAR_DAYS_PER_TRADING_WEEK = 7 / 5;
/** Extra calendar days requested to absorb market holidays and long weekends. */
const HOLIDAY_BUFFER_DAYS = 5;
const MIN_LOOKBACK_DAYS = 7;
const MAX_LOOKBACK_DAYS = 60;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface SessionSnapshotOptions {
  /** Evaluation instant; injectable so session behaviour is testable. */
  now?: Date;
  /** Overrides the configured maximum indicator history. */
  maxIndicatorCandles?: number;
}

/**
 * Provider-agnostic entry point for market data. Callers receive canonical
 * candles and never see provider-specific payloads.
 */
@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly config: MassiveConfig;
  private readonly sessionConfig: MarketSessionConfig;

  constructor(
    private readonly provider: MassiveService,
    configService: ConfigService,
  ) {
    this.config = configService.getOrThrow<MassiveConfig>(MASSIVE_CONFIG_KEY);
    this.sessionConfig = configService.getOrThrow<MarketSessionConfig>(
      MARKET_SESSION_CONFIG_KEY,
    );
  }

  get primaryTimeframeMinutes(): number {
    return this.sessionConfig.primaryTimeframeMinutes;
  }

  /**
   * Single provider request, partitioned into previous-session warm-up
   * history, completed current-session candles and premarket context. The
   * partition is what makes recent evidence distinguishable from history.
   */
  async getSessionSnapshot(
    symbol: string,
    options: SessionSnapshotOptions = {},
  ): Promise<MarketSessionSnapshot> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const now = options.now ?? new Date();
    const maxIndicatorCandles =
      options.maxIndicatorCandles ?? this.sessionConfig.maxIndicatorCandles;

    const candles = await this.fetch(
      normalizedSymbol,
      // Two sessions of warm-up plus the holiday buffer is enough for the
      // indicator window; the extended-hours bars come from the same request.
      this.lookbackDaysFor(maxIndicatorCandles * 2),
      now,
    );
    if (candles.length === 0) {
      throw new NotFoundException(
        `No market data found for symbol ${normalizedSymbol}`,
      );
    }

    const snapshot = partitionSessionCandles(candles, {
      symbol: normalizedSymbol,
      now,
      timeframeMinutes: this.sessionConfig.primaryTimeframeMinutes,
      maxIndicatorCandles,
      openingSettlementMinutes: this.sessionConfig.openingSettlementMinutes,
    });

    this.logger.log(
      `${normalizedSymbol}: ${snapshot.context.marketSession}, ${snapshot.context.currentSessionCandleCount} current-session and ${snapshot.context.previousSessionWarmupCandleCount} warm-up candle(s)`,
    );

    return snapshot;
  }

  /**
   * Returns up to `count` of the most recent completed regular-session candles
   * at the configured primary timeframe. The lookback window is expressed in
   * calendar days and deliberately over-requests, because weekends, holidays
   * and overnight gaps mean N calendar minutes never equal N trading candles.
   */
  async getRecentCandles(
    symbol: string,
    count: number = DEFAULT_CANDLE_COUNT,
  ): Promise<MarketCandle[]> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const lookbackDays = this.lookbackDaysFor(count);
    const candles = await this.fetch(
      normalizedSymbol,
      lookbackDays,
      new Date(),
    );

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
        `Only ${recent.length} of the requested ${count} candle(s) were available for ${normalizedSymbol} over the last ${lookbackDays} calendar day(s)`,
      );
    }

    return recent;
  }

  /**
   * Latest traded price for `symbol`, taken from the close of the most recent
   * regular-session candle.
   */
  async getLatestPrice(symbol: string): Promise<number> {
    const [candle] = await this.getRecentCandles(symbol, 1);
    return candle.close;
  }

  private fetch(
    symbol: string,
    lookbackDays: number,
    now: Date,
  ): Promise<MarketCandle[]> {
    return this.provider.getHistoricalCandles(symbol, {
      multiplier: this.sessionConfig.primaryTimeframeMinutes,
      timespan: 'minute',
      from: toDateString(
        new Date(now.getTime() - lookbackDays * MILLISECONDS_PER_DAY),
      ),
      to: toDateString(now),
    });
  }

  private lookbackDaysFor(count: number): number {
    const candlesPerSession = Math.max(
      1,
      Math.floor(
        REGULAR_SESSION_MINUTES / this.sessionConfig.primaryTimeframeMinutes,
      ),
    );
    const tradingDays = Math.ceil(Math.max(count, 1) / candlesPerSession);
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
