import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const DEFAULT_CORS_ORIGINS = ['http://localhost:5173'];

/** Comma-separated `CORS_ORIGINS`; `*` allows any origin. */
function corsOrigins(): string[] | '*' {
  const configured = process.env.CORS_ORIGINS?.trim();
  if (!configured) return DEFAULT_CORS_ORIGINS;
  if (configured === '*') return '*';
  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: corsOrigins(), methods: ['GET', 'POST'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
