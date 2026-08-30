import { Controller, Get, Param, Query } from '@nestjs/common';
import { OptionChainQueryDto } from './dto/option-chain-query.dto.js';
import { UnderlyingSymbolParamDto } from './dto/underlying-symbol-param.dto.js';
import type { OptionChain } from './interfaces/option-chain.interface.js';
import { OptionsDataService } from './options-data.service.js';

@Controller('options')
export class OptionsDataController {
  constructor(private readonly optionsDataService: OptionsDataService) {}

  /** Temporary inspection endpoint for the normalized options chain. */
  @Get('chain/:symbol')
  getChain(
    @Param() params: UnderlyingSymbolParamDto,
    @Query() query: OptionChainQueryDto,
  ): Promise<OptionChain> {
    return this.optionsDataService.getOptionChain(
      params.symbol.trim().toUpperCase(),
      query,
    );
  }
}
