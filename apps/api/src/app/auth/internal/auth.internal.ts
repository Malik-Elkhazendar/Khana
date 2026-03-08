import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import {
  AuditLog,
  PasswordResetToken,
  RefreshToken,
  Tenant,
  User,
} from '@khana/data-access';
import { EmailService } from '@khana/notifications';
import { UserDto } from '@khana/shared-dtos';
import { DataSource } from 'typeorm';
import { AppLoggerService } from '../../logging';
import { JwtTokenService } from '../services/jwt.service';
import { MetricsService } from '../services/metrics.service';
import { PasswordService } from '../services/password.service';
import { AuthAuditParams, saveAuthAuditLog } from './auth-audit.helpers';
import { toTenantDto, toUserDto } from './auth-mappers';
import { validatePasswordStrength } from './auth-password-policy';
import {
  getHmacSecret,
  getRefreshTokenExpiry,
  handleTokenReuse,
  issueTokenPair,
} from './auth-session.helpers';
import {
  generateAvailableTenantSlug,
  isUniqueViolation,
  normalizeEmail,
  normalizeTenantSlug,
  normalizeWorkspaceName,
  resolveBaseTenantSlug,
  resolveTenantId,
  resolveTenantIdForLogin,
} from './auth-tenant.helpers';

export const SELF_REGISTRATION_BLOCKED_MESSAGE =
  'Direct registration is disabled for this workspace. Ask the owner for an invite.';

export type AuthDependencies = {
  userRepository: Repository<User>;
  auditLogRepository: Repository<AuditLog>;
  refreshTokenRepository: Repository<RefreshToken>;
  passwordResetTokenRepository: Repository<PasswordResetToken>;
  tenantRepository: Repository<Tenant>;
  dataSource: DataSource;
  passwordService: PasswordService;
  jwtTokenService: JwtTokenService;
  emailService: EmailService;
  metricsService: MetricsService;
  configService: ConfigService;
  appLogger: AppLoggerService;
};

export type AuthTokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export const validateAuthPasswordStrength = (password: string): void =>
  validatePasswordStrength(password);

export const mapAuthUserToDto = (user: User): UserDto => toUserDto(user);

export const mapAuthTenantToDto = (
  tenant?: Pick<Tenant, 'id' | 'name' | 'slug' | 'timezone'> | null
):
  | {
      id: string;
      name: string;
      slug?: string;
      timezone?: string;
    }
  | undefined => toTenantDto(tenant);

export const normalizeAuthWorkspaceName = (name: string): string =>
  normalizeWorkspaceName(name);

export const normalizeAuthEmail = (email: string): string =>
  normalizeEmail(email);

export const resolveAuthBaseTenantSlug = (
  requestedSlug: string | undefined,
  workspaceName: string
): string => resolveBaseTenantSlug(requestedSlug, workspaceName);

export const normalizeAuthTenantSlug = (slug: string): string =>
  normalizeTenantSlug(slug);

export const generateAvailableAuthTenantSlug = (
  tenantRepository: Repository<Tenant>,
  baseSlug: string
): Promise<string> => generateAvailableTenantSlug(tenantRepository, baseSlug);

export const isAuthUniqueViolation = (
  error: unknown,
  constraintName?: string
): error is { code?: string; constraint?: string } =>
  isUniqueViolation(error, constraintName);

export const resolveAuthTenantId = (
  deps: AuthDependencies,
  tenantId?: string
): Promise<string> => resolveTenantId(deps.tenantRepository, tenantId);

export const resolveAuthTenantIdForLogin = (
  deps: AuthDependencies,
  email: string,
  tenantId?: string
): Promise<string> =>
  resolveTenantIdForLogin(
    deps.userRepository,
    deps.tenantRepository,
    email,
    tenantId
  );

export const getAuthRefreshTokenExpiry = (
  deps: AuthDependencies,
  issuedAt: Date
): Date => getRefreshTokenExpiry(deps.configService, issuedAt);

export const getAuthHmacSecret = (deps: AuthDependencies): string =>
  getHmacSecret(deps.configService);

export const handleAuthTokenReuse = (
  deps: AuthDependencies,
  token: RefreshToken,
  ipAddress?: string,
  userAgent?: string
): Promise<void> =>
  handleTokenReuse({
    token,
    ipAddress,
    userAgent,
    refreshTokenRepository: deps.refreshTokenRepository,
    userRepository: deps.userRepository,
    auditLogRepository: deps.auditLogRepository,
    emailService: deps.emailService,
    metricsService: deps.metricsService,
    appLogger: deps.appLogger,
  });

export const logAuthAudit = (
  deps: AuthDependencies,
  params: AuthAuditParams
): Promise<void> => saveAuthAuditLog(deps.auditLogRepository, params);

export const logAuthAuditWithRepository = (
  auditRepository: Repository<AuditLog>,
  params: AuthAuditParams
): Promise<void> => saveAuthAuditLog(auditRepository, params);

export const issueAuthTokenPair = (
  deps: AuthDependencies,
  user: User,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthTokenPair> =>
  issueTokenPair({
    user,
    ipAddress,
    userAgent,
    jwtTokenService: deps.jwtTokenService,
    refreshTokenRepository: deps.refreshTokenRepository,
    configService: deps.configService,
  });
