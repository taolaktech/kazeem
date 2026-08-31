import { Controller, Get, Param, Query } from '@nestjs/common';
import { ClassifySymbolQueryDto } from '../regime/dto/classify-symbol.dto.js';
import { SymbolParamDto } from '../regime/dto/symbol-param.dto.js';
import type { SignalResult } from './interfaces/signal-result.interface.js';
import { SignalService } from './signal.service.js';

@Controller('signal')
export class SignalController {
  constructor(private readonly signalService: SignalService) {}

  /** Directional bias for a symbol, derived from its current market regime. */
  @Get(':symbol')
  getSignal(
    @Param() params: SymbolParamDto,
    @Query() query: ClassifySymbolQueryDto,
  ): Promise<SignalResult> {
    return this.signalService.getSignalForSymbol(
      params.symbol.trim().toUpperCase(),
      query.count,
    );
  }
}
