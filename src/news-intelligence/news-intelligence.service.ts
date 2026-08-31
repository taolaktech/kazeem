import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AGGREGATION_RELEVANCE_FLOOR,
  DEFAULT_ARTICLE_LIMIT,
  DEFAULT_LOOKBACK_HOURS,
  DOMINANCE_THRESHOLD,
  IMPACT_WEIGHTS,
  LIMITED_NEWS_ARTICLE_COUNT,
  LOW_CONFIDENCE_THRESHOLD,
  MAX_DOMINANT_CATALYSTS,
  MIN_DIRECTIONAL_WEIGHT,
  MIN_RISK_BIAS_WEIGHT,
  PROVIDER_FETCH_MULTIPLIER,
  RISK_DOMINANCE_THRESHOLD,
} from './constants/news-intelligence-thresholds.js';
import { getSymbolContext } from './constants/symbol-context.js';
import { CatalystType } from './enums/catalyst-type.enum.js';
import { MarketRiskBias } from './enums/market-risk-bias.enum.js';
import { NewsImpact } from './enums/news-impact.enum.js';
import { NewsSentiment } from './enums/news-sentiment.enum.js';
import type {
  NewsArticle,
  RawNewsArticle,
} from './interfaces/news-article.interface.js';
import type { NewsIntelligenceResult } from './interfaces/news-intelligence-result.interface.js';
import type { NewsProviderFetch } from './interfaces/news-provider-result.interface.js';
import {
  NEWS_PROVIDERS,
  type NewsProvider,
} from './providers/news-provider.interface.js';
import {
  classifyImpact,
  classifyRiskBias,
  classifySentiment,
  detectCatalysts,
  detectScope,
} from './utils/news-classification.util.js';
import { deduplicateArticles } from './utils/news-deduplication.util.js';
import { isValidDate, recencyWeight } from './utils/news-recency.util.js';
import { scoreRelevance } from './utils/news-relevance.util.js';
import { roundTo, toSearchText } from './utils/news-text.util.js';

export interface NewsIntelligenceOptions {
  lookbackHours?: number;
  limit?: number;
}

interface WeightedArticle {
  article: NewsArticle;
  /** Directional weight; zero unless the article asserts a direction. */
  weight: number;
  /** Risk-environment weight, independent of direction. */
  riskWeight: number;
}

interface RiskAggregate {
  bias: MarketRiskBias;
  confidence: number;
  conflict: boolean;
  reasoning: string[];
}

@Injectable()
export class NewsIntelligenceService {
  private readonly logger = new Logger(NewsIntelligenceService.name);

  constructor(
    @Inject(NEWS_PROVIDERS) private readonly providers: NewsProvider[],
  ) {}

  async getNewsIntelligence(
    symbol: string,
    options: NewsIntelligenceOptions = {},
  ): Promise<NewsIntelligenceResult> {
    const lookbackHours = options.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;
    const limit = options.limit ?? DEFAULT_ARTICLE_LIMIT;
    const now = new Date();
    const since = new Date(now.getTime() - lookbackHours * 3_600_000);

    const fetches = await this.fetchAll(symbol, since, limit);
    if (fetches.every((fetch) => !fetch.success)) {
      throw new ServiceUnavailableException(
        'No news provider is currently available.',
      );
    }

    const raw = fetches
      .flatMap((fetch) => fetch.articles)
      .filter(
        (article) =>
          isValidDate(article.publishedAt) && article.publishedAt >= since,
      );

    const deduplicated = deduplicateArticles(raw);
    const articles = deduplicated
      .map((article) => this.enrich(symbol, article, now))
      .sort(
        (left, right) =>
          right.relevanceScore - left.relevanceScore ||
          right.publishedAt.getTime() - left.publishedAt.getTime(),
      )
      .slice(0, limit);

    return this.aggregate(symbol, articles, fetches, lookbackHours, now);
  }

