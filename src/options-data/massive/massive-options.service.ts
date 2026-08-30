import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { MarketDataService } from '../../market-data/market-data.service.js';
import { MassiveHttpClient } from '../../market-data/massive-http.client.js';
import type { MassiveConfig } from '../../market-data/market-data.config.js';
import { exchangeDatePlusDays } from '../expiration.util.js';
import type { OptionChain } from '../interfaces/option-chain.interface.js';
import type { OptionContract } from '../interfaces/option-contract.interface.js';
import type {
  OptionChainQuery,
  OptionDataProvider,
} from '../interfaces/option-data-provider.interface.js';
import { normalizeOptionSnapshot } from './massive-options.mapper.js';
import {
  isMassiveOptionChainResponse,
  type MassiveOptionChainResponse,
  type MassiveOptionSnapshot,
} from './massive-options.types.js';

/** Maximum contracts Massive returns per options chain snapshot page. */
const MASSIVE_PAGE_LIMIT = 250;
/** Warnings kept in the response; the rest are summarised by a counter. */
const MAX_REPORTED_WARNINGS = 25;

/**
 * Adapter for the Massive options chain snapshot endpoint
 * (`GET /v3/snapshot/options/{underlyingAsset}`). Massive-specific URLs, query
 * parameters and field names stay inside this class; callers only ever receive
 * canonical {@link OptionChain} values.
 */
@Injectable()
export class MassiveOptionsService implements OptionDataProvider {
  private readonly logger = new Logger(MassiveOptionsService.name);
  private readonly config: MassiveConfig;

  constructor(
    private readonly http: MassiveHttpClient,
    private readonly marketData: MarketDataService,
  ) {
    this.config = http.config;
  }

  async getOptionChain(
    underlyingSymbol: string,
    options: OptionChainQuery = {},
  ): Promise<OptionChain> {
    const symbol = underlyingSymbol.trim().toUpperCase();
    const now = new Date();
    const startedAt = Date.now();

    const referencePrice =
      options.strikeRange === undefined
        ? null
        : await this.referencePrice(symbol);

    const url = this.buildUrl(symbol, options, now, referencePrice);
    const snapshots = await this.fetchAllPages(url, symbol);

    const contracts: OptionContract[] = [];
    const warnings: string[] = [];
    let rejectedCount = 0;

    for (const snapshot of snapshots) {
      const { contract, warning } = normalizeOptionSnapshot(
        snapshot,
        symbol,
        now,
      );
      if (contract === null) {
        rejectedCount += 1;
        if (warning !== null && warnings.length < MAX_REPORTED_WARNINGS) {
          warnings.push(warning);
        }
        continue;
      }
      contracts.push(contract);
    }

    if (rejectedCount > warnings.length) {
      warnings.push(
        `${rejectedCount - warnings.length} further malformed contract(s) were discarded`,
      );
    }
    if (rejectedCount > 0) {
      this.logger.warn(
        `Discarded ${rejectedCount} malformed option contract(s) for ${symbol}`,
      );
    }

    const underlyingPrice = await this.resolveUnderlyingPrice(
      symbol,
      contracts,
      referencePrice,
    );

    this.logger.log(
      `Fetched ${contracts.length} option contract(s) for ${symbol} in ${Date.now() - startedAt}ms`,
    );

    return {
      underlyingSymbol: symbol,
      underlyingPrice,
      timestamp: now,
      contracts,
      calls: [],
      puts: [],
      dataQuality: {
        contractCount: contracts.length,
        rejectedCount,
        warnings,
      },
    };
  }

  /**
   * Pushes the caller's contract type, expiration and strike constraints into
   * the provider query so large chains are trimmed server side. Remaining
   * filters are applied by {@link OptionsDataService} on normalized contracts.
   */
  private buildUrl(
    symbol: string,
    options: OptionChainQuery,
    now: Date,
    referencePrice: number | null,
  ): string {
    const url = new URL(
      `${this.config.restBaseUrl}/v3/snapshot/options/${encodeURIComponent(symbol)}`,
    );
    url.searchParams.set('limit', String(MASSIVE_PAGE_LIMIT));
    url.searchParams.set('sort', 'expiration_date');
    url.searchParams.set('order', 'asc');

    if (options.contractType !== undefined && options.contractType !== 'ALL') {
      url.searchParams.set('contract_type', options.contractType.toLowerCase());
    }

    if (options.expirationDate !== undefined) {
      url.searchParams.set('expiration_date', options.expirationDate);
    } else {
      if (options.minDaysToExpiration !== undefined) {
        url.searchParams.set(
          'expiration_date.gte',
          exchangeDatePlusDays(now, options.minDaysToExpiration),
        );
      }
      if (options.maxDaysToExpiration !== undefined) {
        url.searchParams.set(
          'expiration_date.lte',
          exchangeDatePlusDays(now, options.maxDaysToExpiration),
        );
      }
    }

    if (options.strikeRange !== undefined && referencePrice !== null) {
      url.searchParams.set(
        'strike_price.gte',
        String(Math.max(referencePrice - options.strikeRange, 0)),
      );
      url.searchParams.set(
        'strike_price.lte',
        String(referencePrice + options.strikeRange),
      );
    }

    return url.toString();
  }

  private async fetchAllPages(
    firstUrl: string,
    symbol: string,
  ): Promise<MassiveOptionSnapshot[]> {
    const snapshots: MassiveOptionSnapshot[] = [];
    let nextUrl: string | undefined = firstUrl;

    for (let page = 0; page < this.config.maxPages && nextUrl; page += 1) {
      const body: MassiveOptionChainResponse = await this.request(
        nextUrl,
        symbol,
      );
      snapshots.push(...(body.results ?? []));
      nextUrl = body.next_url;
      if (nextUrl) {
        this.logger.debug(
          `Following pagination for ${symbol} options (page ${page + 2})`,
        );
      }
    }

    if (nextUrl) {
      this.logger.warn(
        `Options pagination for ${symbol} stopped at the configured limit of ${this.config.maxPages} page(s); results may be truncated.`,
      );
    }

    return snapshots;
  }

  private async request(
    url: string,
    symbol: string,
  ): Promise<MassiveOptionChainResponse> {
    const body = await this.http.getJson(url, `${symbol} options`);
    if (!isMassiveOptionChainResponse(body)) {
      this.logger.error(
        `Options provider returned a malformed payload for ${symbol}`,
      );
      throw new BadGatewayException(
        'Options data provider returned an unexpected response.',
      );
    }
    return body;
  }

  /**
   * The snapshot carries the underlying price per contract; when the plan or
   * payload omits it we fall back to the latest 1-minute close from
   * MarketDataService.
   */
  private async resolveUnderlyingPrice(
    symbol: string,
    contracts: OptionContract[],
    referencePrice: number | null,
  ): Promise<number> {
    for (const contract of contracts) {
      if (contract.underlyingPrice !== null && contract.underlyingPrice > 0) {
        return contract.underlyingPrice;
      }
    }
    if (referencePrice !== null) {
      return referencePrice;
    }
    return this.marketData.getLatestPrice(symbol);
  }

  private async referencePrice(symbol: string): Promise<number | null> {
    try {
      return await this.marketData.getLatestPrice(symbol);
    } catch {
      this.logger.warn(
        `Could not resolve an underlying price for ${symbol} before requesting the chain; strike filtering will be applied locally.`,
      );
      return null;
    }
  }
}
