import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RegimeModule } from './regime/regime.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    RegimeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