  private async fetchAll(
    symbol: string,
    since: Date,
    limit: number,
  ): Promise<NewsProviderFetch[]> {
    const queryOptions = {
      since,
      limit: limit * PROVIDER_FETCH_MULTIPLIER,
    };

    return Promise.all(
      this.providers.map(async (provider) => {
        const startedAt = Date.now();
        try {
          const { articles, metrics } = await provider.getRecentNews(
            symbol,
            queryOptions,
          );
          const durationMs = Date.now() - startedAt;
          this.logger.log(
            `${provider.name} returned ${articles.length} article(s) for ${symbol} in ${durationMs}ms`,
          );
          return {
            name: provider.name,
            articleCount: articles.length,
            success: true,
            ...metrics,
            articles,
            durationMs,
          };
        } catch (error) {
          const durationMs = Date.now() - startedAt;
          const reason =
            error instanceof Error ? error.message : 'unknown provider error';
          this.logger.warn(
            `${provider.name} failed for ${symbol} after ${durationMs}ms: ${reason}`,
          );
          return {
            name: provider.name,
            articleCount: 0,
            success: false,
            requestsMade: 1,
            tickerSpecificCount: 0,
            generalMarketCount: 0,
            articles: [],
            durationMs,
          };
        }
      }),
    );
  }

  private enrich(
    symbol: string,
    article: RawNewsArticle,
    now: Date,
  ): NewsArticle {
    const context = getSymbolContext(symbol);
    const searchText = toSearchText(article.title, article.description);
    const catalysts = detectCatalysts(searchText);
    const recency = recencyWeight(article.publishedAt, now);
    const relevance = scoreRelevance(
      context,
      searchText,
      article.symbols,
      catalysts,
      recency,
    );
    const scope = detectScope(
      searchText,
      catalysts,
      relevance.mentionsSymbolDirectly,
    );
    const sentiment = classifySentiment(searchText, article.providerSentiment);
    const riskBias = classifyRiskBias(searchText);
    const impact = classifyImpact(
      catalysts,
      relevance.score,
      scope,
      recency,
      relevance.mentionsSymbolDirectly,
    );

    return {
      ...article,
      scope,
      sentiment: sentiment.sentiment,
      sentimentConfidence: sentiment.confidence,
      marketRiskBias: riskBias.bias,
      riskBiasConfidence: riskBias.confidence,
      impact,
      relevanceScore: relevance.score,
      catalystTypes: catalysts,
      reasoning: [
        ...relevance.reasoning,
        ...riskBias.reasoning,
        ...sentiment.reasoning,
        ...(impact === NewsImpact.HIGH
          ? [
              `Classified as high-impact ${riskBias.bias === MarketRiskBias.UNKNOWN ? 'market' : riskBias.bias} context`,
            ]
          : []),
      ],
    };
  }

