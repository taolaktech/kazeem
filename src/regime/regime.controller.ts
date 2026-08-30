import { Body, Controller, Post } from '@nestjs/common';
import { ClassifyRegimeDto } from './dto/classify-regime.dto.js';
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
}
