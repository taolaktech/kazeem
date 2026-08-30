import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { massiveConfig } from './market-data.config.js';
import { MarketDataService } from './market-data.service.js';
import { MassiveService } from './massive.service.js';

@Module({
  imports: [ConfigModule.forFeature(massiveConfig)],
  providers: [MassiveService, MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
