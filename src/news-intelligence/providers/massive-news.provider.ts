import { Injectable, Logger } from '@nestjs/common';
import { MassiveHttpClient } from '../../market-data/massive-http.client.js';
import { NewsSentiment } from '../enums/news-sentiment.enum.js';
import type { RawNewsArticle } from '../interfaces/news-article.interface.js';
import type {
  MassiveNewsItem,
  MassiveNewsResponse,
} from './massive-news.types.js';
import type {
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

/** Symbol-specific and company news from Massive's reference news endpoint. */
@Injectable()
export class MassiveNewsProvider implements NewsProvider {
  readonly name = 'massive';
  private readonly logger = new Logger(MassiveNewsProvider.name);

  constructor(private readonly httpClient: MassiveHttpClient) {}

  async getRecentNews(
    symbol: string,
    options: NewsQueryOptions,
  ): Promise<RawNewsArticle[]> {
    const url = new URL(NEWS_PATH, `${this.httpClient.config.restBaseUrl}/`);
    url.searchParams.set('ticker', symbol);
    url.searchParams.set('published_utc.gte', options.since.toISOString());
    url.searchParams.set('order', 'desc');
    url.searchParams.set('sort', 'published_utc');
    url.searchParams.set('limit', String(options.limit));

    const payload = (await this.httpClient.getJson(
      url.toString(),
      `${symbol} news`,
    )) as MassiveNewsResponse | undefined;

    const items = payload?.results ?? [];
    const articles = items
      .map((item) => this.toArticle(item, symbol))
      .filter((article): article is RawNewsArticle => article !== null);

    this.logger.log(
      `massive returned ${articles.length} usable article(s) for ${symbol}`,
    );
    return articles;
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
