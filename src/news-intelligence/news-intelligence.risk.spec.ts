import { MarketRiskBias } from './enums/market-risk-bias.enum.js';
import { NewsImpact } from './enums/news-impact.enum.js';
import { NewsSentiment } from './enums/news-sentiment.enum.js';
import { NewsIntelligenceService } from './news-intelligence.service.js';
import type { NewsProvider } from './providers/news-provider.interface.js';
import {
  buildRawArticle,
  hoursAgo,
  stubProvider,
} from './testing/news-factory.js';

function serviceWith(...providers: NewsProvider[]): NewsIntelligenceService {
  return new NewsIntelligenceService(providers);
}

const MILITARY_HEADLINE =
  'U.S. strikes Iranian launchers near Strait of Hormuz';

function withArticles(
  titles: { title: string; description?: string; ageHours?: number }[],
): NewsIntelligenceService {
  return serviceWith(
    stubProvider(
      'massive',
      titles.map((entry) =>
        buildRawArticle({
          title: entry.title,
          description: entry.description ?? null,
          publishedAt: hoursAgo(entry.ageHours ?? 0.4),
        }),
      ),
    ),
  );
}

describe('NewsIntelligenceService risk environment', () => {
  it('rates a major military escalation as high impact', async () => {
    const result = await withArticles([
      { title: MILITARY_HEADLINE },
    ]).getNewsIntelligence('VIX');

    expect(result.articles[0].impact).toBe(NewsImpact.HIGH);
    expect(result.newsImpact).toBe(NewsImpact.HIGH);
  });

  it('classifies a major military escalation as risk-off', async () => {
    const result = await withArticles([
      { title: MILITARY_HEADLINE },
    ]).getNewsIntelligence('SPY');

    expect(result.articles[0].marketRiskBias).toBe(MarketRiskBias.RISK_OFF);
    expect(result.marketRiskBias).toBe(MarketRiskBias.RISK_OFF);
    expect(result.riskBiasConfidence).toBeGreaterThan(0);
  });

  it('does not force bearish sentiment from military escalation', async () => {
    const result = await withArticles([
      { title: MILITARY_HEADLINE },
    ]).getNewsIntelligence('SPY');

    expect(result.articles[0].sentiment).not.toBe(NewsSentiment.BEARISH);
    expect(result.overallSentiment).not.toBe(NewsSentiment.BEARISH);
  });

  it('treats a ceasefire agreement as risk-on', async () => {
    const result = await withArticles([
      { title: 'Ceasefire agreement reached between Israel and Hezbollah' },
    ]).getNewsIntelligence('SPY');

    expect(result.articles[0].marketRiskBias).toBe(MarketRiskBias.RISK_ON);
    expect(result.marketRiskBias).toBe(MarketRiskBias.RISK_ON);
  });

  it('keeps a collapsed ceasefire risk-off', async () => {
    const result = await withArticles([
      { title: 'Gaza ceasefire collapses as strikes resume' },
    ]).getNewsIntelligence('SPY');

    expect(result.articles[0].marketRiskBias).toBe(MarketRiskBias.RISK_OFF);
  });

  it('does not treat a denied escalation as risk-off', async () => {
    const result = await withArticles([
      {
        title:
          "NATO doesn't see imminent attack as Russian 'hybrid' activity intensifies",
      },
    ]).getNewsIntelligence('SPY');

    expect(result.articles[0].marketRiskBias).not.toBe(MarketRiskBias.RISK_OFF);
  });

  it('scores a Strait of Hormuz event as highly relevant to VIX', async () => {
    const result = await withArticles([
      { title: MILITARY_HEADLINE },
    ]).getNewsIntelligence('VIX');

    expect(result.articles[0].relevanceScore).toBeGreaterThan(0.7);
    expect(result.articles[0].reasoning.join(' ')).not.toContain(
      'No clear connection',
    );
  });

  it('scores a Strait of Hormuz event as highly relevant to SPY', async () => {
    const result = await withArticles([
      { title: MILITARY_HEADLINE },
    ]).getNewsIntelligence('SPY');

    expect(result.articles[0].relevanceScore).toBeGreaterThan(0.6);
  });

  it('elevates an oil supply disruption', async () => {
    const result = await withArticles([
      {
        title: 'Oil prices jump more than 2% after strike on Iran',
        description: 'Traders price in a shipping disruption risk premium.',
      },
    ]).getNewsIntelligence('SPY');

    expect(result.articles[0].impact).not.toBe(NewsImpact.LOW);
    expect(result.articles[0].marketRiskBias).toBe(MarketRiskBias.RISK_OFF);
  });

  it('rates a Fed decision as high impact', async () => {
    const result = await withArticles([
      { title: 'Federal Reserve holds interest rates steady after FOMC vote' },
    ]).getNewsIntelligence('SPY');

    expect(result.articles[0].impact).toBe(NewsImpact.HIGH);
  });

  it('rates a CPI surprise as high impact', async () => {
    const result = await withArticles([
      { title: 'CPI inflation accelerates and tops forecasts in August' },
    ]).getNewsIntelligence('SPY');

    expect(result.articles[0].impact).toBe(NewsImpact.HIGH);
    expect(result.articles[0].marketRiskBias).toBe(MarketRiskBias.RISK_OFF);
  });

  it('rates banking stress as high impact', async () => {
    const result = await withArticles([
      {
        title:
          'Regional bank failure sparks deposit flight and contagion fears',
      },
    ]).getNewsIntelligence('IWM');

    expect(result.articles[0].impact).toBe(NewsImpact.HIGH);
    expect(result.riskFlags).toContain(
      'Banking or credit stress catalyst detected',
    );
  });

  it('keeps unrelated company news at low relevance for an index', async () => {
    const result = await withArticles([
      { title: 'Small biotech names a new chief marketing officer' },
    ]).getNewsIntelligence('SPY');

    expect(result.articles[0].relevanceScore).toBeLessThan(0.3);
    expect(result.articles[0].impact).toBe(NewsImpact.LOW);
  });

  it('lets one recent high-impact story outweigh many low-impact ones', async () => {
    const result = await withArticles([
      { title: MILITARY_HEADLINE, ageHours: 0.2 },
      { title: 'Company A appoints a new regional sales lead', ageHours: 3 },
      { title: 'Company B opens a distribution centre', ageHours: 4 },
      { title: 'Company C renews a sponsorship deal', ageHours: 5 },
      { title: 'Company D publishes a sustainability report', ageHours: 6 },
    ]).getNewsIntelligence('VIX');

    expect(result.marketRiskBias).toBe(MarketRiskBias.RISK_OFF);
    expect(result.articles[0].title).toBe(MILITARY_HEADLINE);
  });

  it('detects conflicting risk narratives without inventing a direction', async () => {
    const result = await withArticles([
      { title: MILITARY_HEADLINE, ageHours: 0.3 },
      {
        title: 'Ceasefire agreement reached in the Red Sea shipping corridor',
        ageHours: 0.3,
      },
    ]).getNewsIntelligence('SPY');

    expect(result.riskBiasConflict).toBe(true);
    expect(result.marketRiskBias).toBe(MarketRiskBias.NEUTRAL);
    expect(result.riskFlags).toContain(
      'Conflicting high-impact risk narratives detected',
    );
  });

  it('allows unknown sentiment to coexist with high impact and risk-off', async () => {
    const result = await withArticles([
      { title: MILITARY_HEADLINE },
    ]).getNewsIntelligence('VIX');
    const [article] = result.articles;

    expect(article.sentiment).toBe(NewsSentiment.UNKNOWN);
    expect(article.sentimentConfidence).toBe(0);
    expect(article.impact).toBe(NewsImpact.HIGH);
    expect(article.marketRiskBias).toBe(MarketRiskBias.RISK_OFF);
  });

  it('counts a story carried by both providers once', async () => {
    const published = hoursAgo(0.5);
    const service = serviceWith(
      stubProvider('massive', [
        buildRawArticle({
          id: 'massive-1',
          title: MILITARY_HEADLINE,
          publishedAt: published,
        }),
      ]),
      stubProvider('seeking-alpha', [
        buildRawArticle({
          id: 'sa-1',
          title: `${MILITARY_HEADLINE}, officials say`,
          publishedAt: published,
        }),
      ]),
    );

    const result = await service.getNewsIntelligence('SPY');

    expect(result.articleCount).toBe(1);
  });

  it('flags providers that returned no ticker-specific articles', async () => {
    const service = serviceWith(
      stubProvider(
        'massive',
        [
          buildRawArticle({
            title: MILITARY_HEADLINE,
            publishedAt: hoursAgo(1),
          }),
        ],
        { requestsMade: 2, tickerSpecificCount: 0, generalMarketCount: 1 },
      ),
    );

    const result = await service.getNewsIntelligence('VIX');

    expect(result.providers[0]).toMatchObject({
      requestsMade: 2,
      tickerSpecificCount: 0,
      generalMarketCount: 1,
    });
    expect(result.riskFlags).toContain(
      'News provider returned no ticker-specific articles: massive',
    );
  });
});
