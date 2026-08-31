import type { RawNewsArticle } from './news-article.interface.js';

/**
 * Non-sensitive retrieval counters, reported so a zero-article provider can be
 * told apart from a broken one. Never carries auth or request details.
 */
export interface NewsProviderMetrics {
  requestsMade: number;
  /** Articles the provider returned from a symbol-scoped query. */
  tickerSpecificCount: number;
  /** Articles returned from a general recent-news query, when supported. */
  generalMarketCount: number;
}

export interface NewsProviderResult extends NewsProviderMetrics {
  name: string;
  articleCount: number;
  success: boolean;
}

export interface NewsProviderFetch extends NewsProviderResult {
  articles: RawNewsArticle[];
  durationMs: number;
}
