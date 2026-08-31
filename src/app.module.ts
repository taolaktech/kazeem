import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { NewsIntelligenceModule } from './news-intelligence/news-intelligence.module.js';
import { OptionSelectionModule } from './option-selection/option-selection.module.js';
import { OptionsDataModule } from './options-data/options-data.module.js';
import { RegimeModule } from './regime/regime.module.js';
import { SignalModule } from './signal/signal.module.js';
import { TradeDecisionModule } from './trade-decision/trade-decision.module.js';
import { VolatilityIntelligenceModule } from './volatility-intelligence/volatility-intelligence.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    RegimeModule,
    OptionsDataModule,
    SignalModule,
    OptionSelectionModule,
    NewsIntelligenceModule,
    VolatilityIntelligenceModule,
    TradeDecisionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
