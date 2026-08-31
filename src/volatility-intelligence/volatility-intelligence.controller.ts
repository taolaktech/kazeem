import { Controller, Get, Param } from '@nestjs/common';
import { SymbolParamDto } from '../regime/dto/symbol-param.dto.js';
import type { VolatilityIntelligenceResult } from './interfaces/volatility-intelligence-result.interface.js';
import { VolatilityIntelligenceService } from './volatility-intelligence.service.js';

@Controller('volatility-intelligence')
export class VolatilityIntelligenceController {
  constructor(
    private readonly volatilityIntelligenceService: VolatilityIntelligenceService,
  ) {}

  /** Volatility context for an underlying, measured against the VIX index. */
  @Get(':symbol')
  analyze(
    @Param() params: SymbolParamDto,
  ): Promise<VolatilityIntelligenceResult> {
    return this.volatilityIntelligenceService.analyze(params.symbol);
  }
}
