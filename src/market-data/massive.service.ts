import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeAggregates } from './candle-normalizer.js';
import type {
  HistoricalCandlesOptions,
  MarketCandle,
  MarketDataProvider,
} from './interfaces/market-candle.interface.js';
import {
  MASSIVE_CONFIG_KEY,
  type MassiveConfig,
} from './market-data.config.js';
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
export class MassiveService implements MarketDataProvider, OnModuleInit {
  private readonly logger = new Logger(MassiveService.name);
  private readonly config: MassiveConfig;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<MassiveConfig>(MASSIVE_CONFIG_KEY);
  }

  onModuleInit(): void {
    if (!this.config.apiKey) {
      this.logger.error(
        'MASSIVE_API_KEY is not set; market data requests will fail until it is configured.',
      );
    }
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
    if (!this.config.apiKey) {
      throw new ServiceUnavailableException(
        'Market data provider is not configured.',
      );
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(
        `Market data request for ${symbol} failed before a response was received (${reason})`,
      );
      throw new ServiceUnavailableException(
        'Market data provider is unreachable. Please retry shortly.',
      );
    }

    if (!response.ok) {
      throw this.toHttpException(response.status, symbol);
    }

    const body: unknown = await response.json().catch(() => undefined);
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

  private toHttpException(status: number, symbol: string): HttpException {
    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
      this.logger.error(
        `Market data provider rejected the configured credentials (HTTP ${status}) while fetching ${symbol}`,
      );
      return new ServiceUnavailableException(
        'Market data provider credentials are invalid or lack access to this data.',
      );
    }
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      this.logger.warn(
        `Market data provider rate limited request for ${symbol}`,
      );
      return new HttpException(
        'Market data provider rate limit exceeded. Please retry shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (status >= 500) {
      this.logger.error(
        `Market data provider returned HTTP ${status} for ${symbol}`,
      );
      return new BadGatewayException(
        'Market data provider is currently failing. Please retry shortly.',
      );
    }
    this.logger.error(
      `Market data request for ${symbol} failed with HTTP ${status}`,
    );
    return new BadGatewayException('Market data request failed.');
  }
}
