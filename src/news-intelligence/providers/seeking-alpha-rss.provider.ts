import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NEWS_CONFIG_KEY,
  type NewsConfig,
} from '../news-intelligence.config.js';
import type { RawNewsArticle } from '../interfaces/news-article.interface.js';
import { parseRssItems, type RssItem } from '../utils/rss.util.js';
import type {
  NewsProvider,
  NewsQueryOptions,
} from './news-provider.interface.js';

/**
 * Seeking Alpha's publicly published RSS feeds. Both paths were verified to
 * return RSS 2.0 XML:
 *   - /market_currents.xml            broad breaking-news feed
 *   - /api/sa/combined/{TICKER}.xml   per-symbol news and analysis feed
 * Only these feeds are read; no HTML page is ever fetched or parsed.
 */
const BREAKING_NEWS_PATH = '/market_currents.xml';
const SYMBOL_FEED_PATH = '/api/sa/combined';

@Injectable()
export class SeekingAlphaRssProvider implements NewsProvider {
  readonly name = 'seeking-alpha';
  private readonly logger = new Logger(SeekingAlphaRssProvider.name);
  private readonly config: NewsConfig;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<NewsConfig>(NEWS_CONFIG_KEY);
  }

  get enabled(): boolean {
    return this.config.seekingAlphaEnabled;
  }

  async getRecentNews(
    symbol: string,
    options: NewsQueryOptions,
  ): Promise<RawNewsArticle[]> {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Seeking Alpha RSS provider is disabled.',
      );
    }

    const feeds = [
      `${this.config.seekingAlphaBaseUrl}${BREAKING_NEWS_PATH}`,
      `${this.config.seekingAlphaBaseUrl}${SYMBOL_FEED_PATH}/${encodeURIComponent(symbol.toUpperCase())}.xml`,
    ];

    const responses = await Promise.allSettled(
      feeds.map((feed) => this.fetchFeed(feed)),
    );

    const failures = responses.filter(
      (response) => response.status === 'rejected',
    );
    if (failures.length === feeds.length) {
      throw new ServiceUnavailableException(
        'Seeking Alpha RSS feeds are unavailable.',
      );
    }

    const articles = responses
      .flatMap((response) =>
        response.status === 'fulfilled' ? parseRssItems(response.value) : [],
      )
      .map((item) => this.toArticle(item))
      .filter((article): article is RawNewsArticle => article !== null)
      .filter((article) => article.publishedAt >= options.since)
      .slice(0, options.limit);

    this.logger.log(
      `seeking-alpha returned ${articles.length} usable article(s) for ${symbol}`,
    );
    return articles;
  }

  private async fetchFeed(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(this.config.requestTimeoutMs),
    });
    if (!response.ok) {
      this.logger.warn(
        `Seeking Alpha feed request failed with HTTP ${response.status}`,
      );
      throw new ServiceUnavailableException(
        'Seeking Alpha feed request failed.',
      );
    }
    return response.text();
  }

  private toArticle(item: RssItem): RawNewsArticle | null {
    if (!item.title || !item.pubDate) {
      return null;
    }
    const url = item.link ?? item.guid;
    return {
      id: item.guid ?? item.link ?? `${this.name}:${item.title}`,
      provider: this.name,
      source: 'Seeking Alpha',
      title: item.title,
      description: item.description,
      publishedAt: item.pubDate,
      url,
      symbols: item.categories
        .filter((category) => /^[A-Za-z][A-Za-z0-9.-]{0,9}$/.test(category))
        .map((category) => category.toUpperCase()),
      providerSentiment: null,
    };
  }
}
