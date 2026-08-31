import { Module } from '@nestjs/common';
import { RegimeModule } from '../regime/regime.module.js';
import { SignalController } from './signal.controller.js';
import { SignalService } from './signal.service.js';

@Module({
  imports: [RegimeModule],
  controllers: [SignalController],
  providers: [SignalService],
  exports: [SignalService],
})
export class SignalModule {}
