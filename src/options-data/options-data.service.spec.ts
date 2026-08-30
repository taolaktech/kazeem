import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { OptionType } from './enums/option-type.enum.js';
import type { OptionChain } from './interfaces/option-chain.interface.js';
import type { OptionContract } from './interfaces/option-contract.interface.js';
import {
  OPTION_DATA_PROVIDER,
  type OptionChainQuery,
} from './interfaces/option-data-provider.interface.js';
import { OptionsDataService } from './options-data.service.js';

const UNDERLYING_PRICE = 650;

function contract(overrides: Partial<OptionContract> = {}): OptionContract {
  const bid = overrides.bid ?? 1;
  const ask = overrides.ask ?? 1.1;
  const midpoint = bid !== null && ask !== null ? (bid + ask) / 2 : null;
  const spread = bid !== null && ask !== null ? ask - bid : null;
  return {
    symbol: 'O:SPY260904C00650000',
    underlyingSymbol: 'SPY',
    contractType: 'CALL' as OptionType,
    strikePrice: 650,
    expirationDate: new Date('2026-09-04T00:00:00.000Z'),
    daysToExpiration: 3,
    bid,
    ask,
    lastPrice: 1.05,
    midpoint,
    bidAskSpread: spread,
    bidAskSpreadPercent:
      spread !== null && midpoint !== null && midpoint > 0
        ? (spread / midpoint) * 100
        : null,
    volume: 1_000,
    openInterest: 5_000,
    impliedVolatility: 0.18,
    delta: 0.5,
    gamma: 0.03,
    theta: -0.2,
    vega: 0.1,
    underlyingPrice: UNDERLYING_PRICE,
    timestamp: new Date('2026-09-01T14:00:00.000Z'),
    ...overrides,
  };
}

function chainOf(contracts: OptionContract[]): OptionChain {
  return {
    underlyingSymbol: 'SPY',
    underlyingPrice: UNDERLYING_PRICE,
    timestamp: new Date('2026-09-01T14:00:00.000Z'),
    contracts,
    calls: [],
    puts: [],
    dataQuality: {
      contractCount: contracts.length,
      rejectedCount: 0,
      warnings: [],
    },
  };
}

describe('OptionsDataService', () => {
  let service: OptionsDataService;
  let getOptionChain: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getOptionChain = vi.fn();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        OptionsDataService,
        { provide: OPTION_DATA_PROVIDER, useValue: { getOptionChain } },
      ],
    }).compile();
    service = moduleRef.get(OptionsDataService);
  });

  async function chainWith(
    contracts: OptionContract[],
    query: OptionChainQuery = {},
  ): Promise<OptionChain> {
    getOptionChain.mockResolvedValue(chainOf(contracts));
    return service.getOptionChain('spy', query);
  }

  it('uppercases the symbol and splits calls and puts', async () => {
    const chain = await chainWith([
      contract(),
      contract({ symbol: 'O:SPY260904P00650000', contractType: 'PUT' }),
    ]);

    expect(getOptionChain).toHaveBeenCalledWith('SPY', {});
    expect(chain.underlyingSymbol).toBe('SPY');
    expect(chain.calls).toHaveLength(1);
    expect(chain.puts).toHaveLength(1);
    expect(chain.dataQuality.contractCount).toBe(2);
  });

  it.each([
    ['CALL' as const, 'CALL'],
    ['PUT' as const, 'PUT'],
  ])('filters by contract type %s', async (contractType, expected) => {
    const chain = await chainWith(
      [
        contract(),
        contract({ symbol: 'O:SPY260904P00650000', contractType: 'PUT' }),
      ],
      { contractType },
    );

    expect(chain.contracts.map((item) => item.contractType)).toEqual([
      expected,
    ]);
  });

  it('filters by days to expiration and exact expiration date', async () => {
    const near = contract({ symbol: 'NEAR', daysToExpiration: 3 });
    const far = contract({
      symbol: 'FAR',
      daysToExpiration: 45,
      expirationDate: new Date('2026-10-16T00:00:00.000Z'),
    });

    const windowed = await chainWith([near, far], {
      minDaysToExpiration: 0,
      maxDaysToExpiration: 14,
    });
    expect(windowed.contracts.map((item) => item.symbol)).toEqual(['NEAR']);

    const exact = await chainWith([near, far], {
      expirationDate: '2026-10-16',
    });
    expect(exact.contracts.map((item) => item.symbol)).toEqual(['FAR']);
  });

  it('filters strikes by dollar distance from the underlying price', async () => {
    const chain = await chainWith(
      [
        contract({ symbol: 'ATM', strikePrice: 651 }),
        contract({ symbol: 'NEAR', strikePrice: 640 }),
        contract({ symbol: 'FAR', strikePrice: 620 }),
      ],
      { strikeRange: 10 },
    );

    expect(chain.contracts.map((item) => item.symbol)).toEqual(['ATM', 'NEAR']);
  });

  it('filters by volume, open interest and spread percent', async () => {
    const liquid = contract({ symbol: 'LIQUID', bid: 1, ask: 1.02 });
    const thin = contract({
      symbol: 'THIN',
      volume: 5,
      openInterest: 10,
      bid: 1,
      ask: 2,
    });

    expect(
      (await chainWith([liquid, thin], { minVolume: 100 })).contracts,
    ).toHaveLength(1);
    expect(
      (await chainWith([liquid, thin], { minOpenInterest: 500 })).contracts,
    ).toHaveLength(1);
    expect(
      (await chainWith([liquid, thin], { maxSpreadPercent: 5 })).contracts.map(
        (item) => item.symbol,
      ),
    ).toEqual(['LIQUID']);
  });

  it('drops contracts without a spread when maxSpreadPercent is requested', async () => {
    await expect(
      chainWith([contract({ bid: null, ask: null })], { maxSpreadPercent: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws 404 when the chain is empty', async () => {
    await expect(chainWith([])).rejects.toMatchObject({
      status: 404,
      message: 'No option contracts found for symbol SPY',
    });
  });

  it('ranks liquid contracts by quote quality, spread, volume and distance', async () => {
    const chain = chainOf([
      contract({ symbol: 'NO_QUOTE', bid: null, ask: null, volume: 9_999 }),
      contract({ symbol: 'WIDE', bid: 1, ask: 1.4 }),
      contract({ symbol: 'TIGHT_LOW_VOLUME', bid: 1, ask: 1.01, volume: 10 }),
      contract({ symbol: 'TIGHT', bid: 1, ask: 1.01, volume: 8_000 }),
    ]);

    const ranked = service.getLiquidContracts(chain);

    expect(ranked.map((item) => item.symbol)).toEqual([
      'TIGHT',
      'TIGHT_LOW_VOLUME',
      'WIDE',
      'NO_QUOTE',
    ]);
  });

  it('limits the ranking to the requested type and size', async () => {
    const chain = chainOf([
      contract({ symbol: 'CALL_A' }),
      contract({ symbol: 'PUT_A', contractType: 'PUT' }),
      contract({ symbol: 'CALL_B', strikePrice: 655 }),
    ]);

    const ranked = service.getLiquidContracts(chain, {
      contractType: 'CALL',
      maxResults: 1,
    });

    expect(ranked.map((item) => item.symbol)).toEqual(['CALL_A']);
  });
});
