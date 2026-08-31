import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ClassifyRegimeDto } from './dto/classify-regime.dto.js';
import { ClassifySymbolQueryDto } from './dto/classify-symbol.dto.js';
import { SymbolParamDto } from './dto/symbol-param.dto.js';
import type { RegimeClassificationResult } from './interfaces/regime-result.interface.js';
import { RegimeService } from './regime.service.js';

@Controller('regime')
export class RegimeController {
  constructor(private readonly regimeService: RegimeService) {}

  @Post('classify')
  classify(
    @Body() dto: ClassifyRegimeDto,
  ): Promise<RegimeClassificationResult> {
    return this.regimeService.classify(dto.symbol, dto.candles);
  }

  /** Classifies a symbol from market data fetched on demand. */
  @Get(':symbol')
  classifySymbol(
    @Param() params: SymbolParamDto,
    @Query() query: ClassifySymbolQueryDto,
  ): Promise<RegimeClassificationResult> {
    return this.regimeService.classifySymbol(
      params.symbol.trim().toUpperCase(),
      query.count,
    );
  }
}
