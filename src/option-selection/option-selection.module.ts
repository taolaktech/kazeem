import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module.js';
import { OptionsDataModule } from '../options-data/options-data.module.js';
import { SignalModule } from '../signal/signal.module.js';
import { OptionSelectionController } from './option-selection.controller.js';
import { OptionSelectionService } from './option-selection.service.js';

@Module({
  imports: [SignalModule, OptionsDataModule, MarketDataModule],
  controllers: [OptionSelectionController],
  providers: [OptionSelectionService],
  exports: [OptionSelectionService],
})
export class OptionSelectionModule {}
