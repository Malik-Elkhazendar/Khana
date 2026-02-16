/**
 * Khana API
 * B2B SaaS Booking Platform for MENA Region
 */

import 'reflect-metadata';
import { existsSync } from 'fs';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app/app.module';
import { HttpExceptionFilter } from '@khana/shared-utils';
import { normalizeNodeEnv, resolveEnvFilePaths } from '@khana/shared-utils';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpAdapterHost = app.get(HttpAdapterHost);
  const configService = app.get(ConfigService);
  const nodeEnv = normalizeNodeEnv(configService.get<string>('NODE_ENV'));

  // Global prefix for all routes
  const globalPrefix = configService.get<string>('API_PREFIX') || 'api';
  app.setGlobalPrefix(globalPrefix);

  // Enable URI Versioning (e.g. /api/v1/...)
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // Global HTTP exception filter (sanitizes 5xx responses)
  app.useGlobalFilters(new HttpExceptionFilter(httpAdapterHost));

  // Enable CORS for frontend (environment-aware)
  const corsOrigins =
    configService.get<string>('CORS_ORIGINS') ||
    configService.get<string>('CORS_ORIGIN') ||
    'http://localhost:4200';
  app.enableCors({
    origin: corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transform: true, // Auto-transform payloads to DTO instances
    })
  );

  const port = Number(
    configService.get<string>('API_PORT') ||
      configService.get<string>('PORT') ||
      3000
  );
  await app.listen(port);

  const loadedEnvFiles = resolveEnvFilePaths(nodeEnv)
    .filter((path) => existsSync(path))
    .map((path) => path.replace(`${process.cwd()}\\`, ''));

  Logger.log(`Environment: ${nodeEnv}`);
  Logger.log(
    `Env file order: ${
      loadedEnvFiles.length ? loadedEnvFiles.join(' -> ') : 'none'
    }`
  );
  Logger.log(
    `Khana API is running on: http://localhost:${port}/${globalPrefix}`
  );
  Logger.log(
    `Preview endpoint: POST http://localhost:${port}/${globalPrefix}/v1/bookings/preview`
  );
}

bootstrap();
