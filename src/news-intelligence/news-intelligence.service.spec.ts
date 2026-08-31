import { ServiceUnavailableException } from '@nestjs/common';
import { CatalystType } from './enums/catalyst-type.enum.js';
import { NewsImpact } from './enums/news-impact.enum.js';
import { NewsScope } from './enums/news-scope.enum.js';
import { NewsSentiment } from './enums/news-sentiment.enum.js';
import { NewsIntelligenceService } from './news-intelligence.service.js';
import type { NewsProvider } from './providers/news-provider.interface.js';
import {
  buildRawArticle,
  failingProvider,
  hoursAgo,
  stubProvider,
} from './testing/news-factory.js';

function serviceWith(...providers: NewsProvider[]): NewsIntelligenceService {
  return new NewsIntelligenceService(providers);
}

describe('NewsIntelligenceService', () => {
  it('returns normalized articles from Massive alone', async () => {
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'Nvidia beats earnings estimates on AI data center demand',
          symbols: ['NVDA'],
          publishedAt: hoursAgo(0.5),
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('NVDA');

    expect(result.articleCount).toBe(1);
    expect(result.providers).toEqual([
      {
        name: 'massive',
        articleCount: 1,
        success: true,
        requestsMade: 1,
        tickerSpecificCount: 1,
        generalMarketCount: 0,
      },
    ]);
    expect(result.articles[0].catalystTypes).toContain(CatalystType.EARNINGS);
  });

  it('returns articles from the Seeking Alpha provider alone', async () => {
    const service = serviceWith(
      stubProvider('seeking-alpha', [
        buildRawArticle({
          provider: 'seeking-alpha',
          title: 'Fed holds rates steady as officials weigh inflation risks',
          publishedAt: hoursAgo(1),
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('SPY');

    expect(result.articleCount).toBe(1);
    expect(result.articles[0].scope).toBe(NewsScope.MACRO);
  });

  it('combines articles from both providers', async () => {
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({ title: 'Apple unveils new product line' }),
      ]),
      stubProvider('seeking-alpha', [
        buildRawArticle({
          provider: 'seeking-alpha',
          title: 'Oil prices climb on supply concerns',
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('SPY');

    expect(result.articleCount).toBe(2);
    expect(result.providers.every((provider) => provider.success)).toBe(true);
  });

  it('survives a provider failure and flags it', async () => {
    const service = serviceWith(
      stubProvider('massive', [buildRawArticle({ title: 'Market update' })]),
      failingProvider('seeking-alpha', 'feed unreachable'),
    );

    const result = await service.getNewsIntelligence('SPY');

    expect(result.articleCount).toBe(1);
    expect(result.riskFlags).toContain(
      'News provider unavailable: seeking-alpha',
    );
  });

  it('fails the request only when every provider fails', async () => {
    const service = serviceWith(
      failingProvider('massive', 'boom'),
      failingProvider('seeking-alpha', 'boom'),
    );

    await expect(service.getNewsIntelligence('SPY')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('treats an empty news set as a valid UNKNOWN answer', async () => {
    const service = serviceWith(
      stubProvider('massive', []),
      stubProvider('seeking-alpha', []),
    );

    const result = await service.getNewsIntelligence('SPY');

    expect(result.overallSentiment).toBe(NewsSentiment.UNKNOWN);
    expect(result.sentimentConfidence).toBe(0);
    expect(result.newsImpact).toBe(NewsImpact.LOW);
    expect(result.articles).toEqual([]);
    expect(result.reasoning).toContain('No relevant recent news was found');
  });

  it('deduplicates the same story arriving from two providers', async () => {
    const publishedAt = hoursAgo(2);
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'Fed cuts interest rates by 25 basis points',
          url: 'https://example.com/fed-cut?utm_source=massive',
          publishedAt,
        }),
      ]),
      stubProvider('seeking-alpha', [
        buildRawArticle({
          provider: 'seeking-alpha',
          title: 'Fed cuts interest rates by 25 basis points',
          url: 'https://www.example.com/fed-cut',
          publishedAt,
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('SPY');

    expect(result.articleCount).toBe(1);
  });

  it('classifies a Fed story as a macro catalyst for SPY', async () => {
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'Federal Reserve signals patience on rate cuts',
          publishedAt: hoursAgo(0.5),
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('SPY');
    const article = result.articles[0];

    expect(article.catalystTypes).toContain(CatalystType.FEDERAL_RESERVE);
    expect(article.scope).toBe(NewsScope.MACRO);
    expect(article.impact).toBe(NewsImpact.HIGH);
    expect(result.riskFlags).toContain(
      'Recent Federal Reserve catalyst detected',
    );
  });

  it('classifies a CPI story and flags the inflation catalyst', async () => {
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'CPI inflation cools to 2.4% in August',
          publishedAt: hoursAgo(0.5),
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('SPY');

    expect(result.articles[0].catalystTypes).toContain(CatalystType.CPI);
    expect(result.articles[0].sentiment).toBe(NewsSentiment.BULLISH);
    expect(result.riskFlags).toContain('Recent inflation catalyst detected');
  });

  it('gives a semiconductor story strong relevance for QQQ', async () => {
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'Nvidia semiconductor demand accelerates on AI chip orders',
          symbols: ['NVDA'],
          publishedAt: hoursAgo(1),
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('QQQ');

    expect(result.articles[0].relevanceScore).toBeGreaterThan(0.5);
  });

  it('gives a rates story strong relevance for IWM', async () => {
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title:
            'Small caps in focus as interest rates and credit conditions tighten',
          publishedAt: hoursAgo(1),
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('IWM');

    expect(result.articles[0].relevanceScore).toBeGreaterThan(0.5);
  });

  it('gives a broad-market story strong relevance for SPY', async () => {
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'S&P 500 slides as Treasury yields surge to a 2026 high',
          publishedAt: hoursAgo(0.5),
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('SPY');

    expect(result.articles[0].relevanceScore).toBeGreaterThan(0.5);
  });

  it('gives an unrelated story low relevance', async () => {
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'Small biotech reports positive phase 1 trial data',
          symbols: ['XBIO'],
          publishedAt: hoursAgo(1),
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('SPY');

    expect(result.articles[0].relevanceScore).toBeLessThan(0.2);
    expect(result.articles[0].impact).toBe(NewsImpact.LOW);
  });

  it('weights a very recent article above an identical older one', async () => {
    const recent = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'Fed cuts interest rates by 25 basis points',
          publishedAt: hoursAgo(0.2),
        }),
      ]),
    );
    const old = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'Fed cuts interest rates by 25 basis points',
          publishedAt: hoursAgo(20),
        }),
      ]),
    );

    const recentResult = await recent.getNewsIntelligence('SPY');
    const oldResult = await old.getNewsIntelligence('SPY');

    expect(recentResult.sentimentConfidence).toBeGreaterThan(
      oldResult.sentimentConfidence,
    );
  });

  it('lets one high-impact story outweigh several low-impact ones', async () => {
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'Fed cuts interest rates by 25 basis points',
          publishedAt: hoursAgo(0.2),
        }),
        buildRawArticle({
          title: 'Analyst downgrades XBIO to sell after routine review',
          symbols: ['XBIO'],
          publishedAt: hoursAgo(0.5),
        }),
        buildRawArticle({
          title: 'Analyst downgrades ZBIO to sell after routine review',
          symbols: ['ZBIO'],
          publishedAt: hoursAgo(0.6),
        }),
        buildRawArticle({
          title: 'Analyst downgrades YBIO to sell after routine review',
          symbols: ['YBIO'],
          publishedAt: hoursAgo(0.7),
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('SPY');

    expect(result.overallSentiment).toBe(NewsSentiment.BULLISH);
    expect(result.newsImpact).toBe(NewsImpact.HIGH);
    expect(result.dominantCatalysts).toContain(CatalystType.FEDERAL_RESERVE);
  });

  it('returns MIXED when high-impact news conflicts', async () => {
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'Fed cuts interest rates by 25 basis points',
          publishedAt: hoursAgo(0.2),
        }),
        buildRawArticle({
          title: 'CPI inflation accelerates as core prices top forecasts',
          publishedAt: hoursAgo(0.3),
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('SPY');

    expect(result.overallSentiment).toBe(NewsSentiment.MIXED);
    expect(result.reasoning).toContain(
      'Recent high-relevance news contains conflicting directional implications.',
    );
    expect(result.riskFlags).toContain('Conflicting high-impact news detected');
  });

  it('keeps unclassifiable headlines out of the directional verdict', async () => {
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'Stocks rise as investors weigh the outlook',
          publishedAt: hoursAgo(0.5),
        }),
        buildRawArticle({
          title: 'Wall Street eyes the week ahead',
          publishedAt: hoursAgo(1),
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('SPY');

    expect(result.articles.map((article) => article.sentiment)).toEqual([
      NewsSentiment.UNKNOWN,
      NewsSentiment.UNKNOWN,
    ]);
    expect(result.unknownArticleCount).toBe(2);
    expect(result.overallSentiment).toBe(NewsSentiment.NEUTRAL);
    expect(result.sentimentConfidence).toBe(0);
  });

  it('drops articles carrying an invalid timestamp', async () => {
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'Fed cuts interest rates by 25 basis points',
          publishedAt: new Date('not-a-date'),
        }),
        buildRawArticle({
          title: 'Wall Street eyes the week ahead',
          publishedAt: hoursAgo(1),
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('SPY');

    expect(result.articleCount).toBe(1);
  });

  it('handles a missing description without fabricating one', async () => {
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'Wall Street eyes the week ahead',
          description: null,
          publishedAt: hoursAgo(1),
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('SPY');

    expect(result.articles[0].description).toBeNull();
  });

  it('collapses duplicate titles published minutes apart', async () => {
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'Treasury yields surge after strong jobs report',
          url: null,
          publishedAt: hoursAgo(1),
        }),
        buildRawArticle({
          title: 'Treasury yields surge after strong jobs report',
          url: null,
          publishedAt: hoursAgo(1.2),
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('SPY');

    expect(result.articleCount).toBe(1);
  });

  it('honours the lookback window and article limit', async () => {
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          title: 'Recent market note',
          publishedAt: hoursAgo(2),
        }),
        buildRawArticle({
          title: 'Older market commentary from yesterday',
          publishedAt: hoursAgo(20),
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('SPY', {
      lookbackHours: 6,
      limit: 1,
    });

    expect(result.lookbackHours).toBe(6);
    expect(result.articleCount).toBe(1);
    expect(result.articles[0].title).toBe('Recent market note');
  });
});
