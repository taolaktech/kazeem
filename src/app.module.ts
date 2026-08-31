import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { OptionSelectionModule } from './option-selection/option-selection.module.js';
import { OptionsDataModule } from './options-data/options-data.module.js';
import { RegimeModule } from './regime/regime.module.js';
import { SignalModule } from './signal/signal.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    RegimeModule,
    OptionsDataModule,
    SignalModule,
    OptionSelectionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
