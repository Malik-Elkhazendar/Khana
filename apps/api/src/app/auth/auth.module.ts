import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { StringValue } from 'ms';
import { User, AuditLog, Tenant, RefreshToken } from '@khana/data-access';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordService } from './services/password.service';
import { JwtTokenService } from './services/jwt.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { MetricsService } from './services/metrics.service';
import { CleanupService } from './services/cleanup.service';

/**
 * Auth Module
 *
 * Provides authentication and authorization functionality:
 * - User registration and login
 * - JWT token management
 * - Password hashing
 * - Role-based access control
 * - Audit logging
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const expiresIn = (configService.get<string>('JWT_ACCESS_EXPIRES') ??
          '15m') as StringValue;
        return {
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User, AuditLog, Tenant, RefreshToken]),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 5,
        },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    JwtTokenService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    ThrottlerGuard,
    MetricsService,
    CleanupService,
  ],
  exports: [
    AuthService,
    PasswordService,
    JwtTokenService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
