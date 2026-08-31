import { Test, type TestingModule } from '@nestjs/testing';
import { MarketRegime } from './enums/market-regime.enum.js';
import { RegimeController } from './regime.controller.js';
import { RegimeService } from './regime.service.js';
import { buildCandles } from './testing/candle-factory.js';
import type { ClassifyRegimeDto } from './dto/classify-regime.dto.js';
import type { RegimeClassificationResult } from './interfaces/regime-result.interface.js';
import { NotFoundException } from '@nestjs/common';

describe('RegimeController', () => {
  let controller: RegimeController;
  const classify = vi.fn();
  const classifySymbol = vi.fn();

  beforeEach(async () => {
    classify.mockReset();
    classifySymbol.mockReset();
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RegimeController],
      providers: [
        { provide: RegimeService, useValue: { classify, classifySymbol } },
      ],
    }).compile();

    controller = moduleRef.get(RegimeController);
  });

  it('delegates to RegimeService', async () => {
    const dto = {
      symbol: 'SPY',
      candles: buildCandles(120, { close: (index) => 100 + index }).map(
        (candle) => ({
          ...candle,
          timestamp: new Date(candle.timestamp).toISOString(),
        }),
      ),
    } as ClassifyRegimeDto;
    const expected = {
      primaryRegime: MarketRegime.TRENDING_BULLISH,
    } as RegimeClassificationResult;
    classify.mockResolvedValue(expected);

    await expect(controller.classify(dto)).resolves.toBe(expected);
    expect(classify).toHaveBeenCalledWith('SPY', dto.candles);
  });

  it('normalizes the symbol before classifying it from market data', async () => {
    const expected = {
      primaryRegime: MarketRegime.TRENDING_BULLISH,
    } as RegimeClassificationResult;
    classifySymbol.mockResolvedValue(expected);

    await expect(
      controller.classifySymbol({ symbol: ' spy ' }, { count: 500 }),
    ).resolves.toBe(expected);

    expect(classifySymbol).toHaveBeenCalledWith('SPY', 500);
  });

  it('propagates market data failures', async () => {
    classifySymbol.mockRejectedValue(
      new NotFoundException('No market data found for symbol INVALID'),
    );

    await expect(
      controller.classifySymbol({ symbol: 'INVALID' }, { count: 500 }),
    ).rejects.toThrow(NotFoundException);
  });
});
