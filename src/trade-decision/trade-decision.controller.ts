import { Controller, Get, Param, Query } from '@nestjs/common';
import { SymbolParamDto } from '../regime/dto/symbol-param.dto.js';
import { TradeDecisionQueryDto } from './dto/trade-decision-query.dto.js';
import type { TradeDecisionResult } from './interfaces/trade-decision-result.interface.js';
import { TradeDecisionService } from './trade-decision.service.js';

@Controller('trade-decision')
export class TradeDecisionController {
  constructor(private readonly tradeDecisionService: TradeDecisionService) {}

  /**
   * Central decision for a symbol: TRADE means the thesis may proceed to the
   * future 5-minute entry confirmation layer, not that an order should be sent.
   */
  @Get(':symbol')
  evaluate(
    @Param() params: SymbolParamDto,
    @Query() query: TradeDecisionQueryDto,
  ): Promise<TradeDecisionResult> {
    return this.tradeDecisionService.evaluate(
      params.symbol.trim().toUpperCase(),
      { maxBudget: query.maxBudget },
    );
  }
}
