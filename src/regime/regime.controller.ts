import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service.js';
import { ClassifyRegimeDto } from './dto/classify-regime.dto.js';
import { ClassifySymbolQueryDto } from './dto/classify-symbol.dto.js';
import { SymbolParamDto } from './dto/symbol-param.dto.js';
import type { RegimeClassificationResult } from './interfaces/regime-result.interface.js';
import { RegimeService } from './regime.service.js';

@Controller('regime')
export class RegimeController {
  constructor(
    private readonly regimeService: RegimeService,
    private readonly marketDataService: MarketDataService,
  ) {}

  @Post('classify')
  classify(
    @Body() dto: ClassifyRegimeDto,
  ): Promise<RegimeClassificationResult> {
    return this.regimeService.classify(dto.symbol, dto.candles);
  }

  /** Classifies a symbol from market data fetched on demand. */
  @Get(':symbol')
  async classifySymbol(
    @Param() params: SymbolParamDto,
    @Query() query: ClassifySymbolQueryDto,
  ): Promise<RegimeClassificationResult> {
    const symbol = params.symbol.trim().toUpperCase();
    const candles = await this.marketDataService.getRecentMinuteCandles(
      symbol,
      query.count,
    );
    return this.regimeService.classify(symbol, candles);
  }
}
