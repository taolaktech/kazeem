import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { MarketDataService } from '../../market-data/market-data.service.js';
import {
  MASSIVE_CONFIG_KEY,
  type MassiveConfig,
} from '../../market-data/market-data.config.js';
import { MassiveHttpClient } from '../../market-data/massive-http.client.js';
import { MassiveOptionsService } from './massive-options.service.js';
import type { MassiveOptionSnapshot } from './massive-options.types.js';

const config: MassiveConfig = {
  apiKey: 'test-key',
  restBaseUrl: 'https://api.massive.com',
  requestTimeoutMs: 1_000,
  maxPages: 3,
  regularHoursOnly: true,
};

/** 2026-09-01 (Tuesday) 14:00 UTC = 10:00 ET. */
const NOW = new Date(Date.UTC(2026, 8, 1, 14, 0));

function snapshot(
  overrides: {
    ticker?: string;
    contractType?: string;
    strike?: number;
    expiration?: string;
    bid?: number;
    ask?: number;
    volume?: number;
    openInterest?: number;
    iv?: number;
    withGreeks?: boolean;
    underlyingPrice?: number;
  } = {},
): MassiveOptionSnapshot {
  const {
    ticker,
    contractType,
    strike,
    expiration,
    bid,
    ask,
    volume,
    openInterest,
    iv,
    withGreeks,
    underlyingPrice,
  } = {
    ticker: 'O:SPY260904C00650000',
    contractType: 'call',
    strike: 650,
    expiration: '2026-09-04',
    bid: 1.0 as number | undefined,
    ask: 1.1 as number | undefined,
    volume: 1_000,
    openInterest: 5_000,
    iv: 0.18 as number | undefined,
    withGreeks: true,
    underlyingPrice: 650.5 as number | undefined,
    ...overrides,
  };

  return {
    details: {
      contract_type: contractType,
      exercise_style: 'american',
      expiration_date: expiration,
      shares_per_contract: 100,
      strike_price: strike,
      ticker,
    },
    day: { volume, last_updated: 1_772_000_000_000_000_000 },
    greeks: withGreeks
      ? { delta: 0.52, gamma: 0.03, theta: -0.24, vega: 0.11 }
      : undefined,
    implied_volatility: iv,
    last_quote: {
      ask,
      bid,
      last_updated: 1_772_000_000_000_000_000,
      timeframe: 'DELAYED',
    },
    last_trade: {
      price: 1.05,
      size: 2,
      sip_timestamp: 1_772_000_000_000_000_000,
    },
    open_interest: openInterest,
    underlying_asset: { price: underlyingPrice, ticker: 'SPY' },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('MassiveOptionsService', () => {
  let service: MassiveOptionsService;
  let fetchMock: ReturnType<typeof vi.fn>;
  let getLatestPrice: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    getLatestPrice = vi.fn().mockResolvedValue(648.25);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        MassiveHttpClient,
        MassiveOptionsService,
        { provide: MarketDataService, useValue: { getLatestPrice } },
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

    service = moduleRef.get(MassiveOptionsService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function requestedUrl(call = 0): URL {
    return new URL(fetchMock.mock.calls[call][0] as string);
  }

  it('normalizes a snapshot into a canonical contract', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'OK', results: [snapshot()] }),
    );

    const chain = await service.getOptionChain('spy');

    expect(chain.underlyingSymbol).toBe('SPY');
    expect(chain.underlyingPrice).toBe(650.5);
    expect(chain.contracts).toHaveLength(1);
    expect(chain.contracts[0]).toMatchObject({
      symbol: 'O:SPY260904C00650000',
      underlyingSymbol: 'SPY',
      contractType: 'CALL',
      strikePrice: 650,
      daysToExpiration: 3,
      bid: 1,
      ask: 1.1,
      lastPrice: 1.05,
      volume: 1_000,
      openInterest: 5_000,
      impliedVolatility: 0.18,
      delta: 0.52,
      gamma: 0.03,
      theta: -0.24,
      vega: 0.11,
    });
    expect(chain.contracts[0].expirationDate.toISOString()).toBe(
      '2026-09-04T00:00:00.000Z',
    );
  });

  it('computes midpoint and bid/ask spread only from valid quotes', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          snapshot({ bid: 2, ask: 2.5 }),
          snapshot({
            ticker: 'O:SPY260904C00660000',
            strike: 660,
            bid: undefined,
            ask: 2.5,
          }),
        ],
      }),
    );

    const [quoted, oneSided] = (await service.getOptionChain('SPY')).contracts;

    expect(quoted.midpoint).toBe(2.25);
    expect(quoted.bidAskSpread).toBeCloseTo(0.5, 10);
    expect(quoted.bidAskSpreadPercent).toBeCloseTo((0.5 / 2.25) * 100, 10);
    expect(oneSided.bid).toBeNull();
    expect(oneSided.midpoint).toBeNull();
    expect(oneSided.bidAskSpread).toBeNull();
    expect(oneSided.bidAskSpreadPercent).toBeNull();
  });

  it('returns null for missing greeks and implied volatility', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [snapshot({ withGreeks: false, iv: undefined })],
      }),
    );

    const [contract] = (await service.getOptionChain('SPY')).contracts;

    expect(contract.delta).toBeNull();
    expect(contract.gamma).toBeNull();
    expect(contract.theta).toBeNull();
    expect(contract.vega).toBeNull();
    expect(contract.impliedVolatility).toBeNull();
  });

  it('rejects malformed contracts individually and reports warnings', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          snapshot(),
          snapshot({ ticker: 'O:SPY260904C00000000', strike: 0 }),
          snapshot({ ticker: 'O:SPY260904X00650000', contractType: 'other' }),
          snapshot({
            ticker: 'O:SPY260231C00650000',
            expiration: 'not-a-date',
          }),
          snapshot({ ticker: 'O:SPY260904C00655000', bid: 3, ask: 1 }),
          snapshot({
            ticker: 'O:SPY260101C00650000',
            expiration: '2026-01-01',
          }),
        ],
      }),
    );

    const chain = await service.getOptionChain('SPY');

    expect(chain.contracts).toHaveLength(1);
    expect(chain.dataQuality.rejectedCount).toBe(5);
    expect(chain.dataQuality.warnings).toHaveLength(5);
  });

  it('follows pagination up to the configured page limit', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          results: [snapshot()],
          next_url: 'https://api.massive.com/v3/snapshot/options/SPY?cursor=a',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            snapshot({ ticker: 'O:SPY260904P00650000', contractType: 'put' }),
          ],
        }),
      );

    const chain = await service.getOptionChain('SPY');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(chain.contracts.map((contract) => contract.contractType)).toEqual([
      'CALL',
      'PUT',
    ]);
  });

  it('pushes contract type, expiration and strike bounds into the provider query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [snapshot()] }));

    await service.getOptionChain('SPY', {
      contractType: 'CALL',
      minDaysToExpiration: 0,
      maxDaysToExpiration: 14,
      strikeRange: 10,
    });

    const url = requestedUrl();
    expect(url.pathname).toBe('/v3/snapshot/options/SPY');
    expect(url.searchParams.get('contract_type')).toBe('call');
    expect(url.searchParams.get('expiration_date.gte')).toBe('2026-09-01');
    expect(url.searchParams.get('expiration_date.lte')).toBe('2026-09-15');
    expect(url.searchParams.get('strike_price.gte')).toBe('638.25');
    expect(url.searchParams.get('strike_price.lte')).toBe('658.25');
    expect(url.searchParams.get('limit')).toBe('250');
  });

  it('falls back to the market data price when the snapshot omits the underlying', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ results: [snapshot({ underlyingPrice: undefined })] }),
    );

    const chain = await service.getOptionChain('QQQ');

    expect(getLatestPrice).toHaveBeenCalledWith('QQQ');
    expect(chain.underlyingPrice).toBe(648.25);
    expect(chain.contracts[0].underlyingPrice).toBeNull();
  });

  it('returns an empty chain when the provider has no contracts', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }));

    const chain = await service.getOptionChain('IWM');

    expect(chain.contracts).toEqual([]);
    expect(chain.dataQuality.contractCount).toBe(0);
  });

  it.each([
    [401, 503],
    [403, 503],
    [429, 429],
    [500, 502],
    [503, 502],
  ])('maps provider HTTP %i to %i', async (providerStatus, expected) => {
    fetchMock.mockResolvedValue(jsonResponse({}, providerStatus));

    await expect(service.getOptionChain('SPY')).rejects.toMatchObject({
      status: expected,
    });
  });

  it('does not leak the API key when the provider fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(service.getOptionChain('SPY')).rejects.toMatchObject({
      status: 503,
    });
    await expect(service.getOptionChain('SPY')).rejects.toMatchObject({
      message: expect.not.stringContaining(config.apiKey),
    });
  });

  it('rejects malformed provider payloads', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: 'nope' }));

    await expect(service.getOptionChain('SPY')).rejects.toMatchObject({
      status: 502,
    });
  });
});
