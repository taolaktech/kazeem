import type { RawNewsArticle } from '../interfaces/news-article.interface.js';
import type { NewsProviderMetrics } from '../interfaces/news-provider-result.interface.js';

export interface NewsQueryOptions {
  /** Oldest publication time worth returning. */
  since: Date;
  /** Upper bound on articles the provider should return. */
  limit: number;
}

export interface NewsFetchResult {
  articles: RawNewsArticle[];
  metrics: NewsProviderMetrics;
}

export interface NewsProvider {
  readonly name: string;

  getRecentNews(
    symbol: string,
    options: NewsQueryOptions,
  ): Promise<NewsFetchResult>;
}

export const NEWS_PROVIDERS = Symbol('NEWS_PROVIDERS');
