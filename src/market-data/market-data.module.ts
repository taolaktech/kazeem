import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { marketSessionConfig, massiveConfig } from './market-data.config.js';
import { MarketDataService } from './market-data.service.js';
import { MassiveHttpClient } from './massive-http.client.js';
import { MassiveService } from './massive.service.js';

@Module({
  imports: [
    ConfigModule.forFeature(massiveConfig),
    ConfigModule.forFeature(marketSessionConfig),
  ],
  providers: [MassiveHttpClient, MassiveService, MarketDataService],
  exports: [MarketDataService, MassiveHttpClient],
})
export class MarketDataModule {}
