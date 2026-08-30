import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { HttpException, NotFoundException } from '@nestjs/common';
import {
  MASSIVE_CONFIG_KEY,
  type MassiveConfig,
} from './market-data.config.js';
import { MarketDataService } from './market-data.service.js';
import { MassiveService } from './massive.service.js';
import type { MassiveAggregate } from './massive.types.js';

const config: MassiveConfig = {
  apiKey: 'test-key',
  restBaseUrl: 'https://api.massive.com',
  requestTimeoutMs: 1_000,
  maxPages: 3,
  regularHoursOnly: false,
};

/** 2026-08-28 (Friday) 14:00 UTC = 10:00 ET, inside the regular session. */
const BASE_TIMESTAMP = Date.UTC(2026, 7, 28, 14, 0);

function aggregate(
  minuteOffset: number,
  overrides: Partial<MassiveAggregate> = {},
): MassiveAggregate {
  return {
    t: BASE_TIMESTAMP + minuteOffset * 60_000,
    o: 100,
    h: 101,
    l: 99,
    c: 100.5,
    v: 1_000,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('MarketDataService', () => {
  let service: MarketDataService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        MassiveService,
        MarketDataService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key !== MASSIVE_CONFIG_KEY) {
                throw new Error(`Unexpected config key ${key}`);
              }
              return config;
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(MarketDataService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns normalized candles for a valid symbol and uppercases it', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'OK', results: [aggregate(0), aggregate(1)] }),
    );

    const candles = await service.getRecentMinuteCandles('spy', 500);

    expect(candles).toHaveLength(2);
    expect(candles[0]).toEqual({
      timestamp: new Date(BASE_TIMESTAMP),
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 1_000,
    });
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toContain('/v2/aggs/ticker/SPY/range/1/minute/');
  });

  it('sorts candles oldest to newest', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ results: [aggregate(5), aggregate(1), aggregate(3)] }),
    );

    const candles = await service.getRecentMinuteCandles('SPY');

    expect(candles.map((candle) => candle.timestamp.getTime())).toEqual([
      BASE_TIMESTAMP + 60_000,
      BASE_TIMESTAMP + 3 * 60_000,
      BASE_TIMESTAMP + 5 * 60_000,
    ]);
  });

  it('removes duplicate timestamps', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [aggregate(0), aggregate(0, { c: 100.9 }), aggregate(1)],
      }),
    );

    const candles = await service.getRecentMinuteCandles('SPY');

    expect(candles).toHaveLength(2);
    expect(candles[0].close).toBe(100.9);
  });

  it('rejects invalid candles', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          aggregate(0),
          aggregate(1, { c: Number.NaN }),
          aggregate(2, { h: Number.POSITIVE_INFINITY }),
          aggregate(3, { o: -5 }),
          aggregate(4, { h: 90 }),
          aggregate(5, { l: 105 }),
          aggregate(6, { v: -1 }),
          { t: 'nope' },
        ],
      }),
    );

    const candles = await service.getRecentMinuteCandles('SPY');

    expect(candles).toHaveLength(1);
    expect(candles[0].timestamp.getTime()).toBe(BASE_TIMESTAMP);
  });

  it('takes only the most recent requested count', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: Array.from({ length: 10 }, (_, index) => aggregate(index)),
      }),
    );

    const candles = await service.getRecentMinuteCandles('SPY', 60);

    expect(candles).toHaveLength(10);
    expect(candles.at(-1)?.timestamp.getTime()).toBe(
      BASE_TIMESTAMP + 9 * 60_000,
    );
  });

  it('follows next_url pagination up to the configured page limit', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          results: [aggregate(0)],
          next_url: 'https://api.massive.com/v2/aggs/next',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ results: [aggregate(1)] }));

    const candles = await service.getRecentMinuteCandles('SPY');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(candles).toHaveLength(2);
  });

  it('throws 404 when the provider returns no usable data', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'OK', results: [] }));

    await expect(service.getRecentMinuteCandles('INVALID')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.getRecentMinuteCandles('INVALID')).rejects.toThrow(
      'No market data found for symbol INVALID',
    );
  });

  it.each([
    [401, 503],
    [403, 503],
    [429, 429],
    [500, 502],
    [503, 502],
  ])('maps provider HTTP %i to %i', async (providerStatus, expected) => {
    fetchMock.mockResolvedValue(jsonResponse({}, providerStatus));

    await expect(service.getRecentMinuteCandles('SPY')).rejects.toMatchObject({
      status: expected,
    });
  });

  it('does not leak the API key in provider errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 401));

    const error = await service
      .getRecentMinuteCandles('SPY')
      .catch((caught: HttpException) => caught);

    expect(
      JSON.stringify((error as HttpException).getResponse()),
    ).not.toContain(config.apiKey);
  });

  it('surfaces network failures and timeouts as 503', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error('timed out'), { name: 'TimeoutError' }),
    );

    await expect(service.getRecentMinuteCandles('SPY')).rejects.toMatchObject({
      status: 503,
    });
  });

  it('rejects malformed provider payloads', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: 'not-an-array' }));

    await expect(service.getRecentMinuteCandles('SPY')).rejects.toMatchObject({
      status: 502,
    });
  });
});
