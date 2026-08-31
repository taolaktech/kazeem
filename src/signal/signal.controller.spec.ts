import { Test, type TestingModule } from '@nestjs/testing';
import { MarketSignal } from './enums/market-signal.enum.js';
import type { SignalResult } from './interfaces/signal-result.interface.js';
import { SignalController } from './signal.controller.js';
import { SignalService } from './signal.service.js';

describe('SignalController', () => {
  let controller: SignalController;
  const getSignalForSymbol = vi.fn();

  beforeEach(async () => {
    getSignalForSymbol.mockReset();
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [SignalController],
      providers: [{ provide: SignalService, useValue: { getSignalForSymbol } }],
    }).compile();
    controller = moduleRef.get(SignalController);
  });

  it('normalizes the symbol and delegates to the signal service', async () => {
    const expected = { signal: MarketSignal.BULLISH } as SignalResult;
    getSignalForSymbol.mockResolvedValue(expected);

    await expect(
      controller.getSignal({ symbol: ' spy ' }, { count: 500 }),
    ).resolves.toBe(expected);
    expect(getSignalForSymbol).toHaveBeenCalledWith('SPY', 500);
  });
});
