import { Test, type TestingModule } from '@nestjs/testing';
import type { VolatilityIntelligenceResult } from './interfaces/volatility-intelligence-result.interface.js';
import { VolatilityIntelligenceController } from './volatility-intelligence.controller.js';
import { VolatilityIntelligenceService } from './volatility-intelligence.service.js';

describe('VolatilityIntelligenceController', () => {
  let controller: VolatilityIntelligenceController;
  const analyze = vi.fn();

  beforeEach(async () => {
    analyze.mockReset();
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [VolatilityIntelligenceController],
      providers: [
        { provide: VolatilityIntelligenceService, useValue: { analyze } },
      ],
    }).compile();
    controller = moduleRef.get(VolatilityIntelligenceController);
  });

  it('delegates the requested underlying to the service', async () => {
    const expected = { symbol: 'SPY' } as VolatilityIntelligenceResult;
    analyze.mockResolvedValue(expected);

    await expect(controller.analyze({ symbol: 'spy' })).resolves.toBe(expected);
    expect(analyze).toHaveBeenCalledWith('spy');
  });
});
