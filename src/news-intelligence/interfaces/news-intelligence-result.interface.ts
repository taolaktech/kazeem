import type { CatalystType } from '../enums/catalyst-type.enum.js';
import type { MarketRiskBias } from '../enums/market-risk-bias.enum.js';
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
  /**
   * Aggregate risk environment. Deliberately independent of sentiment:
   * RISK_OFF is not BEARISH and RISK_ON is not BULLISH.
   */
  marketRiskBias: MarketRiskBias;
  riskBiasConfidence: number;
  /** True when high-impact RISK_ON and RISK_OFF narratives are both present. */
  riskBiasConflict: boolean;
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
