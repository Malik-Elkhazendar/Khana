import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { IsNull, Not } from 'typeorm';
import { AuditAction } from '@khana/data-access';
import { UserDto } from '@khana/shared-dtos';
import { LOG_EVENTS } from '../../logging';
import {
  AuthDependencies,
  getAuthHmacSecret,
  logAuthAudit,
  mapAuthUserToDto,
  normalizeAuthEmail,
  resolveAuthTenantId,
  validateAuthPasswordStrength,
} from './auth.internal';

const dispatchAuthNotification = (
  deps: AuthDependencies,
  message: string,
  context: Record<string, unknown>,
  task: Promise<unknown>
): void => {
  void task.catch((error) => {
    deps.appLogger.error(LOG_EVENTS.EMAIL_FAILED, message, context, error);
  });
};

export const getAuthCurrentUser = async (
  deps: AuthDependencies,
  userId: string
): Promise<UserDto> => {
  const user = await deps.userRepository.findOne({
    where: { id: userId },
    relations: ['tenant'],
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  return mapAuthUserToDto(user);
};

export const changeAuthPassword = async (
  deps: AuthDependencies,
  userId: string,
  oldPassword: string,
  newPassword: string,
  currentSessionId?: string
): Promise<void> => {
  validateAuthPasswordStrength(newPassword);

  if (!oldPassword?.trim()) {
    throw new BadRequestException('Current password is required');
  }

  const user = await deps.userRepository.findOne({
    where: { id: userId },
    select: ['id', 'passwordHash', 'tenantId', 'email'],
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  const oldPasswordValid = await deps.passwordService.verify(
    oldPassword,
    user.passwordHash
  );

  if (!oldPasswordValid) {
    throw new UnauthorizedException('Current password is incorrect');
  }

  const newPasswordHash = await deps.passwordService.hash(newPassword);
  await deps.userRepository.update(userId, {
    passwordHash: newPasswordHash,
  });

  const where: Record<string, unknown> = {
    userId,
    revokedAt: IsNull(),
  };
  if (currentSessionId) {
    where.sessionId = Not(currentSessionId);
  }

  await deps.refreshTokenRepository.update(where, { revokedAt: new Date() });

  await logAuthAudit(deps, {
    tenantId: user.tenantId,
    userId: user.id,
    action: AuditAction.UPDATE,
    entityType: 'User',
    entityId: user.id,
    description: `User changed password: ${user.email}`,
  });

  deps.appLogger.info(LOG_EVENTS.AUTH_PASSWORD_CHANGED, 'Password changed', {
    userId: user.id,
    tenantId: user.tenantId,
  });

  dispatchAuthNotification(
    deps,
    'Failed to dispatch password changed notification',
    {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
    },
    deps.emailService.sendPasswordChangedNotification({
      recipientEmail: user.email,
      recipientName: user.email,
    })
  );
};

export const forgotAuthPassword = async (
  deps: AuthDependencies,
  email: string,
  tenantId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ message: string }> => {
  const genericMessage = 'If that email exists, a reset link has been sent';
  const resolvedTenantId = await resolveAuthTenantId(deps, tenantId);
  const normalizedEmail = normalizeAuthEmail(email);

  const user = await deps.userRepository.findOne({
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

  await deps.passwordResetTokenRepository.update(
    { userId: user.id, usedAt: IsNull() },
    { usedAt: new Date() }
  );

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHmac('sha256', getAuthHmacSecret(deps))
    .update(rawToken)
    .digest('hex');

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await deps.passwordResetTokenRepository.save({
    userId: user.id,
    tokenHash,
    expiresAt,
    ipAddress,
    userAgent,
  });

  const frontendUrl = deps.configService.get<string>('FRONTEND_URL');
  const frontendBase = frontendUrl?.replace(/\/+$/, '');
  const resetUrl = frontendBase
    ? `${frontendBase}/reset-password?token=${encodeURIComponent(rawToken)}`
    : undefined;

  dispatchAuthNotification(
    deps,
    'Failed to dispatch password reset notification',
    {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
    },
    deps.emailService.sendPasswordResetNotification({
      recipientEmail: user.email,
      resetToken: rawToken,
      resetUrl,
      expiresAt,
    })
  );

  await logAuthAudit(deps, {
    tenantId: user.tenantId,
    userId: user.id,
    action: AuditAction.UPDATE,
    entityType: 'PasswordResetToken',
    entityId: user.id,
    description: `Password reset requested for: ${user.email}`,
    ipAddress,
    userAgent,
  });

  deps.appLogger.info(
    LOG_EVENTS.AUTH_PASSWORD_RESET_REQUESTED,
    'Password reset requested',
    {
      userId: user.id,
      tenantId: user.tenantId,
    }
  );

  return { message: genericMessage };
};

export const resetAuthPassword = async (
  deps: AuthDependencies,
  token: string,
  newPassword: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ message: string }> => {
  validateAuthPasswordStrength(newPassword);

  const tokenHash = createHmac('sha256', getAuthHmacSecret(deps))
    .update(token)
    .digest('hex');

  const resetToken = await deps.passwordResetTokenRepository.findOne({
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

  const passwordHash = await deps.passwordService.hash(newPassword);
  await deps.userRepository.update(user.id, { passwordHash });

  await deps.passwordResetTokenRepository.update(resetToken.id, {
    usedAt: new Date(),
  });

  await deps.refreshTokenRepository.update(
    { userId: user.id, revokedAt: IsNull() },
    { revokedAt: new Date() }
  );

  await logAuthAudit(deps, {
    tenantId: user.tenantId,
    userId: user.id,
    action: AuditAction.UPDATE,
    entityType: 'User',
    entityId: user.id,
    description: `Password reset completed for: ${user.email}`,
    ipAddress,
    userAgent,
  });

  deps.appLogger.info(
    LOG_EVENTS.AUTH_PASSWORD_RESET_COMPLETED,
    'Password reset completed',
    {
      userId: user.id,
      tenantId: user.tenantId,
    }
  );

  dispatchAuthNotification(
    deps,
    'Failed to dispatch password changed notification after reset',
    {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
    },
    deps.emailService.sendPasswordChangedNotification({
      recipientEmail: user.email,
      recipientName: user.email,
    })
  );

  return { message: 'Password has been reset successfully' };
};
