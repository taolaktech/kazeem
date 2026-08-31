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

    const [article] = await provider.getRecentNews('NVDA', {
      since: new Date('2026-08-30T00:00:00Z'),
      limit: 10,
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

    await expect(
      provider.getRecentNews('SPY', { since: new Date(0), limit: 10 }),
    ).resolves.toEqual([]);
  });

  it('treats an empty payload as no news', async () => {
    const { provider } = providerWith(undefined);

    await expect(
      provider.getRecentNews('SPY', { since: new Date(0), limit: 10 }),
    ).resolves.toEqual([]);
  });
});
