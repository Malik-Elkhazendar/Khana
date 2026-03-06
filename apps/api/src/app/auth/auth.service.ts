import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import { DataSource, IsNull, MoreThan, Not, Repository } from 'typeorm';
import {
  User,
  AuditLog,
  AuditAction,
  RefreshToken,
  PasswordResetToken,
  Tenant,
} from '@khana/data-access';
import {
  DEFAULT_TENANT_TIMEZONE,
  normalizeIanaTimeZone,
  OwnerSignupDto,
  TenantResolveResponseDto,
  UserDto,
  UserRole,
} from '@khana/shared-dtos';
import { PasswordService } from './services/password.service';
import { JwtTokenService, JwtPayload } from './services/jwt.service';
import { EmailService } from '@khana/notifications';
import { MetricsService } from './services/metrics.service';
import { AppLoggerService, LOG_EVENTS } from '../logging';
import {
  hashDeviceFingerprint,
  hashRefreshToken,
  verifyRefreshTokenHash,
} from './utils/hmac.util';
import { isUUID } from 'class-validator';
import { LoginDto, RegisterDto, SignupOwnerDto } from './dto';

const MAX_TENANT_SLUG_LENGTH = 50;
const TENANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_TENANT_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'billing',
  'dashboard',
  'help',
  'internal',
  'login',
  'logout',
  'manager',
  'onboarding',
  'owner',
  'register',
  'root',
  'settings',
  'signup',
  'staff',
  'support',
  'system',
  'www',
]);

const SELF_REGISTRATION_BLOCKED_MESSAGE =
  'Direct registration is disabled for this workspace. Ask the owner for an invite.';

/**
 * Authentication Service
 *
 * Responsibilities:
 * - User registration with validation
 * - Login with credential verification
 * - Token refresh for rotation
 * - User lookup by email (multi-tenant aware)
 * - Password changes
 * - Audit logging for all mutations
 */
