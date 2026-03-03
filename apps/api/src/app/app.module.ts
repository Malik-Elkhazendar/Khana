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
import { LoggingModule } from './logging';
import { normalizeNodeEnv, resolveEnvFilePaths } from './config/env-files';
import { FacilitiesModule } from './facilities/facilities.module';
import { UsersModule } from './users/users.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PromoCodesModule } from './promo-codes/promo-codes.module';

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
    LoggingModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const runtimeEnv = normalizeNodeEnv(
          configService.get<string>('NODE_ENV')
        );

        return {
          type: 'postgres' as const,
          url: configService.get<string>('DATABASE_URL'),
          autoLoadEntities: true,
          // Keep entity auto-sync for local developer velocity only.
          synchronize: runtimeEnv === 'development',
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Tenant, Facility, User, AuditLog]),
    NotificationModule,
    AuthModule,
    BookingsModule,
    FacilitiesModule,
    UsersModule,
    OnboardingModule,
    AnalyticsModule,
    PromoCodesModule,
  ],
  controllers: [AppController],
  providers: [AppService, SeedService],
})
export class AppModule {}
