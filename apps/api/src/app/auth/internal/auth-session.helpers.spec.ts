import { LOG_EVENTS } from '../../logging';
import { handleTokenReuse } from './auth-session.helpers';

describe('auth-session.helpers', () => {
  const refreshTokenRepository = {
    update: jest.fn(),
  };
  const userRepository = {
    findOne: jest.fn(),
  };
  const auditLogRepository = {
    create: jest.fn((payload: unknown) => payload),
    save: jest.fn(),
    count: jest.fn(),
  };
  const emailService = {
    sendSecurityAlert: jest.fn(),
  };
  const metricsService = {
    trackReuseDetection: jest.fn(),
    trackSecurityEscalation: jest.fn(),
  };
  const appLogger = {
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    refreshTokenRepository.update.mockResolvedValue(undefined);
    auditLogRepository.save.mockResolvedValue(undefined);
    auditLogRepository.count.mockResolvedValue(0);
  });

  it('does not fail when the security alert dispatch rejects', async () => {
    emailService.sendSecurityAlert.mockRejectedValue(new Error('email failed'));

    await expect(
      handleTokenReuse({
        token: {
          id: 'refresh-token-1',
          userId: 'user-1',
          sessionId: 'session-1',
          user: {
            id: 'user-1',
            email: 'owner@khana.dev',
            tenantId: 'tenant-1',
          },
        } as never,
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        refreshTokenRepository: refreshTokenRepository as never,
        userRepository: userRepository as never,
        auditLogRepository: auditLogRepository as never,
        emailService: emailService as never,
        metricsService: metricsService as never,
        appLogger: appLogger as never,
      })
    ).resolves.toBeUndefined();

    await Promise.resolve();
    await Promise.resolve();

    expect(metricsService.trackReuseDetection).toHaveBeenCalledWith(
      'user-1',
      'session-1'
    );
    expect(appLogger.error).toHaveBeenCalledWith(
      LOG_EVENTS.EMAIL_FAILED,
      'Failed to dispatch security alert',
      expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-1',
      }),
      expect.any(Error)
    );
  });
});
