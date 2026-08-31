import { Test, type TestingModule } from '@nestjs/testing';
import type { NewsIntelligenceResult } from './interfaces/news-intelligence-result.interface.js';
import { NewsIntelligenceController } from './news-intelligence.controller.js';
import { NewsIntelligenceService } from './news-intelligence.service.js';

describe('NewsIntelligenceController', () => {
  let controller: NewsIntelligenceController;
  const getNewsIntelligence = vi.fn();

  beforeEach(async () => {
    getNewsIntelligence.mockReset();
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [NewsIntelligenceController],
      providers: [
        {
          provide: NewsIntelligenceService,
          useValue: { getNewsIntelligence },
        },
      ],
    }).compile();
    controller = moduleRef.get(NewsIntelligenceController);
  });

  it('normalizes the symbol and forwards the query options', async () => {
    const expected = { symbol: 'SPY' } as NewsIntelligenceResult;
    getNewsIntelligence.mockResolvedValue(expected);

    await expect(
      controller.getNewsIntelligence(
        { symbol: ' spy ' },
        { lookbackHours: 6, limit: 20 },
      ),
    ).resolves.toBe(expected);
    expect(getNewsIntelligence).toHaveBeenCalledWith('SPY', {
      lookbackHours: 6,
      limit: 20,
    });
  });
});
