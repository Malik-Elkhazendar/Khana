import 'reflect-metadata';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../app.module';
import { buildSwaggerDocument } from './swagger.bootstrap';

async function exportOpenApiSpec() {
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  try {
    const configService = app.get(ConfigService);
    const apiPrefix = configService.get<string>('API_PREFIX') || 'api';

    app.setGlobalPrefix(apiPrefix);
    app.enableVersioning({
      type: VersioningType.URI,
    });
    await app.init();

    const document = buildSwaggerDocument(app);
    const outputDir = join(process.cwd(), 'apps', 'api', 'openapi');
    const outputPath = join(outputDir, 'khana.v1.json');

    await mkdir(outputDir, { recursive: true });
    await writeFile(
      outputPath,
      `${JSON.stringify(document, null, 2)}\n`,
      'utf8'
    );

    process.stdout.write(`Exported OpenAPI spec to ${outputPath}\n`);
  } finally {
    await app.close();
  }
}

void exportOpenApiSpec();
