import type { CatalystType } from '../enums/catalyst-type.enum.js';
import type { MarketRiskBias } from '../enums/market-risk-bias.enum.js';
import type { NewsImpact } from '../enums/news-impact.enum.js';
import type { NewsScope } from '../enums/news-scope.enum.js';
import type { NewsSentiment } from '../enums/news-sentiment.enum.js';

/**
 * What a provider can state on its own. Everything a provider cannot know —
 * relevance to the requested symbol, impact, scope — is derived centrally.
 */
export interface RawNewsArticle {
  id: string;
  provider: string;
  /** Publisher/outlet behind the story, e.g. `Reuters`. */
  source: string;
  title: string;
  description: string | null;
  publishedAt: Date;
  url: string | null;
  /** Tickers the provider itself attached to the story. */
  symbols: string[];
  /**
   * Direction the provider asserted for the requested symbol, when it supplies
   * one. Never inferred here, and never fabricated when absent.
   */
  providerSentiment: NewsSentiment | null;
}

export interface NewsArticle extends RawNewsArticle {
  scope: NewsScope;
  sentiment: NewsSentiment;
  sentimentConfidence: number;
  /** Risk environment implied by the story; never derived from sentiment. */
  marketRiskBias: MarketRiskBias;
  riskBiasConfidence: number;
  impact: NewsImpact;
  relevanceScore: number;
  catalystTypes: CatalystType[];
  reasoning: string[];
}
