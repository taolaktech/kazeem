import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NewsConfig } from '../news-intelligence.config.js';
import { SeekingAlphaRssProvider } from './seeking-alpha-rss.provider.js';

function feed(title: string, pubDate: string): string {
  return `<?xml version="1.0"?><rss version="2.0"><channel><item>
    <title>${title}</title>
    <link>https://seekingalpha.com/news/${encodeURIComponent(title)}</link>
    <category domain="https://seekingalpha.com/symbol/SPY">spy</category>
    <pubDate>${pubDate}</pubDate>
  </item></channel></rss>`;
}

function buildProvider(
  overrides: Partial<NewsConfig> = {},
): SeekingAlphaRssProvider {
  const config: NewsConfig = {
    seekingAlphaEnabled: true,
    seekingAlphaBaseUrl: 'https://seekingalpha.test',
    requestTimeoutMs: 1_000,
    ...overrides,
  };
  const configService = {
    getOrThrow: (): NewsConfig => config,
  } as unknown as ConfigService;
  return new SeekingAlphaRssProvider(configService);
}

describe('SeekingAlphaRssProvider', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the breaking-news and per-symbol feeds', async () => {
    const now = new Date().toUTCString();
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            feed(
              url.includes('combined') ? 'Symbol story' : 'Market story',
              now,
            ),
          ),
      }),
    );

    const articles = await buildProvider().getRecentNews('SPY', {
      since: new Date(Date.now() - 3_600_000),
      limit: 10,
    });

    expect(fetchMock.mock.calls.map(([url]: [string]) => url)).toEqual([
      'https://seekingalpha.test/market_currents.xml',
      'https://seekingalpha.test/api/sa/combined/SPY.xml',
    ]);
    expect(articles.map((article) => article.title)).toEqual([
      'Market story',
      'Symbol story',
    ]);
    expect(articles[0]).toMatchObject({
      provider: 'seeking-alpha',
      source: 'Seeking Alpha',
      symbols: ['SPY'],
      providerSentiment: null,
    });
  });

  it('keeps working when only one feed responds', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes('combined')
        ? Promise.reject(new Error('unreachable'))
        : Promise.resolve({
            ok: true,
            status: 200,
            text: () =>
              Promise.resolve(feed('Market story', new Date().toUTCString())),
          }),
    );

    const articles = await buildProvider().getRecentNews('SPY', {
      since: new Date(Date.now() - 3_600_000),
      limit: 10,
    });

    expect(articles).toHaveLength(1);
  });

  it('fails when every feed is unavailable', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    await expect(
      buildProvider().getRecentNews('SPY', { since: new Date(0), limit: 10 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('refuses to fetch when disabled', async () => {
    const provider = buildProvider({ seekingAlphaEnabled: false });

    expect(provider.enabled).toBe(false);
    await expect(
      provider.getRecentNews('SPY', { since: new Date(0), limit: 10 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drops items published before the lookback window', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(feed('Old story', new Date(0).toUTCString())),
    });

    await expect(
      buildProvider().getRecentNews('SPY', {
        since: new Date(Date.now() - 3_600_000),
        limit: 10,
      }),
    ).resolves.toEqual([]);
  });
});
