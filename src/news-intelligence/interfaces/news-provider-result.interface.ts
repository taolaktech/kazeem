import type { RawNewsArticle } from './news-article.interface.js';

export interface NewsProviderResult {
  name: string;
  articleCount: number;
  success: boolean;
}

export interface NewsProviderFetch extends NewsProviderResult {
  articles: RawNewsArticle[];
  durationMs: number;
}
