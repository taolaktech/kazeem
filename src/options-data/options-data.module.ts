import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module.js';
import { OPTION_DATA_PROVIDER } from './interfaces/option-data-provider.interface.js';
import { MassiveOptionsService } from './massive/massive-options.service.js';
import { OptionsDataController } from './options-data.controller.js';
import { OptionsDataService } from './options-data.service.js';

@Module({
  imports: [MarketDataModule],
  controllers: [OptionsDataController],
  providers: [
    MassiveOptionsService,
    { provide: OPTION_DATA_PROVIDER, useExisting: MassiveOptionsService },
    OptionsDataService,
  ],
  exports: [OptionsDataService],
})
export class OptionsDataModule {}
