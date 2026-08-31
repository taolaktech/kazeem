import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module.js';
import { NewsIntelligenceModule } from '../news-intelligence/news-intelligence.module.js';
import { OptionSelectionModule } from '../option-selection/option-selection.module.js';
import { RegimeModule } from '../regime/regime.module.js';
import { SignalModule } from '../signal/signal.module.js';
import { VolatilityIntelligenceModule } from '../volatility-intelligence/volatility-intelligence.module.js';
import { TradeDecisionController } from './trade-decision.controller.js';
import { TradeDecisionService } from './trade-decision.service.js';

/** Top of the dependency graph: it consumes every layer and owns none. */
@Module({
  imports: [
    MarketDataModule,
    RegimeModule,
    SignalModule,
    OptionSelectionModule,
    NewsIntelligenceModule,
    VolatilityIntelligenceModule,
  ],
  controllers: [TradeDecisionController],
  providers: [TradeDecisionService],
  exports: [TradeDecisionService],
})
export class TradeDecisionModule {}
