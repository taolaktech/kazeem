import { NewsSentiment } from '../enums/news-sentiment.enum.js';
import { MassiveNewsProvider } from './massive-news.provider.js';
import type { MassiveNewsResponse } from './massive-news.types.js';

function providerWith(payload: MassiveNewsResponse | undefined): {
  provider: MassiveNewsProvider;
  getJson: ReturnType<typeof vi.fn>;
} {
  const getJson = vi.fn().mockResolvedValue(payload);
  const httpClient = {
    config: { restBaseUrl: 'https://api.massive.test' },
    getJson,
  };
  return {
    provider: new MassiveNewsProvider(
      httpClient as unknown as ConstructorParameters<
        typeof MassiveNewsProvider
      >[0],
    ),
    getJson,
  };
}

describe('MassiveNewsProvider', () => {
  it('normalizes articles and keeps the provider sentiment for the symbol', async () => {
    const { provider, getJson } = providerWith({
      results: [
        {
          id: 'abc',
          publisher: { name: 'Reuters' },
          title: 'Nvidia lifts guidance on AI demand',
          published_utc: '2026-08-30T20:05:00Z',
          article_url: 'https://example.com/nvda',
          tickers: ['nvda', 'amzn'],
          description: 'Data center revenue accelerated.',
          insights: [
            { ticker: 'NVDA', sentiment: 'positive' },
            { ticker: 'AMZN', sentiment: 'neutral' },
          ],
        },
      ],
    });

    const { articles, metrics } = await provider.getRecentNews('NVDA', {
      since: new Date('2026-08-30T00:00:00Z'),
      limit: 10,
    });
    const [article] = articles;

    expect(metrics).toEqual({
      requestsMade: 1,
      tickerSpecificCount: 1,
      generalMarketCount: 0,
    });

    expect(article).toMatchObject({
      id: 'abc',
      provider: 'massive',
      source: 'Reuters',
      symbols: ['NVDA', 'AMZN'],
      providerSentiment: NewsSentiment.BULLISH,
    });
    const requested = new URL(getJson.mock.calls[0][0] as string);
    expect(requested.pathname).toBe('/v2/reference/news');
    expect(requested.searchParams.get('ticker')).toBe('NVDA');
    expect(requested.searchParams.get('published_utc.gte')).toBe(
      '2026-08-30T00:00:00.000Z',
    );
  });

  it('drops entries without a usable title or timestamp', async () => {
    const { provider } = providerWith({
      results: [
        { title: 'No timestamp' },
        { published_utc: '2026-08-30T20:05:00Z' },
        { title: 'Bad timestamp', published_utc: 'never' },
      ],
    });

    const { articles } = await provider.getRecentNews('SPY', {
      since: new Date(0),
      limit: 10,
    });

    expect(articles).toEqual([]);
  });

  it('treats an empty payload as no news', async () => {
    const { provider, getJson } = providerWith(undefined);

    const { articles, metrics } = await provider.getRecentNews('SPY', {
      since: new Date(0),
      limit: 10,
    });

    expect(articles).toEqual([]);
    expect(metrics.requestsMade).toBe(2);
    expect(metrics.tickerSpecificCount).toBe(0);
    expect(metrics.generalMarketCount).toBe(0);
    expect(
      new URL(getJson.mock.calls[1][0] as string).searchParams.has('ticker'),
    ).toBe(false);
  });

  it('adds a general-market request for broad index proxies', async () => {
    const { provider, getJson } = providerWith({
      results: [
        {
          id: 'macro-1',
          title: 'U.S. strikes Iranian launchers near Strait of Hormuz',
          published_utc: '2026-08-30T20:05:00Z',
          publisher: { name: 'Reuters' },
        },
      ],
    });

    const { metrics } = await provider.getRecentNews('VIX', {
      since: new Date(0),
      limit: 10,
    });

    expect(metrics.requestsMade).toBe(2);
    expect(metrics.tickerSpecificCount).toBe(1);
    expect(metrics.generalMarketCount).toBe(1);
    expect(
      new URL(getJson.mock.calls[0][0] as string).searchParams.get('ticker'),
    ).toBe('VIX');
    expect(
      new URL(getJson.mock.calls[1][0] as string).searchParams.has('ticker'),
    ).toBe(false);
  });
});
