/**
 * Khana API
 * B2B SaaS Booking Platform for MENA Region
 */

import 'reflect-metadata';
import { existsSync } from 'fs';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app/app.module';
import { normalizeNodeEnv, resolveEnvFilePaths } from './app/config/env-files';
import { validateJwtSecretsOrThrow } from './app/config/secret-validation';
import {
  AppLoggerService,
  HttpLoggingInterceptor,
  ContextHttpExceptionFilter,
  LOG_EVENTS,
} from './app/logging';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.disable('x-powered-by');

  const appLogger = app.get(AppLoggerService);
  app.useLogger(appLogger);

  const configService = app.get(ConfigService);
  const nodeEnv = normalizeNodeEnv(configService.get<string>('NODE_ENV'));
  validateJwtSecretsOrThrow(nodeEnv, configService);
  const trustProxy =
    (configService.get<string>('TRUST_PROXY') ?? 'false').toLowerCase() ===
    'true';

  if (trustProxy) {
    expressApp.set('trust proxy', 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      frameguard: { action: 'deny' },
      hsts: false,
    })
  );

  if (nodeEnv === 'production') {
    const hstsMiddleware = helmet.hsts({
      maxAge: 15_552_000,
      includeSubDomains: true,
      preload: false,
    });

    app.use((req: Request, res: Response, next: NextFunction) => {
      if (!req.secure) {
        next();
        return;
      }

      hstsMiddleware(req, res, next);
    });
  }

  // Global prefix for all routes
  const globalPrefix = configService.get<string>('API_PREFIX') || 'api';
  app.setGlobalPrefix(globalPrefix);

  // Enable URI Versioning (e.g. /api/v1/...)
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // Global HTTP exception filter (context-aware, structured logging)
  const exceptionFilter = app.get(ContextHttpExceptionFilter);
  app.useGlobalFilters(exceptionFilter);

  // Global HTTP logging interceptor
  const httpLoggingInterceptor = app.get(HttpLoggingInterceptor);
  app.useGlobalInterceptors(httpLoggingInterceptor);

  // Enable CORS for frontend (environment-aware)
  const corsOrigins =
    configService.get<string>('CORS_ORIGINS') ||
    configService.get<string>('CORS_ORIGIN') ||
    'http://localhost:4200';
  app.enableCors({
    origin: corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
    exposedHeaders: ['x-request-id'],
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

  appLogger.info(LOG_EVENTS.SYSTEM_STARTUP, `Environment: ${nodeEnv}`, {
    envFiles: loadedEnvFiles.length ? loadedEnvFiles : ['none'],
  });
  appLogger.info(
    LOG_EVENTS.SYSTEM_STARTUP,
    `Khana API is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
