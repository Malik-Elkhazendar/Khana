import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AuditAction, AuditLog, Tenant, User } from '@khana/data-access';
import { OwnerSignupDto, UserRole } from '@khana/shared-dtos';
import { LOG_EVENTS } from '../../logging';
import { RegisterDto, SignupOwnerDto } from '../dto';
import {
  AuthDependencies,
  SELF_REGISTRATION_BLOCKED_MESSAGE,
  generateAvailableAuthTenantSlug,
  isAuthUniqueViolation,
  issueAuthTokenPair,
  logAuthAudit,
  logAuthAuditWithRepository,
  mapAuthTenantToDto,
  mapAuthUserToDto,
  normalizeAuthEmail,
  normalizeAuthWorkspaceName,
  resolveAuthBaseTenantSlug,
  resolveAuthTenantId,
  validateAuthPasswordStrength,
} from './auth.internal';

/**
 * Auth signup workflows for workspace creation and first-user bootstrap.
 * Keep tenant bootstrap and self-registration rules here so the API facade
 * stays thin while the invariants remain transactionally enforced.
 */
export const signupAuthOwner = async (
  deps: AuthDependencies,
  dto: SignupOwnerDto | OwnerSignupDto,
  ipAddress?: string,
  userAgent?: string
) => {
  const workspaceName = normalizeAuthWorkspaceName(dto.workspaceName);
  const ownerEmail = normalizeAuthEmail(dto.email);
  const ownerName = dto.name.trim();
  const ownerPhone = dto.phone?.trim() || undefined;
  const requestedSlug = dto.workspaceSlug?.trim();

  validateAuthPasswordStrength(dto.password);

  try {
    const { tenant, owner } = await deps.dataSource.transaction(
      async (manager) => {
        const transactionalTenantRepository = manager.getRepository(Tenant);
        const transactionalUserRepository = manager.getRepository(User);
        const transactionalAuditRepository = manager.getRepository(AuditLog);

        const baseSlug = resolveAuthBaseTenantSlug(
          requestedSlug,
          workspaceName
        );
        // Resolve the final slug inside the transaction so concurrent signups
        // cannot both claim the same derived workspace name.
        const slug = await generateAvailableAuthTenantSlug(
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
          passwordHash: await deps.passwordService.hash(dto.password),
          role: UserRole.OWNER,
          tenantId: savedTenant.id,
          isActive: true,
        });
        const savedOwner = await transactionalUserRepository.save(owner);

        await logAuthAuditWithRepository(transactionalAuditRepository, {
          tenantId: savedTenant.id,
          userId: savedOwner.id,
          action: AuditAction.CREATE,
          entityType: 'Tenant',
          entityId: savedTenant.id,
          description: `Workspace created: ${savedTenant.name}`,
          ipAddress,
          userAgent,
        });

        await logAuthAuditWithRepository(transactionalAuditRepository, {
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

    const ownerWithTenant = (await deps.userRepository.findOne({
      where: { id: owner.id },
      relations: ['tenant'],
    })) ?? { ...owner, tenant };

    const tokens = await issueAuthTokenPair(
      deps,
      ownerWithTenant,
      ipAddress,
      userAgent
    );

    await logAuthAudit(deps, {
      tenantId: ownerWithTenant.tenantId,
      userId: ownerWithTenant.id,
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: ownerWithTenant.id,
      description: `Owner logged in after workspace signup: ${ownerWithTenant.email}`,
      ipAddress,
      userAgent,
    });

    deps.appLogger.info(
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
      user: mapAuthUserToDto(ownerWithTenant),
      tenant: mapAuthTenantToDto(ownerWithTenant.tenant),
    };
  } catch (error) {
    deps.appLogger.warn(
      LOG_EVENTS.AUTH_SIGNUP_OWNER_FAILED,
      'Owner signup failed',
      {
        workspaceName,
        requestedSlug: requestedSlug || undefined,
        email: ownerEmail,
        error: error instanceof Error ? error.message : 'unknown signup error',
      }
    );

    if (isAuthUniqueViolation(error, 'tenants_slug_unique')) {
      throw new ConflictException('Workspace slug is already in use.');
    }
    if (isAuthUniqueViolation(error, 'users_email_tenant_unique')) {
      throw new ConflictException(
        `Email ${ownerEmail} already registered in this workspace`
      );
    }

    throw error;
  }
};

export const registerAuthUser = async (
  deps: AuthDependencies,
  dto: RegisterDto,
  tenantId?: string,
  ipAddress?: string,
  userAgent?: string
) => {
  const resolvedTenantId = await resolveAuthTenantId(deps, tenantId);
  const normalizedEmail = normalizeAuthEmail(dto.email);
  const normalizedName = dto.name.trim();
  const normalizedPhone = dto.phone?.trim() || undefined;

  validateAuthPasswordStrength(dto.password);

  const passwordHash = await deps.passwordService.hash(dto.password);
  let savedUser: User;
  let initialRole: UserRole;

  try {
    const registrationResult = await deps.dataSource.transaction(
      async (manager) => {
        const transactionalUserRepository = manager.getRepository(User);
        const transactionalTenantRepository = manager.getRepository(Tenant);

        // Lock the tenant before counting users so "first user becomes owner"
        // cannot race under concurrent registration attempts.
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
          // Self-registration is only allowed for an empty workspace; later team
          // members must come through the invitation flow.
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
      deps.appLogger.warn(
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

  await logAuthAudit(deps, {
    tenantId: resolvedTenantId,
    userId: savedUser.id,
    action: AuditAction.CREATE,
    entityType: 'User',
    entityId: savedUser.id,
    description: `User registered: ${normalizedEmail}`,
    ipAddress,
    userAgent,
  });

  deps.appLogger.info(LOG_EVENTS.AUTH_REGISTER_SUCCESS, 'User registered', {
    userId: savedUser.id,
    tenantId: resolvedTenantId,
    role: initialRole,
  });

  const tokens = await issueAuthTokenPair(
    deps,
    savedUser,
    ipAddress,
    userAgent
  );

  await logAuthAudit(deps, {
    tenantId: resolvedTenantId,
    userId: savedUser.id,
    action: AuditAction.LOGIN,
    entityType: 'User',
    entityId: savedUser.id,
    description: `User logged in after registration: ${savedUser.email}`,
    ipAddress,
    userAgent,
  });

  const responseUser =
    (await deps.userRepository.findOne({
      where: { id: savedUser.id },
      relations: ['tenant'],
    })) ?? savedUser;
  const responseTenant =
    responseUser.tenant ??
    (await deps.tenantRepository.findOne({
      where: { id: responseUser.tenantId },
      select: ['id', 'name', 'slug', 'timezone'],
    }));

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    user: mapAuthUserToDto(responseUser),
    tenant: mapAuthTenantToDto(responseTenant),
  };
};
