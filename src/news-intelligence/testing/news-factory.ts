import type { RawNewsArticle } from '../interfaces/news-article.interface.js';
import type {
  NewsFetchResult,
  NewsProvider,
  NewsQueryOptions,
} from '../providers/news-provider.interface.js';

let sequence = 0;

export function buildRawArticle(
  overrides: Partial<RawNewsArticle> = {},
): RawNewsArticle {
  sequence += 1;
  return {
    id: `article-${sequence}`,
    provider: 'test-provider',
    source: 'Test Wire',
    title: `Generic market update ${sequence}`,
    description: null,
    publishedAt: new Date(),
    url: `https://example.com/story-${sequence}`,
    symbols: [],
    providerSentiment: null,
    ...overrides,
  };
}

export function stubProvider(
  name: string,
  articles: RawNewsArticle[],
  metrics: Partial<NewsFetchResult['metrics']> = {},
): NewsProvider {
  return {
    name,
    getRecentNews: (
      _symbol: string,
      _options: NewsQueryOptions,
    ): Promise<NewsFetchResult> =>
      Promise.resolve({
        articles,
        metrics: {
          requestsMade: 1,
          tickerSpecificCount: articles.length,
          generalMarketCount: 0,
          ...metrics,
        },
      }),
  };
}

export function failingProvider(name: string, message: string): NewsProvider {
  return {
    name,
    getRecentNews: (): Promise<NewsFetchResult> =>
      Promise.reject(new Error(message)),
  };
}

export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3_600_000);
}
