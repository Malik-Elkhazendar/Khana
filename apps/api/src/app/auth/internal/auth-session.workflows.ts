import { UnauthorizedException } from '@nestjs/common';
import { IsNull, Not } from 'typeorm';
import { AuditAction, RefreshToken } from '@khana/data-access';
import { JwtPayload } from '../services/jwt.service';
import { LoginDto } from '../dto';
import {
  hashDeviceFingerprint,
  hashRefreshToken,
  verifyRefreshTokenHash,
} from '../utils/hmac.util';
import { LOG_EVENTS } from '../../logging';
import {
  AuthDependencies,
  getAuthHmacSecret,
  getAuthRefreshTokenExpiry,
  handleAuthTokenReuse,
  issueAuthTokenPair,
  logAuthAudit,
  mapAuthTenantToDto,
  mapAuthUserToDto,
  normalizeAuthEmail,
  resolveAuthTenantIdForLogin,
} from './auth.internal';
import { randomUUID } from 'crypto';

export const loginAuthUser = async (
  deps: AuthDependencies,
  dto: LoginDto,
  tenantId?: string,
  ipAddress?: string,
  userAgent?: string
) => {
  const normalizedEmail = normalizeAuthEmail(dto.email);
  const resolvedTenantId = await resolveAuthTenantIdForLogin(
    deps,
    normalizedEmail,
    tenantId
  );
  const user = await deps.userRepository.findOne({
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
    deps.appLogger.warn(
      LOG_EVENTS.AUTH_LOGIN_FAILED,
      'Login failed: user not found',
      {
        tenantId: resolvedTenantId,
      }
    );
    throw new UnauthorizedException('Invalid email or password');
  }

  if (!user.isActive) {
    deps.appLogger.warn(
      LOG_EVENTS.AUTH_LOGIN_FAILED,
      'Login failed: user inactive',
      {
        tenantId: resolvedTenantId,
        userId: user.id,
      }
    );
    throw new UnauthorizedException('User account is inactive');
  }

  const passwordValid = await deps.passwordService.verify(
    dto.password,
    user.passwordHash
  );

  if (!passwordValid) {
    deps.appLogger.warn(
      LOG_EVENTS.AUTH_LOGIN_FAILED,
      'Login failed: invalid password',
      {
        tenantId: resolvedTenantId,
        userId: user.id,
      }
    );
    throw new UnauthorizedException('Invalid email or password');
  }

  await deps.userRepository.update(user.id, {
    lastLoginAt: new Date(),
  });

  const tokens = await issueAuthTokenPair(deps, user, ipAddress, userAgent);

  await logAuthAudit(deps, {
    tenantId: user.tenantId,
    userId: user.id,
    action: AuditAction.LOGIN,
    entityType: 'User',
    entityId: user.id,
    description: `User logged in: ${user.email}`,
    ipAddress,
    userAgent,
  });

  deps.appLogger.info(LOG_EVENTS.AUTH_LOGIN_SUCCESS, 'User logged in', {
    userId: user.id,
    tenantId: user.tenantId,
  });

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    user: mapAuthUserToDto(user),
    tenant: mapAuthTenantToDto(user.tenant),
  };
};

export const refreshAuthToken = async (
  deps: AuthDependencies,
  refreshToken: string,
  ipAddress?: string,
  userAgent?: string
) => {
  const startTime = Date.now();
  let payload: JwtPayload;

  try {
    payload = deps.jwtTokenService.verifyRefreshToken(refreshToken);
  } catch (error) {
    deps.metricsService.trackFailedRefresh('jwt_invalid');
    throw error;
  }

  if (payload.typ !== 'refresh') {
    deps.metricsService.trackFailedRefresh('invalid_type');
    throw new UnauthorizedException('Invalid token type');
  }

  if (!payload.jti || !payload.sid) {
    deps.metricsService.trackFailedRefresh('missing_claims');
    throw new UnauthorizedException('Invalid refresh token');
  }

  const refreshTokenRecord = await deps.refreshTokenRepository.findOne({
    where: { id: payload.jti },
    relations: ['user'],
  });

  if (!refreshTokenRecord) {
    deps.metricsService.trackFailedRefresh('not_found');
    throw new UnauthorizedException('Refresh token not found');
  }

  if (refreshTokenRecord.userId !== payload.sub) {
    deps.metricsService.trackFailedRefresh('subject_mismatch');
    throw new UnauthorizedException('Invalid refresh token');
  }

  if (refreshTokenRecord.sessionId !== payload.sid) {
    deps.metricsService.trackFailedRefresh('session_mismatch');
    throw new UnauthorizedException('Invalid refresh token');
  }

  if (refreshTokenRecord.expiresAt < new Date()) {
    deps.metricsService.trackFailedRefresh('db_expired');
    throw new UnauthorizedException('Refresh token expired');
  }

  if (refreshTokenRecord.revokedAt) {
    await handleAuthTokenReuse(deps, refreshTokenRecord, ipAddress, userAgent);
    deps.metricsService.trackFailedRefresh('revoked_reuse');
    throw new UnauthorizedException('Session revoked due to security policy');
  }

  const isValidHash = verifyRefreshTokenHash(
    refreshToken,
    refreshTokenRecord.tokenHash,
    getAuthHmacSecret(deps)
  );
  if (!isValidHash) {
    deps.metricsService.trackFailedRefresh('hash_mismatch');
    throw new UnauthorizedException('Invalid refresh token');
  }

  if (refreshTokenRecord.user && !refreshTokenRecord.user.isActive) {
    deps.metricsService.trackFailedRefresh('user_inactive');
    throw new UnauthorizedException('User account is inactive');
  }

  if (refreshTokenRecord.user && refreshTokenRecord.user.deletedAt) {
    deps.metricsService.trackFailedRefresh('user_deleted');
    throw new UnauthorizedException('User account has been deleted');
  }

  const reuseErrorMessage = 'REFRESH_TOKEN_CONCURRENT_USE';

  try {
    const result = await deps.dataSource.transaction(
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

        const newTokens = deps.jwtTokenService.generateTokenPair(newPayload);
        const hmacSecret = getAuthHmacSecret(deps);

        await manager.save(RefreshToken, {
          id: newTokenId,
          userId: refreshTokenRecord.userId,
          sessionId: payload.sid,
          tokenHash: hashRefreshToken(newTokens.refreshToken, hmacSecret),
          issuedAt: now,
          expiresAt: getAuthRefreshTokenExpiry(deps, now),
          ipAddress,
          userAgent,
          deviceFingerprint: hashDeviceFingerprint(
            ipAddress,
            userAgent,
            hmacSecret
          ),
        });

        return {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          expiresIn: newTokens.expiresIn,
        };
      }
    );

    deps.metricsService.trackTokenRotation(
      refreshTokenRecord.userId,
      Date.now() - startTime
    );

    deps.appLogger.info(LOG_EVENTS.AUTH_REFRESH_ROTATED, 'Token rotated', {
      userId: refreshTokenRecord.userId,
      sessionId: payload.sid,
    });

    return result;
  } catch (error) {
    if (error instanceof Error && error.message === reuseErrorMessage) {
      await handleAuthTokenReuse(
        deps,
        refreshTokenRecord,
        ipAddress,
        userAgent
      );
      deps.metricsService.trackFailedRefresh('concurrent_reuse');
      throw new UnauthorizedException('Concurrent token use detected');
    }
    throw error;
  }
};

