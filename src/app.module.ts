import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RegimeModule } from './regime/regime.module.js';

@Module({
  imports: [RegimeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
