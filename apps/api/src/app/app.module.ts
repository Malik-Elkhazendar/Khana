import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BookingsModule } from './bookings/bookings.module';
import { AuthModule } from './auth/auth.module';
import { SeedService } from './seed.service';
import { Facility, Tenant, User, AuditLog } from '@khana/data-access';
import { NotificationModule } from '@khana/notifications';
import { normalizeNodeEnv, resolveEnvFilePaths } from './config/env-files';

const NODE_ENV = normalizeNodeEnv(process.env['NODE_ENV']);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: resolveEnvFilePaths(NODE_ENV),
      // Removed skipProcessEnv - was preventing env file loading
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        // TODO(PROD): replace synchronize with migrations in production.
        synchronize:
          normalizeNodeEnv(configService.get<string>('NODE_ENV')) !==
          'production',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Tenant, Facility, User, AuditLog]),
    NotificationModule,
    AuthModule,
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [AppService, SeedService],
})
export class AppModule {}
