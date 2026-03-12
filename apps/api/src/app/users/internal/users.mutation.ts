import { BadRequestException } from '@nestjs/common';
import { AuditAction } from '@khana/data-access';
import { InviteUserResponseDto, UserDto, UserRole } from '@khana/shared-dtos';
import { IsNull } from 'typeorm';
import {
  Actor,
  assertOwnerRole,
  buildInviteUrl,
  createInvitationToken,
  deriveNameFromEmail,
  ensureUserDoesNotExist,
  generateTemporaryPassword,
  logUsersAudit,
  normalizeAssignableRole,
  OWNER_PROTECTED_MESSAGE,
  requireTenantId,
  requireTenantUser,
  requireUserRole,
  toUserDto,
  UsersDependencies,
} from './users.internal';
import { InviteUserDto, UpdateUserRoleDto, UpdateUserStatusDto } from '../dto';

export const updateUserRoleWorkflow = async (
  deps: UsersDependencies,
  id: string,
  dto: UpdateUserRoleDto,
  tenantId: string,
  actor: Actor,
  ipAddress?: string,
  userAgent?: string,
): Promise<UserDto> => {
  const resolvedTenantId = requireTenantId(tenantId);
  assertOwnerRole(requireUserRole(actor.role));

  const user = await requireTenantUser(deps, id, resolvedTenantId);
  if (user.id === actor.id) {
    throw new BadRequestException('You cannot change your own role.');
  }
  if (user.role === UserRole.OWNER) {
    throw new BadRequestException(OWNER_PROTECTED_MESSAGE);
  }

  const nextRole = normalizeAssignableRole(dto.role);
  if (user.role === nextRole) {
    return toUserDto(user);
  }

  const beforeRole = user.role;
  user.role = nextRole;
  const saved = await deps.userRepository.save(user);

  await logUsersAudit(deps, {
    tenantId: resolvedTenantId,
    userId: actor.id,
    action: AuditAction.UPDATE,
    entityType: 'User',
    entityId: saved.id,
    description: `User role changed: ${saved.email}`,
    changes: {
      before: { role: beforeRole },
      after: { role: saved.role },
    },
    ipAddress,
    userAgent,
  });

  deps.appLogger.info('user.role.update.success', 'User role updated', {
    tenantId: resolvedTenantId,
    actorUserId: actor.id,
    targetUserId: saved.id,
    role: saved.role,
  });

  return toUserDto(saved);
};

export const updateUserStatusWorkflow = async (
  deps: UsersDependencies,
  id: string,
  dto: UpdateUserStatusDto,
  tenantId: string,
  actor: Actor,
  ipAddress?: string,
  userAgent?: string,
): Promise<UserDto> => {
  const resolvedTenantId = requireTenantId(tenantId);
  assertOwnerRole(requireUserRole(actor.role));

  const user = await requireTenantUser(deps, id, resolvedTenantId);
  if (user.id === actor.id && dto.isActive === false) {
    throw new BadRequestException('You cannot deactivate your own account.');
  }
  if (user.role === UserRole.OWNER) {
    throw new BadRequestException(OWNER_PROTECTED_MESSAGE);
  }

  if (user.isActive === dto.isActive) {
    return toUserDto(user);
  }

  const beforeStatus = user.isActive;
  user.isActive = dto.isActive;
  const saved = await deps.userRepository.save(user);

  if (!saved.isActive) {
    await deps.refreshTokenRepository.update(
      { userId: saved.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  await logUsersAudit(deps, {
    tenantId: resolvedTenantId,
    userId: actor.id,
    action: AuditAction.UPDATE,
    entityType: 'User',
    entityId: saved.id,
    description: `User status changed: ${saved.email}`,
    changes: {
      before: { isActive: beforeStatus },
      after: { isActive: saved.isActive },
    },
    ipAddress,
    userAgent,
  });

  deps.appLogger.info('user.status.update.success', 'User status updated', {
    tenantId: resolvedTenantId,
    actorUserId: actor.id,
    targetUserId: saved.id,
    isActive: saved.isActive,
  });

  return toUserDto(saved);
};

export const inviteUserWorkflow = async (
  deps: UsersDependencies,
  dto: InviteUserDto,
  tenantId: string,
  actor: Actor,
  ipAddress?: string,
  userAgent?: string,
): Promise<InviteUserResponseDto> => {
  const resolvedTenantId = requireTenantId(tenantId);
  assertOwnerRole(requireUserRole(actor.role));

  const email = dto.email.trim().toLowerCase();
  const role = normalizeAssignableRole(dto.role);

  await ensureUserDoesNotExist(deps, email, resolvedTenantId);

  const name = deriveNameFromEmail(email);
  const passwordHash = await deps.passwordService.hash(
    generateTemporaryPassword(),
  );

  const user = deps.userRepository.create({
    email,
    name,
    role,
    isActive: true,
    passwordHash,
    tenantId: resolvedTenantId,
  });
  const savedUser = await deps.userRepository.save(user);
  const savedUserWithTenant =
    (await deps.userRepository.findOne({
      where: { id: savedUser.id, tenantId: resolvedTenantId },
      relations: ['tenant'],
    })) ?? savedUser;

  const invitation = await createInvitationToken(
    deps,
    savedUser.id,
    ipAddress,
    userAgent,
  );

  await deps.emailService.sendTeamInviteNotification({
    recipientEmail: savedUser.email,
    recipientName: savedUser.name,
    invitedByName: actor.name || actor.email || 'Owner',
    role: savedUser.role,
    inviteUrl: buildInviteUrl(
      deps,
      invitation.rawToken,
      savedUserWithTenant.tenant?.slug,
    ),
    inviteToken: invitation.rawToken,
    expiresAt: invitation.expiresAt,
  });

  await logUsersAudit(deps, {
    tenantId: resolvedTenantId,
    userId: actor.id,
    action: AuditAction.CREATE,
    entityType: 'User',
    entityId: savedUser.id,
    description: `User invited: ${savedUser.email}`,
    changes: {
      after: {
        id: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
        isActive: savedUser.isActive,
      },
    },
    ipAddress,
    userAgent,
  });

  deps.appLogger.info('user.invite.success', 'User invited', {
    tenantId: resolvedTenantId,
    actorUserId: actor.id,
    invitedUserId: savedUser.id,
    role: savedUser.role,
  });

  return {
    message: 'Invitation sent successfully.',
    user: toUserDto(savedUserWithTenant),
  };
};
