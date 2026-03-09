import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';
import {
  AuditAction,
  AuditLog,
  PasswordResetToken,
  RefreshToken,
  User,
} from '@khana/data-access';
import { InviteUserResponseDto, UserDto, UserRole } from '@khana/shared-dtos';
import { EmailService } from '@khana/notifications';
import { IsNull, Repository } from 'typeorm';
import { AppLoggerService } from '../../logging';
import { PasswordService } from '../../auth/services/password.service';

export const ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
export const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';
export const OWNER_PROTECTED_MESSAGE =
  'Owner accounts cannot be modified through this endpoint.';
export const EMAIL_EXISTS_MESSAGE =
  'A user with this email already exists in this tenant.';

export const ASSIGNABLE_ROLES = new Set<UserRole>([
  UserRole.MANAGER,
  UserRole.STAFF,
  UserRole.VIEWER,
]);

export const INVITE_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
export const WORKSPACE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type Actor = Pick<User, 'id' | 'role' | 'tenantId' | 'email' | 'name'>;

export type UsersDependencies = {
  userRepository: Repository<User>;
  auditLogRepository: Repository<AuditLog>;
  refreshTokenRepository: Repository<RefreshToken>;
  passwordResetTokenRepository: Repository<PasswordResetToken>;
  passwordService: PasswordService;
  emailService: EmailService;
  configService: ConfigService;
  appLogger: AppLoggerService;
};

export const requireTenantId = (tenantId?: string): string => {
  const normalized = tenantId?.trim();
  if (!normalized) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }
  return normalized;
};

export const requireUserRole = (role?: string): UserRole => {
  if (
    role === UserRole.OWNER ||
    role === UserRole.MANAGER ||
    role === UserRole.STAFF ||
    role === UserRole.VIEWER
  ) {
    return role;
  }
  throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
};

export const assertOwnerRole = (role: UserRole): void => {
  if (role !== UserRole.OWNER) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }
};

export const requireTenantUser = async (
  deps: UsersDependencies,
  id: string,
  tenantId: string
): Promise<User> => {
  const user = await deps.userRepository.findOne({
    where: { id, tenantId },
    relations: ['tenant'],
  });

  if (!user) {
    throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
  }

  return user;
};

export const normalizeAssignableRole = (role: UserRole): UserRole => {
  if (!ASSIGNABLE_ROLES.has(role)) {
    throw new BadRequestException('Role is invalid for this operation.');
  }

  return role;
};

export const deriveNameFromEmail = (email: string): string => {
  const localPart = email.split('@')[0] ?? 'Team Member';
  const readable = localPart.replace(/[._-]+/g, ' ').trim();
  if (!readable) {
    return 'Team Member';
  }

  return readable
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join(' ');
};

export const generateTemporaryPassword = (): string => {
  const randomSegment = randomBytes(12).toString('hex');
  return `Invite-${randomSegment}-Aa1`;
};

export const createInvitationToken = async (
  deps: UsersDependencies,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ rawToken: string; expiresAt: Date }> => {
  await deps.passwordResetTokenRepository.update(
    { userId, usedAt: IsNull() },
    { usedAt: new Date() }
  );

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHmac('sha256', getHmacSecret(deps))
    .update(rawToken)
    .digest('hex');
  const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);

  await deps.passwordResetTokenRepository.save({
    userId,
    tokenHash,
    expiresAt,
    ipAddress,
    userAgent,
  });

  return { rawToken, expiresAt };
};

export const buildInviteUrl = (
  deps: UsersDependencies,
  rawToken: string,
  workspaceSlug?: string
): string | undefined => {
  const frontendUrl = deps.configService.get<string>('FRONTEND_URL');
  const frontendBase = frontendUrl?.replace(/\/+$/, '');

  if (!frontendBase) {
    return undefined;
  }

  const params = new URLSearchParams({
    token: rawToken,
  });

  const normalizedWorkspaceSlug = workspaceSlug?.trim().toLowerCase();
  if (
    normalizedWorkspaceSlug &&
    WORKSPACE_SLUG_PATTERN.test(normalizedWorkspaceSlug)
  ) {
    params.set('workspace', normalizedWorkspaceSlug);
  }

  return `${frontendBase}/reset-password?${params.toString()}`;
};

export const getHmacSecret = (deps: UsersDependencies): string => {
  const secret = deps.configService.get<string>('REFRESH_TOKEN_HMAC_SECRET');
  if (!secret) {
    throw new Error('REFRESH_TOKEN_HMAC_SECRET is not set');
  }

  return secret;
};

export const toUserDto = (user: User): UserDto => {
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
};

export const logUsersAudit = async (
  deps: UsersDependencies,
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
): Promise<void> => {
  const auditLog = deps.auditLogRepository.create({
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

  await deps.auditLogRepository.save(auditLog);
};

export const ensureUserDoesNotExist = async (
  deps: UsersDependencies,
  email: string,
  tenantId: string
): Promise<void> => {
  const existingUser = await deps.userRepository.findOne({
    where: { email, tenantId },
  });

  if (existingUser) {
    throw new ConflictException(EMAIL_EXISTS_MESSAGE);
  }
};
