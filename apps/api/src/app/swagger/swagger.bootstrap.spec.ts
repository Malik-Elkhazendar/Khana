import { INestApplication, Module, VersioningType } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { EmailService } from '@khana/notifications';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';
import { BookingsController } from '../bookings/bookings.controller';
import { BookingsService } from '../bookings/bookings.service';
import {
  buildSwaggerOperationId,
  configureSwagger,
  SWAGGER_BEARER_AUTH_SCHEME,
} from '.';

@Module({
  controllers: [BookingsController],
  providers: [
    {
      provide: BookingsService,
      useValue: {
        findAll: jest.fn(),
        createBooking: jest.fn(),
        createRecurringBookings: jest.fn(),
        updateStatus: jest.fn(),
        previewBooking: jest.fn(),
        getFacilities: jest.fn(),
        findOne: jest.fn(),
      },
    },
  ],
})
class SwaggerBookingsFeatureModule {}

describe('Swagger bootstrap', () => {
  let app: INestApplication | null = null;

  async function createApp(
    nodeEnv: 'development' | 'production',
    swaggerEnabled?: string
  ): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              SWAGGER_ENABLED: swaggerEnabled,
            }),
          ],
        }),
        SwaggerBookingsFeatureModule,
      ],
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: EmailService,
          useValue: {
            sendSecurityAlertStrict: jest.fn(),
          },
        },
      ],
    }).compile();

    const nestApp = moduleRef.createNestApplication();
    nestApp.setGlobalPrefix('api');
    nestApp.enableVersioning({
      type: VersioningType.URI,
    });

    configureSwagger(nestApp, {
      configService: nestApp.get(ConfigService),
      nodeEnv,
      featureModules: [SwaggerBookingsFeatureModule],
    });

    await nestApp.listen(0);
    return nestApp;
  }

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it('mounts docs and json when enabled in development', async () => {
    app = await createApp('development');
    const baseUrl = await app.getUrl();

    const uiResponse = await fetch(`${baseUrl}/api/docs`);
    expect(uiResponse.status).toBe(200);

    const jsonResponse = await fetch(`${baseUrl}/api/docs-json`);
    expect(jsonResponse.status).toBe(200);

    const document = (await jsonResponse.json()) as {
      paths?: Record<string, Record<string, { operationId?: string }>>;
      components?: {
        securitySchemes?: Record<string, unknown>;
        schemas?: Record<string, unknown>;
      };
    };

    expect(document.components?.securitySchemes).toHaveProperty(
      SWAGGER_BEARER_AUTH_SCHEME
    );
    expect(document.components?.schemas).toHaveProperty('CreateBookingDto');
    expect(document.components?.schemas).toHaveProperty(
      'BookingPreviewResponseDoc'
    );
    expect(document.paths).toHaveProperty('/api/v1/bookings');
    expect(document.paths?.['/api/v1/bookings']?.get?.operationId).toBe(
      buildSwaggerOperationId('BookingsController', 'findAll')
    );
    expect(document.paths?.['/api/v1/bookings']?.post?.operationId).toBe(
      buildSwaggerOperationId('BookingsController', 'createBooking')
    );
    expect(document.paths).not.toHaveProperty('/api/v1/test-email');
  });

  it('does not mount docs in production by default', async () => {
    app = await createApp('production');
    const baseUrl = await app.getUrl();

    const uiResponse = await fetch(`${baseUrl}/api/docs`);
    expect(uiResponse.status).toBe(404);

    const jsonResponse = await fetch(`${baseUrl}/api/docs-json`);
    expect(jsonResponse.status).toBe(404);
  });
});
