import { Controller, Get, Param, Query } from '@nestjs/common';
import { SymbolParamDto } from '../regime/dto/symbol-param.dto.js';
import { OptionSelectionQueryDto } from './dto/option-selection-query.dto.js';
import type { OptionSelectionResult } from './interfaces/option-selection-result.interface.js';
import { OptionSelectionService } from './option-selection.service.js';

@Controller('option-selection')
export class OptionSelectionController {
  constructor(
    private readonly optionSelectionService: OptionSelectionService,
  ) {}

  /** Best long CALL/PUT candidate for a symbol's current directional signal. */
  @Get(':symbol')
  selectContract(
    @Param() params: SymbolParamDto,
    @Query() query: OptionSelectionQueryDto,
  ): Promise<OptionSelectionResult> {
    return this.optionSelectionService.selectForSymbol(
      params.symbol.trim().toUpperCase(),
      {
        maxBudget: query.maxBudget,
        maxAlternatives: query.maxAlternatives,
      },
    );
  }
}
