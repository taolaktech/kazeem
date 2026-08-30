import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module.js';
import { IndicatorService } from './indicators/indicator.service.js';
import { RegimeController } from './regime.controller.js';
import { RegimeService } from './regime.service.js';

@Module({
  imports: [MarketDataModule],
  controllers: [RegimeController],
  providers: [IndicatorService, RegimeService],
  exports: [RegimeService],
})
export class RegimeModule {}
