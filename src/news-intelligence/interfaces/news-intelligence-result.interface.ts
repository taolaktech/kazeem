import type { CatalystType } from '../enums/catalyst-type.enum.js';
import type { NewsImpact } from '../enums/news-impact.enum.js';
import type { NewsSentiment } from '../enums/news-sentiment.enum.js';
import type { NewsArticle } from './news-article.interface.js';
import type { NewsProviderResult } from './news-provider-result.interface.js';

export interface NewsIntelligenceResult {
  symbol: string;
  timestamp: Date;
  lookbackHours: number;
  overallSentiment: NewsSentiment;
  sentimentConfidence: number;
  newsImpact: NewsImpact;
  articleCount: number;
  highImpactArticleCount: number;
  bullishArticleCount: number;
  bearishArticleCount: number;
  neutralArticleCount: number;
  unknownArticleCount: number;
  dominantCatalysts: CatalystType[];
  articles: NewsArticle[];
  reasoning: string[];
  riskFlags: string[];
  providers: NewsProviderResult[];
}
