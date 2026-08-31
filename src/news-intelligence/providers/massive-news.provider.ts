import { Injectable, Logger } from '@nestjs/common';
import { MassiveHttpClient } from '../../market-data/massive-http.client.js';
import { getSymbolContext } from '../constants/symbol-context.js';
import { NewsSentiment } from '../enums/news-sentiment.enum.js';
import type { RawNewsArticle } from '../interfaces/news-article.interface.js';
import type {
  MassiveNewsItem,
  MassiveNewsResponse,
} from './massive-news.types.js';
import type {
  NewsFetchResult,
  NewsProvider,
  NewsQueryOptions,
} from './news-provider.interface.js';

const NEWS_PATH = '/v2/reference/news';

function toSentiment(value: string | undefined): NewsSentiment | null {
  switch (value?.trim().toLowerCase()) {
    case 'positive':
      return NewsSentiment.BULLISH;
    case 'negative':
      return NewsSentiment.BEARISH;
    case 'neutral':
      return NewsSentiment.NEUTRAL;
    default:
      return null;
  }
}

function toText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Company and general-market news from Massive's reference news endpoint.
 * `ticker` is an optional filter on that endpoint, so the same call without it
 * returns the latest cross-market stories; that untargeted mode is used only
 * for broad index proxies (which are rarely tagged on individual articles) and
 * as a fallback when the ticker query comes back empty. Relevance scoring and
 * deduplication downstream decide what actually survives.
 */
@Injectable()
export class MassiveNewsProvider implements NewsProvider {
  readonly name = 'massive';
  private readonly logger = new Logger(MassiveNewsProvider.name);

  constructor(private readonly httpClient: MassiveHttpClient) {}

  async getRecentNews(
    symbol: string,
    options: NewsQueryOptions,
  ): Promise<NewsFetchResult> {
    const tickerArticles = await this.query(symbol, options, symbol);
    let requestsMade = 1;
    let generalArticles: RawNewsArticle[] = [];

    const wantsGeneral =
      getSymbolContext(symbol).broadMarket || tickerArticles.length === 0;
    if (wantsGeneral) {
      generalArticles = await this.query(symbol, options, null);
      requestsMade += 1;
    }

    const seen = new Set(tickerArticles.map((article) => article.id));
    const merged = [
      ...tickerArticles,
      ...generalArticles.filter((article) => !seen.has(article.id)),
    ];

    this.logger.log(
      `massive returned ${merged.length} usable article(s) for ${symbol} ` +
        `(ticker=${tickerArticles.length}, general=${generalArticles.length}, requests=${requestsMade})`,
    );

    return {
      articles: merged.slice(0, options.limit),
      metrics: {
        requestsMade,
        tickerSpecificCount: tickerArticles.length,
        generalMarketCount: generalArticles.length,
      },
    };
  }

  /** One page of news; `ticker` null asks for the latest general-market news. */
  private async query(
    symbol: string,
    options: NewsQueryOptions,
    ticker: string | null,
  ): Promise<RawNewsArticle[]> {
    const url = new URL(NEWS_PATH, `${this.httpClient.config.restBaseUrl}/`);
    if (ticker) {
      url.searchParams.set('ticker', ticker);
    }
    url.searchParams.set('published_utc.gte', options.since.toISOString());
    url.searchParams.set('order', 'desc');
    url.searchParams.set('sort', 'published_utc');
    url.searchParams.set('limit', String(options.limit));

    const payload = (await this.httpClient.getJson(
      url.toString(),
      ticker ? `${ticker} news` : 'market news',
    )) as MassiveNewsResponse | undefined;

    return (payload?.results ?? [])
      .map((item) => this.toArticle(item, symbol))
      .filter((article): article is RawNewsArticle => article !== null);
  }

  private toArticle(
    item: MassiveNewsItem,
    symbol: string,
  ): RawNewsArticle | null {
    const title = toText(item.title);
    const publishedAt = item.published_utc
      ? new Date(item.published_utc)
      : null;
    if (!title || !publishedAt || !Number.isFinite(publishedAt.getTime())) {
      return null;
    }

    const insight = item.insights?.find(
      (entry) => entry.ticker?.toUpperCase() === symbol.toUpperCase(),
    );

    return {
      id: toText(item.id) ?? `${this.name}:${title}:${publishedAt.getTime()}`,
      provider: this.name,
      source: toText(item.publisher?.name) ?? 'Massive',
      title,
      description: toText(item.description),
      publishedAt,
      url: toText(item.article_url),
      symbols: (item.tickers ?? []).map((ticker) => ticker.toUpperCase()),
      providerSentiment: toSentiment(insight?.sentiment),
    };
  }
}
