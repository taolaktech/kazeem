import { Module } from '@nestjs/common';
import { IndicatorService } from './indicators/indicator.service.js';
import { RegimeController } from './regime.controller.js';
import { RegimeService } from './regime.service.js';

@Module({
  controllers: [RegimeController],
  providers: [IndicatorService, RegimeService],
  exports: [RegimeService],
})
export class RegimeModule {}
