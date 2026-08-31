import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MarketDataModule } from '../market-data/market-data.module.js';
import { SignalModule } from '../signal/signal.module.js';
import { VolatilityIntelligenceController } from './volatility-intelligence.controller.js';
import { volatilityConfig } from './volatility-intelligence.config.js';
import { VolatilityIntelligenceService } from './volatility-intelligence.service.js';

@Module({
  imports: [
    ConfigModule.forFeature(volatilityConfig),
    MarketDataModule,
    SignalModule,
  ],
  controllers: [VolatilityIntelligenceController],
  providers: [VolatilityIntelligenceService],
  exports: [VolatilityIntelligenceService],
})
export class VolatilityIntelligenceModule {}