export const logoutAuthUser = async (
  deps: AuthDependencies,
  userId: string,
  sessionId?: string,
  refreshToken?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> => {
  const user = await deps.userRepository.findOne({
    where: { id: userId },
    select: ['id', 'tenantId', 'email'],
  });

  if (!user) {
    return;
  }

  let targetSessionId = sessionId;
  let targetTokenId: string | undefined;

  if (!targetSessionId && refreshToken) {
    try {
      const payload = deps.jwtTokenService.verifyRefreshToken(refreshToken);
      if (payload.sub === userId) {
        targetSessionId = payload.sid;
        targetTokenId = payload.jti;
      }
    } catch {
      // Ignore invalid refresh token on logout.
    }
  }

  const now = new Date();
  if (targetSessionId) {
    await deps.refreshTokenRepository.update(
      { userId, sessionId: targetSessionId, revokedAt: IsNull() },
      { revokedAt: now }
    );
  } else if (targetTokenId) {
    await deps.refreshTokenRepository.update(
      { id: targetTokenId, userId, revokedAt: IsNull() },
      { revokedAt: now }
    );
  } else {
    await deps.refreshTokenRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: now }
    );
  }

  await logAuthAudit(deps, {
    tenantId: user.tenantId,
    userId: user.id,
    action: AuditAction.LOGOUT,
    entityType: 'User',
    entityId: user.id,
    description: `User logged out: ${user.email}`,
    ipAddress,
    userAgent,
  });

  deps.appLogger.info(LOG_EVENTS.AUTH_LOGOUT, 'User logged out', {
    userId: user.id,
    tenantId: user.tenantId,
  });
};

export const logoutAuthDevice = async (
  deps: AuthDependencies,
  sessionId: string,
  userId: string
): Promise<void> => {
  const user = await deps.userRepository.findOne({
    where: { id: userId },
    select: ['id', 'tenantId', 'email'],
  });

  if (!user) {
    return;
  }

  await deps.refreshTokenRepository.update(
    { sessionId, userId, revokedAt: IsNull() },
    { revokedAt: new Date() }
  );

  await logAuthAudit(deps, {
    tenantId: user.tenantId,
    userId: user.id,
    action: AuditAction.LOGOUT,
    entityType: 'User',
    entityId: user.id,
    description: `User logged out device session: ${sessionId}`,
  });

  deps.appLogger.info(
    LOG_EVENTS.AUTH_LOGOUT_DEVICE,
    'Device session logged out',
    {
      userId: user.id,
      sessionId,
    }
  );
};

export const logoutAuthAllDevices = async (
  deps: AuthDependencies,
  userId: string,
  exceptSessionId?: string
): Promise<void> => {
  const user = await deps.userRepository.findOne({
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

  await deps.refreshTokenRepository.update(where, { revokedAt: new Date() });

  await logAuthAudit(deps, {
    tenantId: user.tenantId,
    userId: user.id,
    action: AuditAction.LOGOUT,
    entityType: 'User',
    entityId: user.id,
    description: 'User logged out all devices',
  });

  deps.appLogger.info(
    LOG_EVENTS.AUTH_LOGOUT_ALL_DEVICES,
    'All devices logged out',
    {
      userId: user.id,
      tenantId: user.tenantId,
      exceptSessionId,
    }
  );
};