@Injectable()
export class AuthService {
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
  ) {}

  async getTenantContext(tenantId?: string): Promise<{
    id: string;
    name: string;
    slug: string;
    timezone: string;
  }> {
    const normalizedTenantId = tenantId?.trim();

    if (normalizedTenantId) {
      if (!isUUID(normalizedTenantId)) {
        throw new BadRequestException('Invalid tenant ID');
      }

      const tenant = await this.tenantRepository.findOne({
        where: { id: normalizedTenantId },
        select: ['id', 'name', 'slug', 'timezone'],
      });

      if (!tenant) {
        throw new BadRequestException('Invalid tenant ID');
      }

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        timezone: normalizeIanaTimeZone(tenant.timezone),
      };
    }

    const tenants = await this.tenantRepository.find({
      select: ['id', 'name', 'slug', 'timezone', 'createdAt'],
      order: { createdAt: 'ASC' },
      take: 2,
    });

    if (tenants.length === 0) {
      throw new NotFoundException('No tenant is configured');
    }

    if (tenants.length > 1) {
      throw new BadRequestException('Tenant ID is required');
    }

    const [tenant] = tenants;

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      timezone: normalizeIanaTimeZone(tenant.timezone),
    };
  }

  async resolveTenantBySlug(
    slug: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<TenantResolveResponseDto> {
    let normalizedSlug: string;
    try {
      normalizedSlug = this.normalizeTenantSlug(slug);
    } catch (error) {
      this.appLogger.warn(
        LOG_EVENTS.AUTH_TENANT_RESOLVE_FAILED,
        'Workspace slug resolution rejected',
        {
          slug,
          reason: 'invalid_format',
          ipAddress,
          userAgent,
        }
      );
      throw error;
    }

    const tenant = await this.tenantRepository.findOne({
      where: { slug: normalizedSlug },
      select: ['id', 'name', 'slug', 'timezone'],
    });

    if (!tenant) {
      this.appLogger.warn(
        LOG_EVENTS.AUTH_TENANT_RESOLVE_FAILED,
        'Workspace slug resolution failed',
        {
          slug: normalizedSlug,
          reason: 'not_found',
          ipAddress,
          userAgent,
        }
      );
      throw new NotFoundException('Workspace not found');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      timezone: normalizeIanaTimeZone(
        tenant.timezone ?? DEFAULT_TENANT_TIMEZONE
      ),
    };
  }

  async signupOwner(
    dto: SignupOwnerDto | OwnerSignupDto,
    ipAddress?: string,
    userAgent?: string
  ) {
    const workspaceName = this.normalizeWorkspaceName(dto.workspaceName);
    const ownerEmail = this.normalizeEmail(dto.email);
    const ownerName = dto.name.trim();
    const ownerPhone = dto.phone?.trim() || undefined;
    const requestedSlug = dto.workspaceSlug?.trim();

    this.validatePasswordStrength(dto.password);

    try {
      const { tenant, owner } = await this.dataSource.transaction(
        async (manager) => {
          const transactionalTenantRepository = manager.getRepository(Tenant);
          const transactionalUserRepository = manager.getRepository(User);
          const transactionalAuditRepository = manager.getRepository(AuditLog);

          const baseSlug = this.resolveBaseTenantSlug(
            requestedSlug,
            workspaceName
          );
          const slug = await this.generateAvailableTenantSlug(
            transactionalTenantRepository,
            baseSlug
          );

          const tenant = transactionalTenantRepository.create({
            name: workspaceName,
            slug,
            onboardingCompleted: false,
            onboardingCompletedAt: null,
          });
          const savedTenant = await transactionalTenantRepository.save(tenant);

          const owner = transactionalUserRepository.create({
            email: ownerEmail,
            name: ownerName,
            phone: ownerPhone,
            passwordHash: await this.passwordService.hash(dto.password),
            role: UserRole.OWNER,
            tenantId: savedTenant.id,
            isActive: true,
          });
          const savedOwner = await transactionalUserRepository.save(owner);

          await this.logAuditWithRepository(transactionalAuditRepository, {
            tenantId: savedTenant.id,
            userId: savedOwner.id,
            action: AuditAction.CREATE,
            entityType: 'Tenant',
            entityId: savedTenant.id,
            description: `Workspace created: ${savedTenant.name}`,
            ipAddress,
            userAgent,
          });

          await this.logAuditWithRepository(transactionalAuditRepository, {
            tenantId: savedTenant.id,
            userId: savedOwner.id,
            action: AuditAction.CREATE,
            entityType: 'User',
            entityId: savedOwner.id,
            description: `Owner account created: ${savedOwner.email}`,
            ipAddress,
            userAgent,
          });

          return { tenant: savedTenant, owner: savedOwner };
        }
      );

      const ownerWithTenant = (await this.userRepository.findOne({
        where: { id: owner.id },
        relations: ['tenant'],
      })) ?? { ...owner, tenant };

      const tokens = await this.issueTokenPair(
        ownerWithTenant,
        ipAddress,
        userAgent
      );

      await this.logAudit({
        tenantId: ownerWithTenant.tenantId,
        userId: ownerWithTenant.id,
        action: AuditAction.LOGIN,
        entityType: 'User',
        entityId: ownerWithTenant.id,
        description: `Owner logged in after workspace signup: ${ownerWithTenant.email}`,
        ipAddress,
        userAgent,
      });

      this.appLogger.info(
        LOG_EVENTS.AUTH_SIGNUP_OWNER_SUCCESS,
        'Owner signup completed',
        {
          tenantId: tenant.id,
          userId: owner.id,
          slug: tenant.slug,
        }
      );

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: this.toUserDto(ownerWithTenant),
        tenant: this.toTenantDto(ownerWithTenant.tenant),
      };
    } catch (error) {
      this.appLogger.warn(
        LOG_EVENTS.AUTH_SIGNUP_OWNER_FAILED,
        'Owner signup failed',
        {
          workspaceName,
          requestedSlug: requestedSlug || undefined,
          email: ownerEmail,
          error:
            error instanceof Error ? error.message : 'unknown signup error',
        }
      );

      if (this.isUniqueViolation(error, 'tenants_slug_unique')) {
        throw new ConflictException('Workspace slug is already in use.');
      }
      if (this.isUniqueViolation(error, 'users_email_tenant_unique')) {
        throw new ConflictException(
          `Email ${ownerEmail} already registered in this workspace`
        );
      }

      throw error;
    }
  }

  /**
   * Register a new user
   *
   * Validation:
   * - Email must be unique within tenant
   * - Password must meet requirements
   * - First user becomes OWNER (no explicit role assignment)
   */
  async register(
    dto: RegisterDto,
    tenantId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const resolvedTenantId = await this.resolveTenantId(tenantId);
    const normalizedEmail = this.normalizeEmail(dto.email);
    const normalizedName = dto.name.trim();
    const normalizedPhone = dto.phone?.trim() || undefined;

    // Validate password strength
    this.validatePasswordStrength(dto.password);

    const passwordHash = await this.passwordService.hash(dto.password);
    let savedUser: User;
    let initialRole: UserRole;

    try {
      const registrationResult = await this.dataSource.transaction(
        async (manager) => {
          const transactionalUserRepository = manager.getRepository(User);
          const transactionalTenantRepository = manager.getRepository(Tenant);

          const lockedTenant = await transactionalTenantRepository
            .createQueryBuilder('tenant')
            .where('tenant.id = :tenantId', { tenantId: resolvedTenantId })
            .setLock('pessimistic_write')
            .getOne();

          if (!lockedTenant) {
            throw new BadRequestException('Invalid tenant ID');
          }

          const existingUser = await transactionalUserRepository.findOne({
            where: { email: normalizedEmail, tenantId: resolvedTenantId },
          });
          if (existingUser) {
            throw new ConflictException(
              `Email ${normalizedEmail} already registered in this tenant`
            );
          }

          const userCount = await transactionalUserRepository.count({
            where: { tenantId: resolvedTenantId },
          });
          if (userCount > 0) {
            throw new ForbiddenException(SELF_REGISTRATION_BLOCKED_MESSAGE);
          }

          const role = UserRole.OWNER;

          const user = transactionalUserRepository.create({
            email: normalizedEmail,
            name: normalizedName,
            phone: normalizedPhone,
            passwordHash,
            role,
            tenantId: resolvedTenantId,
            isActive: true,
          });
          const saved = await transactionalUserRepository.save(user);
          return { savedUser: saved, initialRole: role };
        }
      );

      savedUser = registrationResult.savedUser;
      initialRole = registrationResult.initialRole;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        this.appLogger.warn(
          LOG_EVENTS.AUTH_REGISTER_BLOCKED_NONEMPTY_TENANT,
          'Registration blocked for non-empty tenant',
          {
            tenantId: resolvedTenantId,
            email: normalizedEmail,
          }
        );
      }
      throw error;
    }
    const saved = savedUser;

    // Log audit event
    await this.logAudit({
      tenantId: resolvedTenantId,
      userId: saved.id,
      action: AuditAction.CREATE,
      entityType: 'User',
      entityId: saved.id,
      description: `User registered: ${normalizedEmail}`,
      ipAddress,
      userAgent,
    });

    this.appLogger.info(LOG_EVENTS.AUTH_REGISTER_SUCCESS, 'User registered', {
      userId: saved.id,
      tenantId: resolvedTenantId,
      role: initialRole,
    });

    // Auto-login after registration
    const tokens = await this.issueTokenPair(saved, ipAddress, userAgent);

    await this.logAudit({
      tenantId: resolvedTenantId,
      userId: saved.id,
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: saved.id,
      description: `User logged in after registration: ${saved.email}`,
      ipAddress,
      userAgent,
    });

    const responseUser =
      (await this.userRepository.findOne({
        where: { id: saved.id },
        relations: ['tenant'],
      })) ?? saved;
    const responseTenant =
      responseUser.tenant ??
      (await this.tenantRepository.findOne({
        where: { id: responseUser.tenantId },
        select: ['id', 'name', 'slug', 'timezone'],
      }));

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.toUserDto(responseUser),
      tenant: this.toTenantDto(responseTenant),
    };
  }

  /**
   * Login user with email and password
   *
   * Returns JWT tokens and user info
   */
  async login(
    dto: LoginDto,
    tenantId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const resolvedTenantId = await this.resolveTenantIdForLogin(
      normalizedEmail,
      tenantId
    );
    // Find user by email within tenant
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail, tenantId: resolvedTenantId },
      select: [
        'id',
        'email',
        'name',
        'passwordHash',
        'role',
        'isActive',
        'tenantId',
      ],
      relations: ['tenant'],
    });

    if (!user) {
      this.appLogger.warn(
        LOG_EVENTS.AUTH_LOGIN_FAILED,
        'Login failed: user not found',
        {
          tenantId: resolvedTenantId,
        }
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      this.appLogger.warn(
        LOG_EVENTS.AUTH_LOGIN_FAILED,
        'Login failed: user inactive',
        {
          tenantId: resolvedTenantId,
          userId: user.id,
        }
      );
      throw new UnauthorizedException('User account is inactive');
    }

    // Verify password
    const passwordValid = await this.passwordService.verify(
      dto.password,
      user.passwordHash
    );

    if (!passwordValid) {
      this.appLogger.warn(
        LOG_EVENTS.AUTH_LOGIN_FAILED,
        'Login failed: invalid password',
        {
          tenantId: resolvedTenantId,
          userId: user.id,
        }
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
    });

    const tokens = await this.issueTokenPair(user, ipAddress, userAgent);

    // Log audit event
    await this.logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: user.id,
      description: `User logged in: ${user.email}`,
      ipAddress,
      userAgent,
    });

    this.appLogger.info(LOG_EVENTS.AUTH_LOGIN_SUCCESS, 'User logged in', {
      userId: user.id,
      tenantId: user.tenantId,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.toUserDto(user),
      tenant: this.toTenantDto(user.tenant),
    };
  }

  /**
   * Refresh access token using refresh token
   *
   * Pattern: Token Rotation (refresh token used once, new pair issued)
   */
  async refreshToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const startTime = Date.now();
    let payload: JwtPayload;

    try {
      payload = this.jwtTokenService.verifyRefreshToken(refreshToken);
    } catch (error) {
      this.metricsService.trackFailedRefresh('jwt_invalid');
      throw error;
    }

    if (payload.typ !== 'refresh') {
      this.metricsService.trackFailedRefresh('invalid_type');
      throw new UnauthorizedException('Invalid token type');
    }

    if (!payload.jti || !payload.sid) {
      this.metricsService.trackFailedRefresh('missing_claims');
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshTokenRecord = await this.refreshTokenRepository.findOne({
      where: { id: payload.jti },
      relations: ['user'],
    });

    if (!refreshTokenRecord) {
      this.metricsService.trackFailedRefresh('not_found');
      throw new UnauthorizedException('Refresh token not found');
    }

    if (refreshTokenRecord.userId !== payload.sub) {
      this.metricsService.trackFailedRefresh('subject_mismatch');
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (refreshTokenRecord.sessionId !== payload.sid) {
      this.metricsService.trackFailedRefresh('session_mismatch');
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (refreshTokenRecord.expiresAt < new Date()) {
      this.metricsService.trackFailedRefresh('db_expired');
      throw new UnauthorizedException('Refresh token expired');
    }

    if (refreshTokenRecord.revokedAt) {
      await this.handleTokenReuse(refreshTokenRecord, ipAddress, userAgent);
      this.metricsService.trackFailedRefresh('revoked_reuse');
      throw new UnauthorizedException('Session revoked due to security policy');
    }

    const isValidHash = verifyRefreshTokenHash(
      refreshToken,
      refreshTokenRecord.tokenHash,
      this.getHmacSecret()
    );
    if (!isValidHash) {
      this.metricsService.trackFailedRefresh('hash_mismatch');
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (refreshTokenRecord.user && !refreshTokenRecord.user.isActive) {
      this.metricsService.trackFailedRefresh('user_inactive');
      throw new UnauthorizedException('User account is inactive');
    }

    if (refreshTokenRecord.user && refreshTokenRecord.user.deletedAt) {
      this.metricsService.trackFailedRefresh('user_deleted');
      throw new UnauthorizedException('User account has been deleted');
    }

    const reuseErrorMessage = 'REFRESH_TOKEN_CONCURRENT_USE';

    try {
      const result = await this.dataSource.transaction(
        'SERIALIZABLE',
        async (manager) => {
          const now = new Date();
          const newTokenId = randomUUID();
          const updateResult = await manager.update(
            RefreshToken,
            { id: payload.jti, revokedAt: IsNull() },
            {
              revokedAt: now,
              replacedByTokenId: newTokenId,
            }
          );

          if (!updateResult.affected) {
            throw new Error(reuseErrorMessage);
          }

          const newPayload: JwtPayload = {
            sub: refreshTokenRecord.userId,
            email: refreshTokenRecord.user?.email || payload.email,
            role: refreshTokenRecord.user?.role || payload.role,
            tenantId: refreshTokenRecord.user?.tenantId || payload.tenantId,
            sid: payload.sid,
            jti: newTokenId,
          };

          const newTokens = this.jwtTokenService.generateTokenPair(newPayload);

          await manager.save(RefreshToken, {
            id: newTokenId,
            userId: refreshTokenRecord.userId,
            sessionId: payload.sid,
            tokenHash: hashRefreshToken(
              newTokens.refreshToken,
              this.getHmacSecret()
            ),
            issuedAt: now,
            expiresAt: this.getRefreshTokenExpiry(now),
            ipAddress,
            userAgent,
            deviceFingerprint: hashDeviceFingerprint(
              ipAddress,
              userAgent,
              this.getHmacSecret()
            ),
          });

          return {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            expiresIn: newTokens.expiresIn,
          };
        }
      );

      this.metricsService.trackTokenRotation(
        refreshTokenRecord.userId,
        Date.now() - startTime
      );

      this.appLogger.info(LOG_EVENTS.AUTH_REFRESH_ROTATED, 'Token rotated', {
        userId: refreshTokenRecord.userId,
        sessionId: payload.sid,
      });

      return result;
    } catch (error) {
      if (error instanceof Error && error.message === reuseErrorMessage) {
        await this.handleTokenReuse(refreshTokenRecord, ipAddress, userAgent);
        this.metricsService.trackFailedRefresh('concurrent_reuse');
        throw new UnauthorizedException('Concurrent token use detected');
      }
      throw error;
    }
  }

  /**
   * Logout user by invalidating refresh token
   */
  async logout(
    userId: string,
    sessionId?: string,
    refreshToken?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'tenantId', 'email'],
    });

    if (!user) {
      return; // Silently succeed if user not found
    }

    let targetSessionId = sessionId;
    let targetTokenId: string | undefined;

    if (!targetSessionId && refreshToken) {
      try {
        const payload = this.jwtTokenService.verifyRefreshToken(refreshToken);
        if (payload.sub === userId) {
          targetSessionId = payload.sid;
          targetTokenId = payload.jti;
        }
      } catch {
        // Ignore invalid refresh token on logout
      }
    }

    const now = new Date();
    if (targetSessionId) {
      await this.refreshTokenRepository.update(
        { userId, sessionId: targetSessionId, revokedAt: IsNull() },
        { revokedAt: now }
      );
    } else if (targetTokenId) {
      await this.refreshTokenRepository.update(
        { id: targetTokenId, userId, revokedAt: IsNull() },
        { revokedAt: now }
      );
    } else {
      await this.refreshTokenRepository.update(
        { userId, revokedAt: IsNull() },
        { revokedAt: now }
      );
    }

    // Log audit event
    await this.logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditAction.LOGOUT,
      entityType: 'User',
      entityId: user.id,
      description: `User logged out: ${user.email}`,
      ipAddress,
      userAgent,
    });

    this.appLogger.info(LOG_EVENTS.AUTH_LOGOUT, 'User logged out', {
      userId: user.id,
      tenantId: user.tenantId,
    });
  }

  /**
   * Logout a specific device/session
   */
  async logoutDevice(sessionId: string, userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'tenantId', 'email'],
    });

    if (!user) {
      return;
    }

    await this.refreshTokenRepository.update(
      { sessionId, userId, revokedAt: IsNull() },
      { revokedAt: new Date() }
    );

    await this.logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditAction.LOGOUT,
      entityType: 'User',
      entityId: user.id,
      description: `User logged out device session: ${sessionId}`,
    });

    this.appLogger.info(
      LOG_EVENTS.AUTH_LOGOUT_DEVICE,
      'Device session logged out',
      {
        userId: user.id,
        sessionId,
      }
    );
  }

  /**
   * Logout all devices/sessions for a user
   */
  async logoutAllDevices(
    userId: string,
    exceptSessionId?: string
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'tenantId', 'email'],
    });

    if (!user) {
      return;
    }

    const where: Record<string, unknown> = {
      userId,
      revokedAt: IsNull(),
    };

    if (exceptSessionId) {
      where.sessionId = Not(exceptSessionId);
    }

    await this.refreshTokenRepository.update(where, { revokedAt: new Date() });

    await this.logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditAction.LOGOUT,
      entityType: 'User',
      entityId: user.id,
      description: `User logged out all devices`,
    });

    this.appLogger.info(
      LOG_EVENTS.AUTH_LOGOUT_ALL_DEVICES,
      'All devices logged out',
      {
        userId: user.id,
        tenantId: user.tenantId,
        exceptSessionId,
      }
    );
  }

  /**
   * Get user by ID (for current user info)
   */
  async getCurrentUser(userId: string): Promise<UserDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['tenant'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserDto(user);
  }

  /**
   * Change user password
   *
   * Requires old password verification
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    currentSessionId?: string
  ): Promise<void> {
    this.validatePasswordStrength(newPassword);

    if (!oldPassword?.trim()) {
      throw new BadRequestException('Current password is required');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'passwordHash', 'tenantId', 'email'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oldPasswordValid = await this.passwordService.verify(
      oldPassword,
      user.passwordHash
    );

    if (!oldPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newPasswordHash = await this.passwordService.hash(newPassword);
    await this.userRepository.update(userId, {
      passwordHash: newPasswordHash,
    });

    // Invalidate all other sessions (keep current session alive)
    const where: Record<string, unknown> = {
      userId,
      revokedAt: IsNull(),
    };
    if (currentSessionId) {
      where.sessionId = Not(currentSessionId);
    }

    await this.refreshTokenRepository.update(where, { revokedAt: new Date() });

    // Log audit event
    await this.logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: user.id,
      description: `User changed password: ${user.email}`,
    });

    this.appLogger.info(LOG_EVENTS.AUTH_PASSWORD_CHANGED, 'Password changed', {
      userId: user.id,
      tenantId: user.tenantId,
    });

    // Notify user of password change
    try {
      await this.emailService.sendPasswordChangedNotification({
        recipientEmail: user.email,
        recipientName: user.email,
      });
    } catch {
      // Email failure should not block password change
    }
  }

  /**
   * Forgot password - request a reset token
   *
   * Always returns a success message to prevent email enumeration.
   * Only sends the email if the user exists, is active, and not soft-deleted.
   */
  async forgotPassword(
    email: string,
    tenantId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ message: string }> {
    const genericMessage = 'If that email exists, a reset link has been sent';
    const resolvedTenantId = await this.resolveTenantId(tenantId);
    const normalizedEmail = this.normalizeEmail(email);

    const user = await this.userRepository.findOne({
      where: {
        email: normalizedEmail,
        tenantId: resolvedTenantId,
        deletedAt: IsNull(),
      },
      select: ['id', 'email', 'tenantId', 'isActive'],
    });

    if (!user || !user.isActive) {
      return { message: genericMessage };
    }

    // Invalidate any existing unused reset tokens for this user
    await this.passwordResetTokenRepository.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() }
    );

    // Generate a cryptographically secure token
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHmac('sha256', this.getHmacSecret())
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.passwordResetTokenRepository.save({
      userId: user.id,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    });

    // Build reset URL if FRONTEND_URL is configured
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const frontendBase = frontendUrl?.replace(/\/+$/, '');
    const resetUrl = frontendBase
      ? `${frontendBase}/reset-password?token=${encodeURIComponent(rawToken)}`
      : undefined;

    try {
      await this.emailService.sendPasswordResetNotification({
        recipientEmail: user.email,
        resetToken: rawToken,
        resetUrl,
        expiresAt,
      });
    } catch {
      // Email failure should not block the response
    }

    await this.logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'PasswordResetToken',
      entityId: user.id,
      description: `Password reset requested for: ${user.email}`,
      ipAddress,
      userAgent,
    });

    this.appLogger.info(
      LOG_EVENTS.AUTH_PASSWORD_RESET_REQUESTED,
      'Password reset requested',
      {
        userId: user.id,
        tenantId: user.tenantId,
      }
    );

    return { message: genericMessage };
  }

  /**
   * Reset password using a valid token
   *
   * Validates the token, updates the password, marks the token as used,
   * and invalidates all existing sessions.
   */
  async resetPassword(
    token: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ message: string }> {
    this.validatePasswordStrength(newPassword);

    const tokenHash = createHmac('sha256', this.getHmacSecret())
      .update(token)
      .digest('hex');

    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: {
        tokenHash,
        usedAt: IsNull(),
      },
      relations: ['user'],
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const user = resetToken.user;
    if (!user || user.deletedAt || !user.isActive) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    // Hash new password and update user
    const passwordHash = await this.passwordService.hash(newPassword);
    await this.userRepository.update(user.id, { passwordHash });

    // Mark token as used
    await this.passwordResetTokenRepository.update(resetToken.id, {
      usedAt: new Date(),
    });

    // Invalidate all existing sessions
    await this.refreshTokenRepository.update(
      { userId: user.id, revokedAt: IsNull() },
      { revokedAt: new Date() }
    );

    await this.logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: user.id,
      description: `Password reset completed for: ${user.email}`,
      ipAddress,
      userAgent,
    });

    this.appLogger.info(
      LOG_EVENTS.AUTH_PASSWORD_RESET_COMPLETED,
      'Password reset completed',
      {
        userId: user.id,
        tenantId: user.tenantId,
      }
    );

    // Notify user of password change
    try {
      await this.emailService.sendPasswordChangedNotification({
        recipientEmail: user.email,
        recipientName: user.email,
      });
    } catch {
      // Email failure should not block the response
    }

    return { message: 'Password has been reset successfully' };
  }

  // Private helpers

  private validatePasswordStrength(password: string): void {
    if (!password || password.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long'
      );
    }

    const hasNumber = /\d/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);

    if (!hasNumber || !hasUpperCase || !hasLowerCase) {
      throw new BadRequestException(
        'Password must contain uppercase, lowercase, and numbers'
      );
    }
  }

  private toUserDto(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role as UserRole,
      isActive: user.isActive,
      onboardingCompleted: user.tenant?.onboardingCompleted ?? false,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      tenantId: user.tenantId || user.tenant?.id || 'unknown',
    };
  }

  private toTenantDto(
    tenant?: Pick<Tenant, 'id' | 'name' | 'slug' | 'timezone'> | null
  ):
    | { id: string; name: string; slug?: string; timezone?: string }
    | undefined {
    if (!tenant?.id) {
      return undefined;
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      timezone: normalizeIanaTimeZone(
        tenant.timezone ?? DEFAULT_TENANT_TIMEZONE
      ),
    };
  }

  private normalizeWorkspaceName(name: string): string {
    const normalizedName = name?.trim();
    if (!normalizedName) {
      throw new BadRequestException('Workspace name is required');
    }
    return normalizedName;
  }

  private normalizeEmail(email: string): string {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }
    return normalizedEmail;
  }

  private resolveBaseTenantSlug(
    requestedSlug: string | undefined,
    workspaceName: string
  ): string {
    const normalizedRequestedSlug = requestedSlug?.trim();
    if (normalizedRequestedSlug) {
      return this.normalizeTenantSlug(normalizedRequestedSlug);
    }

    const derivedSlug = this.slugify(workspaceName);
    if (derivedSlug && !RESERVED_TENANT_SLUGS.has(derivedSlug)) {
      return derivedSlug;
    }
    if (derivedSlug) {
      const derivedFallback = this.slugify(`${derivedSlug}-workspace`);
      if (derivedFallback && !RESERVED_TENANT_SLUGS.has(derivedFallback)) {
        return derivedFallback;
      }
    }

    return this.assertAllowedSlug(
      `workspace-${randomBytes(4).toString('hex').toLowerCase()}`
    );
  }

  private normalizeTenantSlug(slug: string): string {
    const normalizedSlug = slug?.trim().toLowerCase();
    if (!normalizedSlug) {
      throw new BadRequestException('Workspace slug is required');
    }
    if (normalizedSlug.length > MAX_TENANT_SLUG_LENGTH) {
      throw new BadRequestException('Workspace slug is too long');
    }
    if (!TENANT_SLUG_PATTERN.test(normalizedSlug)) {
      throw new BadRequestException('Workspace slug format is invalid');
    }
    return this.assertAllowedSlug(normalizedSlug);
  }

  private slugify(value: string): string {
    return (value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_TENANT_SLUG_LENGTH)
      .replace(/-+$/g, '');
  }

  private assertAllowedSlug(slug: string): string {
    if (RESERVED_TENANT_SLUGS.has(slug)) {
      throw new BadRequestException('Workspace slug is reserved');
    }
    return slug;
  }

  private withSlugSuffix(baseSlug: string, suffix: number): string {
    const suffixToken = `-${suffix}`;
    const trimmedBase = baseSlug.slice(
      0,
      Math.max(1, MAX_TENANT_SLUG_LENGTH - suffixToken.length)
    );
    return `${trimmedBase}${suffixToken}`;
  }

  private async generateAvailableTenantSlug(
    tenantRepository: Repository<Tenant>,
    baseSlug: string
  ): Promise<string> {
    let candidateSlug = baseSlug;
    let suffix = 2;

    while (await tenantRepository.exists({ where: { slug: candidateSlug } })) {
      candidateSlug = this.assertAllowedSlug(
        this.withSlugSuffix(baseSlug, suffix)
      );
      suffix += 1;
    }

    return candidateSlug;
  }

  private isUniqueViolation(
    error: unknown,
    constraintName?: string
  ): error is { code?: string; constraint?: string } {
    if (typeof error !== 'object' || !error) {
      return false;
    }

    const maybePgError = error as { code?: string; constraint?: string };
    if (maybePgError.code !== '23505') {
      return false;
    }

    if (!constraintName) {
      return true;
    }

    return maybePgError.constraint === constraintName;
  }

  private async resolveTenantId(tenantId?: string): Promise<string> {
    if (!tenantId || !isUUID(tenantId)) {
      throw new BadRequestException('Tenant ID is required');
    }

    const tenantExists = await this.tenantRepository.exists({
      where: { id: tenantId },
    });

    if (!tenantExists) {
      throw new BadRequestException('Invalid tenant ID');
    }

    return tenantId;
  }

  private async resolveTenantIdForLogin(
    email: string,
    tenantId?: string
  ): Promise<string> {
    if (tenantId) {
      return this.resolveTenantId(tenantId);
    }

    const candidates = await this.userRepository.find({
      where: { email },
      select: ['id', 'tenantId'],
      take: 2,
    });

    if (candidates.length === 1 && candidates[0]?.tenantId) {
      return candidates[0].tenantId;
    }

    if (candidates.length > 1) {
      throw new BadRequestException(
        'Workspace is required. Please use your workspace login link.'
      );
    }

    throw new UnauthorizedException('Invalid email or password');
  }

  private getRefreshTokenExpiry(issuedAt: Date): Date {
    const ttlDays = parseInt(
      this.configService.get<string>('REFRESH_TOKEN_TTL_DAYS') || '7',
      10
    );
    return new Date(issuedAt.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  }

  private getHmacSecret(): string {
    const secret = this.configService.get<string>('REFRESH_TOKEN_HMAC_SECRET');
    if (!secret) {
      throw new Error('REFRESH_TOKEN_HMAC_SECRET is not set');
    }

    return secret;
  }

  private async handleTokenReuse(
    token: RefreshToken,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const now = new Date();
    await this.refreshTokenRepository.update(
      { sessionId: token.sessionId, revokedAt: IsNull() },
      { revokedAt: now }
    );

    const user =
      token.user ||
      (await this.userRepository.findOne({
        where: { id: token.userId },
        select: ['id', 'email', 'tenantId'],
      }));

    if (user) {
      await this.logAudit({
        tenantId: user.tenantId,
        userId: user.id,
        action: AuditAction.SECURITY_INCIDENT,
        entityType: 'RefreshToken',
        entityId: token.id,
        description: `Refresh token reuse detected - session ${token.sessionId} revoked`,
        ipAddress,
        userAgent,
      });

      await this.emailService.sendSecurityAlert({
        recipientEmail: user.email,
        recipientName: user.email,
        subject: 'Suspicious Activity Detected',
        message:
          'A previously used refresh token was presented. All sessions for that device have been logged out.',
        ipAddress,
      });
    }

    this.metricsService.trackReuseDetection(token.userId, token.sessionId);

    this.appLogger.warn(
      LOG_EVENTS.AUTH_REFRESH_REUSE_DETECTED,
      'Refresh token reuse detected',
      {
        userId: token.userId,
        sessionId: token.sessionId,
      }
    );

    const incidentCount = await this.getRecentSecurityIncidents(token.userId);
    if (incidentCount >= 3) {
      this.metricsService.trackSecurityEscalation(token.userId, incidentCount);
      this.appLogger.error(
        LOG_EVENTS.AUTH_SECURITY_ESCALATION,
        'Security escalation threshold exceeded',
        {
          userId: token.userId,
          incidentCount,
        }
      );
    }
  }

  private async getRecentSecurityIncidents(
    userId: string,
    windowMinutes = 60
  ): Promise<number> {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    return this.auditLogRepository.count({
      where: {
        userId,
        action: AuditAction.SECURITY_INCIDENT,
        createdAt: MoreThan(cutoff),
      },
    });
  }

  private async logAudit(params: {
    tenantId: string;
    userId?: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    description?: string;
    changes?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const auditLog = this.auditLogRepository.create({
      tenantId: params.tenantId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      description: params.description,
      changes: params.changes,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    await this.auditLogRepository.save(auditLog);
  }

  private async logAuditWithRepository(
    auditRepository: Repository<AuditLog>,
    params: {
      tenantId: string;
      userId?: string;
      action: AuditAction;
      entityType: string;
      entityId: string;
      description?: string;
      changes?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    const auditLog = auditRepository.create({
      tenantId: params.tenantId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      description: params.description,
      changes: params.changes,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    await auditRepository.save(auditLog);
  }

  private async issueTokenPair(
    user: User,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const sessionId = randomUUID();
    const tokenId = randomUUID();
    const issuedAt = new Date();

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      sid: sessionId,
      jti: tokenId,
    };

    const tokens = this.jwtTokenService.generateTokenPair(payload);

    await this.refreshTokenRepository.save({
      id: tokenId,
      userId: user.id,
      sessionId,
      tokenHash: hashRefreshToken(tokens.refreshToken, this.getHmacSecret()),
      issuedAt,
      expiresAt: this.getRefreshTokenExpiry(issuedAt),
      ipAddress,
      userAgent,
      deviceFingerprint: hashDeviceFingerprint(
        ipAddress,
        userAgent,
        this.getHmacSecret()
      ),
    });

    return tokens;
  }
}
