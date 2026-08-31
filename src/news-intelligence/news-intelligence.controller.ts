import { Controller, Get, Param, Query } from '@nestjs/common';
import { SymbolParamDto } from '../regime/dto/symbol-param.dto.js';
import { NewsIntelligenceQueryDto } from './dto/news-intelligence-query.dto.js';
import type { NewsIntelligenceResult } from './interfaces/news-intelligence-result.interface.js';
import { NewsIntelligenceService } from './news-intelligence.service.js';

@Controller('news-intelligence')
export class NewsIntelligenceController {
  constructor(
    private readonly newsIntelligenceService: NewsIntelligenceService,
  ) {}

  /** Recent news context that could affect a symbol's directional outlook. */
  @Get(':symbol')
  getNewsIntelligence(
    @Param() params: SymbolParamDto,
    @Query() query: NewsIntelligenceQueryDto,
  ): Promise<NewsIntelligenceResult> {
    return this.newsIntelligenceService.getNewsIntelligence(
      params.symbol.trim().toUpperCase(),
      { lookbackHours: query.lookbackHours, limit: query.limit },
    );
  }
}
