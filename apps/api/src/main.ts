/**
 * Khana API
 * B2B SaaS Booking Platform for MENA Region
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { HttpAdapterHost } from '@nestjs/core';
import { HttpExceptionFilter } from '@khana/shared-utils';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpAdapterHost = app.get(HttpAdapterHost);

  // Global prefix for all routes
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Global HTTP exception filter (sanitizes 5xx responses)
  app.useGlobalFilters(new HttpExceptionFilter(httpAdapterHost));

  // Enable CORS for frontend
  app.enableCors({
    origin: ['http://localhost:4200', 'http://127.0.0.1:4200'], // Angular dev server
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

  const port = process.env.PORT || 3000;
  await app.listen(port);

  Logger.log(
    `🚀 Khana API is running on: http://localhost:${port}/${globalPrefix}`
  );
  Logger.log(
    `📖 Preview endpoint: POST http://localhost:${port}/${globalPrefix}/v1/bookings/preview`
  );
}

bootstrap();
