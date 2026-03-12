import { INestApplication, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SWAGGER_FEATURE_MODULES } from './swagger.modules';
import {
  SWAGGER_BEARER_AUTH_SCHEME,
  SWAGGER_JSON_PATH,
  SWAGGER_UI_PATH,
} from './swagger.constants';

type NodeEnv = 'development' | 'production' | 'test';

export interface SwaggerBootstrapOptions {
  configService: ConfigService;
  nodeEnv: NodeEnv | string;
  featureModules?: Type<unknown>[];
}

function normalizeControllerKey(controllerKey: string): string {
  return controllerKey.replace(/Controller$/, '') || controllerKey;
}

export function buildSwaggerOperationId(
  controllerKey: string,
  methodKey: string
): string {
  return `${normalizeControllerKey(controllerKey)}_${methodKey}`;
}

function parseSwaggerEnabled(value?: string): boolean | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return null;
}

export function isSwaggerEnabled(
  nodeEnv: NodeEnv | string,
  swaggerEnabled?: string
): boolean {
  const parsed = parseSwaggerEnabled(swaggerEnabled);

  if (nodeEnv === 'development') {
    return parsed !== false;
  }

  return parsed === true;
}

export function buildSwaggerDocument(
  app: INestApplication,
  featureModules: Type<unknown>[] = SWAGGER_FEATURE_MODULES
) {
  const config = new DocumentBuilder()
    .setTitle('Khana API')
    .setDescription(
      'Internal OpenAPI documentation for validating and testing Khana API endpoints before frontend integration.'
    )
    .setVersion('1.0')
    .addServer('/', 'Relative server root for exported specs and local docs')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Use Authorization: Bearer <token> for protected endpoints.',
      },
      SWAGGER_BEARER_AUTH_SCHEME
    )
    .addSecurityRequirements(SWAGGER_BEARER_AUTH_SCHEME)
    .build();

  return SwaggerModule.createDocument(app, config, {
    include: featureModules,
    deepScanRoutes: true,
    operationIdFactory: buildSwaggerOperationId,
  });
}

export function configureSwagger(
  app: INestApplication,
  {
    configService,
    nodeEnv,
    featureModules = SWAGGER_FEATURE_MODULES,
  }: SwaggerBootstrapOptions
) {
  if (
    !isSwaggerEnabled(nodeEnv, configService.get<string>('SWAGGER_ENABLED'))
  ) {
    return null;
  }

  const document = buildSwaggerDocument(app, featureModules);

  SwaggerModule.setup(SWAGGER_UI_PATH, app, document, {
    useGlobalPrefix: true,
    jsonDocumentUrl: SWAGGER_JSON_PATH,
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: 'Khana API Docs',
  });

  return document;
}
