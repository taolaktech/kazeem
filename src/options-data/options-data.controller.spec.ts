import { Test, type TestingModule } from '@nestjs/testing';
import type { OptionChain } from './interfaces/option-chain.interface.js';
import { OptionsDataController } from './options-data.controller.js';
import { OptionsDataService } from './options-data.service.js';

const chain: OptionChain = {
  underlyingSymbol: 'SPY',
  underlyingPrice: 650,
  timestamp: new Date('2026-09-01T14:00:00.000Z'),
  contracts: [],
  calls: [],
  puts: [],
  dataQuality: { contractCount: 0, rejectedCount: 0, warnings: [] },
};

describe('OptionsDataController', () => {
  let controller: OptionsDataController;
  let getOptionChain: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getOptionChain = vi.fn().mockResolvedValue(chain);
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [OptionsDataController],
      providers: [
        { provide: OptionsDataService, useValue: { getOptionChain } },
      ],
    }).compile();
    controller = moduleRef.get(OptionsDataController);
  });

  it('normalizes the symbol and forwards query filters to the service', async () => {
    const result = await controller.getChain(
      { symbol: ' spy ' },
      { contractType: 'CALL', maxDaysToExpiration: 14, strikeRange: 10 },
    );

    expect(getOptionChain).toHaveBeenCalledWith('SPY', {
      contractType: 'CALL',
      maxDaysToExpiration: 14,
      strikeRange: 10,
    });
    expect(result).toBe(chain);
  });
});