  private aggregate(
    symbol: string,
    articles: NewsArticle[],
    fetches: NewsProviderFetch[],
    lookbackHours: number,
    now: Date,
  ): NewsIntelligenceResult {
    const providers = fetches.map((fetch) => ({
      name: fetch.name,
      articleCount: fetch.articleCount,
      success: fetch.success,
      requestsMade: fetch.requestsMade,
      tickerSpecificCount: fetch.tickerSpecificCount,
      generalMarketCount: fetch.generalMarketCount,
    }));
    const reasoning: string[] = [];
    const riskFlags: string[] = [];

    for (const fetch of fetches) {
      if (!fetch.success) {
        riskFlags.push(`News provider unavailable: ${fetch.name}`);
      } else if (fetch.tickerSpecificCount === 0) {
        riskFlags.push(
          `News provider returned no ticker-specific articles: ${fetch.name}`,
        );
      }
    }

    if (articles.length === 0) {
      reasoning.push('No relevant recent news was found');
      return {
        symbol,
        timestamp: now,
        lookbackHours,
        overallSentiment: NewsSentiment.UNKNOWN,
        sentimentConfidence: 0,
        marketRiskBias: MarketRiskBias.UNKNOWN,
        riskBiasConfidence: 0,
        riskBiasConflict: false,
        newsImpact: NewsImpact.LOW,
        articleCount: 0,
        highImpactArticleCount: 0,
        bullishArticleCount: 0,
        bearishArticleCount: 0,
        neutralArticleCount: 0,
        unknownArticleCount: 0,
        dominantCatalysts: [],
        articles: [],
        reasoning,
        riskFlags,
        providers,
      };
    }

    const weighted: WeightedArticle[] = articles.map((article) => {
      const base =
        article.relevanceScore < AGGREGATION_RELEVANCE_FLOOR
          ? 0
          : IMPACT_WEIGHTS[article.impact] *
            article.relevanceScore *
            recencyWeight(article.publishedAt, now);
      return {
        article,
        weight: base * article.sentimentConfidence,
        riskWeight: base * article.riskBiasConfidence,
      };
    });

    let bullishWeight = 0;
    let bearishWeight = 0;
    for (const { article, weight } of weighted) {
      if (article.sentiment === NewsSentiment.BULLISH) {
        bullishWeight += weight;
      } else if (article.sentiment === NewsSentiment.BEARISH) {
        bearishWeight += weight;
      } else if (article.sentiment === NewsSentiment.MIXED) {
        bullishWeight += weight / 2;
        bearishWeight += weight / 2;
      }
    }

    const directional = bullishWeight + bearishWeight;
    const dominance =
      directional > 0
        ? Math.max(bullishWeight, bearishWeight) / directional
        : 0;

    let overallSentiment = NewsSentiment.NEUTRAL;
    let sentimentConfidence = 0;

    if (directional < MIN_DIRECTIONAL_WEIGHT) {
      overallSentiment = NewsSentiment.NEUTRAL;
      reasoning.push(
        'Recent news carries no material directional implication for this symbol',
      );
    } else if (dominance >= DOMINANCE_THRESHOLD) {
      overallSentiment =
        bullishWeight > bearishWeight
          ? NewsSentiment.BULLISH
          : NewsSentiment.BEARISH;
      sentimentConfidence = roundTo(
        Math.min(1, dominance * Math.min(1, directional)),
      );
      reasoning.push(
        `Weighted news flow leans ${overallSentiment.toLowerCase()} (${roundTo(bullishWeight)} bullish vs ${roundTo(bearishWeight)} bearish weight)`,
      );
    } else {
      overallSentiment = NewsSentiment.MIXED;
      sentimentConfidence = roundTo(Math.min(1, directional) * 0.4);
      reasoning.push(
        'Recent high-relevance news contains conflicting directional implications.',
      );
      riskFlags.push('Conflicting high-impact news detected');
    }

    const highImpact = articles.filter(
      (article) => article.impact === NewsImpact.HIGH,
    );
    const newsImpact =
      highImpact.length > 0
        ? NewsImpact.HIGH
        : articles.some((article) => article.impact === NewsImpact.MEDIUM)
          ? NewsImpact.MEDIUM
          : NewsImpact.LOW;

    const risk = this.aggregateRisk(weighted);
    reasoning.push(...risk.reasoning);
    if (risk.conflict) {
      riskFlags.push('Conflicting high-impact risk narratives detected');
    }
    if (risk.bias === MarketRiskBias.RISK_OFF) {
      riskFlags.push('Recent risk-off catalyst detected');
    }

    const dominantCatalysts = this.rankCatalysts(weighted);

    reasoning.push(
      `${articles.length} article(s) analysed across ${providers.filter((provider) => provider.success).length} provider(s)`,
    );
    if (highImpact.length > 0) {
      reasoning.push(
        `${highImpact.length} high-impact article(s) dominate the weighting`,
      );
      riskFlags.push('High-impact macro catalyst detected');
    }

    this.addCatalystFlags(articles, riskFlags);

    if (
      sentimentConfidence > 0 &&
      sentimentConfidence < LOW_CONFIDENCE_THRESHOLD
    ) {
      riskFlags.push('News sentiment confidence is low');
    }
    if (articles.length < LIMITED_NEWS_ARTICLE_COUNT) {
      riskFlags.push('Limited recent news available');
    }

    return {
      symbol,
      timestamp: now,
      lookbackHours,
      overallSentiment,
      sentimentConfidence,
      marketRiskBias: risk.bias,
      riskBiasConfidence: risk.confidence,
      riskBiasConflict: risk.conflict,
      newsImpact,
      articleCount: articles.length,
      highImpactArticleCount: highImpact.length,
      bullishArticleCount: this.countBy(articles, NewsSentiment.BULLISH),
      bearishArticleCount: this.countBy(articles, NewsSentiment.BEARISH),
      neutralArticleCount:
        this.countBy(articles, NewsSentiment.NEUTRAL) +
        this.countBy(articles, NewsSentiment.MIXED),
      unknownArticleCount: this.countBy(articles, NewsSentiment.UNKNOWN),
      dominantCatalysts,
      articles,
      reasoning,
      riskFlags: [...new Set(riskFlags)],
      providers,
    };
  }

