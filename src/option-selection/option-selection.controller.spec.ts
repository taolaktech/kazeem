import { Test, type TestingModule } from '@nestjs/testing';
import { OptionSelectionStatus } from './enums/option-selection-status.enum.js';
import type { OptionSelectionResult } from './interfaces/option-selection-result.interface.js';
import { OptionSelectionController } from './option-selection.controller.js';
import { OptionSelectionService } from './option-selection.service.js';

describe('OptionSelectionController', () => {
  let controller: OptionSelectionController;
  const selectForSymbol = vi.fn();

  beforeEach(async () => {
    selectForSymbol.mockReset();
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [OptionSelectionController],
      providers: [
        { provide: OptionSelectionService, useValue: { selectForSymbol } },
      ],
    }).compile();
    controller = moduleRef.get(OptionSelectionController);
  });

  it('normalizes the symbol and delegates to the selection service', async () => {
    const expected = {
      status: OptionSelectionStatus.NO_SELECTION,
    } as OptionSelectionResult;
    selectForSymbol.mockResolvedValue(expected);

    await expect(
      controller.selectContract(
        { symbol: ' spy ' },
        { maxBudget: 500, maxAlternatives: 3 },
      ),
    ).resolves.toBe(expected);
    expect(selectForSymbol).toHaveBeenCalledWith('SPY', {
      maxBudget: 500,
      maxAlternatives: 3,
    });
  });
});
