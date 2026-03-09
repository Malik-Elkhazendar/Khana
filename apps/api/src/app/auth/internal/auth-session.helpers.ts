import { ConfigService } from '@nestjs/config';
import { EmailService } from '@khana/notifications';
import { randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { AuditAction, AuditLog, RefreshToken, User } from '@khana/data-access';
import { AppLoggerService, LOG_EVENTS } from '../../logging';
import { JwtPayload, JwtTokenService } from '../services/jwt.service';
import { MetricsService } from '../services/metrics.service';
import { hashDeviceFingerprint, hashRefreshToken } from '../utils/hmac.util';
import {
  countRecentSecurityIncidents,
  saveAuthAuditLog,
} from './auth-audit.helpers';

export function getRefreshTokenExpiry(
  configService: ConfigService,
  issuedAt: Date
): Date {
  const ttlDays = parseInt(
    configService.get<string>('REFRESH_TOKEN_TTL_DAYS') || '7',
    10
  );
  return new Date(issuedAt.getTime() + ttlDays * 24 * 60 * 60 * 1000);
}

export function getHmacSecret(configService: ConfigService): string {
  const secret = configService.get<string>('REFRESH_TOKEN_HMAC_SECRET');
  if (!secret) {
    throw new Error('REFRESH_TOKEN_HMAC_SECRET is not set');
  }

  return secret;
}

export async function issueTokenPair(params: {
  user: User;
  ipAddress?: string;
  userAgent?: string;
  jwtTokenService: JwtTokenService;
  refreshTokenRepository: Repository<RefreshToken>;
  configService: ConfigService;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const sessionId = randomUUID();
  const tokenId = randomUUID();
  const issuedAt = new Date();

  const payload: JwtPayload = {
    sub: params.user.id,
    email: params.user.email,
    role: params.user.role,
    tenantId: params.user.tenantId,
    sid: sessionId,
    jti: tokenId,
  };

  const tokens = params.jwtTokenService.generateTokenPair(payload);
  const hmacSecret = getHmacSecret(params.configService);

  await params.refreshTokenRepository.save({
    id: tokenId,
    userId: params.user.id,
    sessionId,
    tokenHash: hashRefreshToken(tokens.refreshToken, hmacSecret),
    issuedAt,
    expiresAt: getRefreshTokenExpiry(params.configService, issuedAt),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    deviceFingerprint: hashDeviceFingerprint(
      params.ipAddress,
      params.userAgent,
      hmacSecret
    ),
  });

  return tokens;
}

export async function handleTokenReuse(params: {
  token: RefreshToken;
  ipAddress?: string;
  userAgent?: string;
  refreshTokenRepository: Repository<RefreshToken>;
  userRepository: Repository<User>;
  auditLogRepository: Repository<AuditLog>;
  emailService: EmailService;
  metricsService: MetricsService;
  appLogger: AppLoggerService;
}): Promise<void> {
  const now = new Date();
  await params.refreshTokenRepository.update(
    { sessionId: params.token.sessionId, revokedAt: IsNull() },
    { revokedAt: now }
  );

  const user =
    params.token.user ||
    (await params.userRepository.findOne({
      where: { id: params.token.userId },
      select: ['id', 'email', 'tenantId'],
    }));

  if (user) {
    await saveAuthAuditLog(params.auditLogRepository, {
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditAction.SECURITY_INCIDENT,
      entityType: 'RefreshToken',
      entityId: params.token.id,
      description: `Refresh token reuse detected - session ${params.token.sessionId} revoked`,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    void params.emailService
      .sendSecurityAlert({
        recipientEmail: user.email,
        recipientName: user.email,
        subject: 'Suspicious Activity Detected',
        message:
          'A previously used refresh token was presented. All sessions for that device have been logged out.',
        ipAddress: params.ipAddress,
      })
      ?.catch?.((error) => {
        params.appLogger.error(
          LOG_EVENTS.EMAIL_FAILED,
          'Failed to dispatch security alert',
          {
            userId: user.id,
            sessionId: params.token.sessionId,
          },
          error
        );
      });
  }

  params.metricsService.trackReuseDetection(
    params.token.userId,
    params.token.sessionId
  );

  params.appLogger.warn(
    LOG_EVENTS.AUTH_REFRESH_REUSE_DETECTED,
    'Refresh token reuse detected',
    {
      userId: params.token.userId,
      sessionId: params.token.sessionId,
    }
  );

  const incidentCount = await countRecentSecurityIncidents(
    params.auditLogRepository,
    params.token.userId
  );
  if (incidentCount >= 3) {
    params.metricsService.trackSecurityEscalation(
      params.token.userId,
      incidentCount
    );
    params.appLogger.error(
      LOG_EVENTS.AUTH_SECURITY_ESCALATION,
      'Security escalation threshold exceeded',
      {
        userId: params.token.userId,
        incidentCount,
      }
    );
  }
}