  /**
   * Risk environment weighted by impact, relevance, recency and rule
   * confidence, never by article count: one high-impact RISK_OFF story
   * outweighs a pile of irrelevant filler.
   */
  private aggregateRisk(weighted: WeightedArticle[]): RiskAggregate {
    let riskOff = 0;
    let riskOn = 0;
    for (const { article, riskWeight } of weighted) {
      if (article.marketRiskBias === MarketRiskBias.RISK_OFF) {
        riskOff += riskWeight;
      } else if (article.marketRiskBias === MarketRiskBias.RISK_ON) {
        riskOn += riskWeight;
      }
    }

    const total = riskOff + riskOn;
    if (total === 0) {
      return {
        bias: MarketRiskBias.UNKNOWN,
        confidence: 0,
        conflict: false,
        reasoning: [
          'No recent story carried a decisive risk-on or risk-off signal',
        ],
      };
    }

    const dominance = Math.max(riskOff, riskOn) / total;
    const conflict =
      dominance < RISK_DOMINANCE_THRESHOLD &&
      Math.min(riskOff, riskOn) >= MIN_RISK_BIAS_WEIGHT;

    if (conflict) {
      return {
        bias: MarketRiskBias.NEUTRAL,
        confidence: 0,
        conflict: true,
        reasoning: [
          'Conflicting high-impact risk narratives detected in recent news',
        ],
      };
    }

    if (total < MIN_RISK_BIAS_WEIGHT) {
      return {
        bias: MarketRiskBias.NEUTRAL,
        confidence: 0,
        conflict: false,
        reasoning: ['Recent risk catalysts are too weak to shift the regime'],
      };
    }

    const bias =
      riskOff > riskOn ? MarketRiskBias.RISK_OFF : MarketRiskBias.RISK_ON;
    return {
      bias,
      confidence: roundTo(Math.min(1, dominance * Math.min(1, total))),
      conflict: false,
      reasoning: [
        `Weighted news flow describes a ${bias} environment (${roundTo(riskOff)} risk-off vs ${roundTo(riskOn)} risk-on weight)`,
      ],
    };
  }

  private countBy(articles: NewsArticle[], sentiment: NewsSentiment): number {
    return articles.filter((article) => article.sentiment === sentiment).length;
  }

  private rankCatalysts(weighted: WeightedArticle[]): CatalystType[] {
    const scores = new Map<CatalystType, number>();
    for (const { article, weight } of weighted) {
      const contribution = weight > 0 ? weight : article.relevanceScore * 0.1;
      for (const catalyst of article.catalystTypes) {
        if (catalyst === CatalystType.OTHER) {
          continue;
        }
        scores.set(catalyst, (scores.get(catalyst) ?? 0) + contribution);
      }
    }
    return [...scores.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, MAX_DOMINANT_CATALYSTS)
      .map(([catalyst]) => catalyst);
  }

  private addCatalystFlags(articles: NewsArticle[], riskFlags: string[]): void {
    const relevant = articles.filter(
      (article) => article.relevanceScore >= AGGREGATION_RELEVANCE_FLOOR,
    );
    const has = (catalyst: CatalystType): boolean =>
      relevant.some((article) => article.catalystTypes.includes(catalyst));

    if (has(CatalystType.FEDERAL_RESERVE)) {
      riskFlags.push('Recent Federal Reserve catalyst detected');
    }
    if (
      has(CatalystType.INFLATION) ||
      has(CatalystType.CPI) ||
      has(CatalystType.PPI)
    ) {
      riskFlags.push('Recent inflation catalyst detected');
    }
    if (has(CatalystType.GEOPOLITICAL) || has(CatalystType.TARIFFS)) {
      riskFlags.push('Recent geopolitical catalyst detected');
    }
    if (has(CatalystType.MILITARY_CONFLICT)) {
      riskFlags.push('Military escalation detected');
    }
    if (has(CatalystType.OIL_SUPPLY_DISRUPTION)) {
      riskFlags.push('Potential energy supply disruption detected');
    }
    if (has(CatalystType.BANKING_STRESS) || has(CatalystType.CREDIT)) {
      riskFlags.push('Banking or credit stress catalyst detected');
    }
    if (has(CatalystType.SYSTEMIC_RISK)) {
      riskFlags.push('Systemic financial risk catalyst detected');
    }
  }
}
