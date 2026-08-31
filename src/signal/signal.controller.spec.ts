import { Test, type TestingModule } from '@nestjs/testing';
import { MarketRegime } from '../regime/enums/market-regime.enum.js';
import { RegimeService } from '../regime/regime.service.js';
import { MarketSignal } from './enums/market-signal.enum.js';
import type { SignalResult } from './interfaces/signal-result.interface.js';
import { SignalController } from './signal.controller.js';
import { SignalService } from './signal.service.js';
import { buildRegime } from './testing/regime-factory.js';

describe('SignalController', () => {
  let controller: SignalController;
  const classifySymbol = vi.fn();
  const generateSignal = vi.fn();

  beforeEach(async () => {
    classifySymbol.mockReset();
    generateSignal.mockReset();
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [SignalController],
      providers: [
        { provide: RegimeService, useValue: { classifySymbol } },
        { provide: SignalService, useValue: { generateSignal } },
      ],
    }).compile();
    controller = moduleRef.get(SignalController);
  });

  it('classifies the regime then derives the signal from it', async () => {
    const regime = buildRegime({
      primaryRegime: MarketRegime.TRENDING_BULLISH,
    });
    const expected = { signal: MarketSignal.BULLISH } as SignalResult;
    classifySymbol.mockResolvedValue(regime);
    generateSignal.mockReturnValue(expected);

    await expect(
      controller.getSignal({ symbol: ' spy ' }, { count: 500 }),
    ).resolves.toBe(expected);
    expect(classifySymbol).toHaveBeenCalledWith('SPY', 500);
    expect(generateSignal).toHaveBeenCalledWith('SPY', regime);
  });
});
