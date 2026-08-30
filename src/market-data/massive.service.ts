import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { normalizeAggregates } from './candle-normalizer.js';
import type {
  HistoricalCandlesOptions,
  MarketCandle,
  MarketDataProvider,
} from './interfaces/market-candle.interface.js';
import { MassiveHttpClient } from './massive-http.client.js';
import type { MassiveConfig } from './market-data.config.js';
import {
  isMassiveAggregatesResponse,
  type MassiveAggregate,
  type MassiveAggregatesResponse,
} from './massive.types.js';

/** Maximum bars Massive returns for a single aggregates request. */
const MASSIVE_PAGE_LIMIT = 50_000;

/**
 * Adapter for the Massive REST API. Every Massive-specific detail — URLs,
 * headers, field names, pagination — stays inside this class; callers only ever
 * receive canonical {@link MarketCandle} values.
 */
@Injectable()
export class MassiveService implements MarketDataProvider {
  private readonly logger = new Logger(MassiveService.name);
  private readonly config: MassiveConfig;

  constructor(private readonly http: MassiveHttpClient) {
    this.config = http.config;
  }

  async getHistoricalCandles(
    symbol: string,
    options: HistoricalCandlesOptions,
  ): Promise<MarketCandle[]> {
    const { multiplier, timespan, from, to } = options;
    const startedAt = Date.now();
    this.logger.log(
      `Fetching ${multiplier}-${timespan} candles for ${symbol} from ${from} to ${to}`,
    );

    const url = new URL(
      `${this.config.restBaseUrl}/v2/aggs/ticker/${encodeURIComponent(
        symbol,
      )}/range/${multiplier}/${timespan}/${encodeURIComponent(
        from,
      )}/${encodeURIComponent(to)}`,
    );
    url.searchParams.set('adjusted', 'true');
    url.searchParams.set('sort', 'asc');
    url.searchParams.set('limit', String(MASSIVE_PAGE_LIMIT));

    const aggregates: MassiveAggregate[] = [];
    let nextUrl: string | undefined = url.toString();

    for (let page = 0; page < this.config.maxPages && nextUrl; page += 1) {
      const body: MassiveAggregatesResponse = await this.request(
        nextUrl,
        symbol,
      );
      aggregates.push(...(body.results ?? []));
      nextUrl = body.next_url;
      if (nextUrl) {
        this.logger.debug(
          `Following pagination for ${symbol} (page ${page + 2})`,
        );
      }
    }

    if (nextUrl) {
      this.logger.warn(
        `Pagination for ${symbol} stopped at the configured limit of ${this.config.maxPages} page(s); results may be truncated.`,
      );
    }

    const { candles, rejected, duplicates } = normalizeAggregates(aggregates);
    if (rejected > 0 || duplicates > 0) {
      this.logger.warn(
        `Discarded ${rejected} malformed and ${duplicates} duplicate bar(s) for ${symbol}`,
      );
    }
    this.logger.log(
      `Fetched ${candles.length} valid candle(s) for ${symbol} in ${Date.now() - startedAt}ms`,
    );

    return candles;
  }

  private async request(
    url: string,
    symbol: string,
  ): Promise<MassiveAggregatesResponse> {
    const body = await this.http.getJson(url, symbol);
    if (!isMassiveAggregatesResponse(body)) {
      this.logger.error(
        `Market data provider returned a malformed payload for ${symbol}`,
      );
      throw new BadGatewayException(
        'Market data provider returned an unexpected response.',
      );
    }
    return body;
  }
}
