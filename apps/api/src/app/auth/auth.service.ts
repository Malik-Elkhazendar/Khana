import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  AuditLog,
  PasswordResetToken,
  RefreshToken,
  Tenant,
  User,
} from '@khana/data-access';
import {
  OwnerSignupDto,
  TenantResolveResponseDto,
  UserDto,
} from '@khana/shared-dtos';
import { EmailService } from '@khana/notifications';
import { LoginDto, RegisterDto, SignupOwnerDto } from './dto';
import { AppLoggerService } from '../logging';
import { JwtTokenService } from './services/jwt.service';
import { MetricsService } from './services/metrics.service';
import { PasswordService } from './services/password.service';
import { AuthDependencies } from './internal/auth.internal';
import {
  getAuthCurrentUser,
  changeAuthPassword,
  forgotAuthPassword,
  resetAuthPassword,
} from './internal/auth-account.workflows';
import {
  getAuthTenantContext,
  resolveAuthTenantBySlug,
} from './internal/auth-context.workflows';
import {
  loginAuthUser,
  logoutAuthAllDevices,
  logoutAuthDevice,
  logoutAuthUser,
  refreshAuthToken,
} from './internal/auth-session.workflows';
import {
  registerAuthUser,
  signupAuthOwner,
} from './internal/auth-signup.workflows';

@Injectable()
export class AuthService {
  private readonly deps: AuthDependencies;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly dataSource: DataSource,
    private readonly passwordService: PasswordService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly emailService: EmailService,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
    private readonly appLogger: AppLoggerService
  ) {
    this.deps = {
      userRepository,
      auditLogRepository,
      refreshTokenRepository,
      passwordResetTokenRepository,
      tenantRepository,
      dataSource,
      passwordService,
      jwtTokenService,
      emailService,
      metricsService,
      configService,
      appLogger,
    };
  }

  async getTenantContext(tenantId?: string): Promise<{
    id: string;
    name: string;
    slug: string;
    timezone: string;
  }> {
    return getAuthTenantContext(this.deps, tenantId);
  }

  async resolveTenantBySlug(
    slug: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<TenantResolveResponseDto> {
    return resolveAuthTenantBySlug(this.deps, slug, ipAddress, userAgent);
  }

  async signupOwner(
    dto: SignupOwnerDto | OwnerSignupDto,
    ipAddress?: string,
    userAgent?: string
  ) {
    return signupAuthOwner(this.deps, dto, ipAddress, userAgent);
  }

  async register(
    dto: RegisterDto,
    tenantId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return registerAuthUser(this.deps, dto, tenantId, ipAddress, userAgent);
  }

  async login(
    dto: LoginDto,
    tenantId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return loginAuthUser(this.deps, dto, tenantId, ipAddress, userAgent);
  }

  async refreshToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return refreshAuthToken(this.deps, refreshToken, ipAddress, userAgent);
  }

  async logout(
    userId: string,
    sessionId?: string,
    refreshToken?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    return logoutAuthUser(
      this.deps,
      userId,
      sessionId,
      refreshToken,
      ipAddress,
      userAgent
    );
  }

  async logoutDevice(sessionId: string, userId: string): Promise<void> {
    return logoutAuthDevice(this.deps, sessionId, userId);
  }

  async logoutAllDevices(
    userId: string,
    exceptSessionId?: string
  ): Promise<void> {
    return logoutAuthAllDevices(this.deps, userId, exceptSessionId);
  }

  async getCurrentUser(userId: string): Promise<UserDto> {
    return getAuthCurrentUser(this.deps, userId);
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    currentSessionId?: string
  ): Promise<void> {
    return changeAuthPassword(
      this.deps,
      userId,
      oldPassword,
      newPassword,
      currentSessionId
    );
  }

  async forgotPassword(
    email: string,
    tenantId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ message: string }> {
    return forgotAuthPassword(this.deps, email, tenantId, ipAddress, userAgent);
  }

  async resetPassword(
    token: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ message: string }> {
    return resetAuthPassword(
      this.deps,
      token,
      newPassword,
      ipAddress,
      userAgent
    );
  }
}
