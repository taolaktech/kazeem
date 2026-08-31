import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MarketDataModule } from '../market-data/market-data.module.js';
import { NewsIntelligenceController } from './news-intelligence.controller.js';
import { newsConfig } from './news-intelligence.config.js';
import { NewsIntelligenceService } from './news-intelligence.service.js';
import { MassiveNewsProvider } from './providers/massive-news.provider.js';
import {
  NEWS_PROVIDERS,
  type NewsProvider,
} from './providers/news-provider.interface.js';
import { SeekingAlphaRssProvider } from './providers/seeking-alpha-rss.provider.js';

@Module({
  imports: [ConfigModule.forFeature(newsConfig), MarketDataModule],
  controllers: [NewsIntelligenceController],
  providers: [
    MassiveNewsProvider,
    SeekingAlphaRssProvider,
    {
      provide: NEWS_PROVIDERS,
      useFactory: (
        massive: MassiveNewsProvider,
        seekingAlpha: SeekingAlphaRssProvider,
      ): NewsProvider[] =>
        seekingAlpha.enabled ? [massive, seekingAlpha] : [massive],
      inject: [MassiveNewsProvider, SeekingAlphaRssProvider],
    },
    NewsIntelligenceService,
  ],
  exports: [NewsIntelligenceService],
})
export class NewsIntelligenceModule {}
