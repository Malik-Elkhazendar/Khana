import { LOG_EVENTS } from '../../logging';
import {
  changeAuthPassword,
  forgotAuthPassword,
  resetAuthPassword,
} from './auth-account.workflows';
import { AuthDependencies } from './auth.internal';

describe('auth-account.workflows', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const refreshTokenRepository = {
    update: jest.fn(),
  };
  const passwordResetTokenRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
  };
  const tenantRepository = {
    exists: jest.fn(),
  };
  const passwordService = {
    verify: jest.fn(),
    hash: jest.fn(),
  };
  const emailService = {
    sendPasswordChangedNotification: jest.fn(),
    sendPasswordResetNotification: jest.fn(),
  };
  const auditLogRepository = {
    create: jest.fn((payload: unknown) => payload),
    save: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'REFRESH_TOKEN_HMAC_SECRET') return 'test-secret';
      if (key === 'FRONTEND_URL') return 'https://khana.test';
      return undefined;
    }),
  };
  const appLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const deps = {
    userRepository,
    auditLogRepository,
    refreshTokenRepository,
    passwordResetTokenRepository,
    tenantRepository,
    dataSource: {} as never,
    passwordService,
    jwtTokenService: {} as never,
    emailService,
    metricsService: {} as never,
    configService,
    appLogger,
  } as unknown as AuthDependencies;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantRepository.exists.mockResolvedValue(true);
    auditLogRepository.save.mockResolvedValue(undefined);
    userRepository.update.mockResolvedValue(undefined);
    refreshTokenRepository.update.mockResolvedValue(undefined);
    passwordResetTokenRepository.update.mockResolvedValue(undefined);
    passwordResetTokenRepository.save.mockResolvedValue(undefined);
  });

  it('changeAuthPassword succeeds when the password-changed email rejects', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      passwordHash: 'old-hash',
      tenantId,
      email: 'owner@khana.dev',
    });
    passwordService.verify.mockResolvedValue(true);
    passwordService.hash.mockResolvedValue('new-hash');
    emailService.sendPasswordChangedNotification.mockRejectedValue(
      new Error('email failed')
    );

    await expect(
      changeAuthPassword(deps, 'user-1', 'OldPassword1', 'NewPassword1')
    ).resolves.toBeUndefined();

    await Promise.resolve();
    await Promise.resolve();

    expect(appLogger.error).toHaveBeenCalledWith(
      LOG_EVENTS.EMAIL_FAILED,
      'Failed to dispatch password changed notification',
      expect.objectContaining({
        userId: 'user-1',
        tenantId,
      }),
      expect.any(Error)
    );
  });

  it('forgotAuthPassword does not await a pending reset email provider', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'owner@khana.dev',
      tenantId,
      isActive: true,
    });
    emailService.sendPasswordResetNotification.mockReturnValue(
      new Promise(() => undefined)
    );

    const race = await Promise.race([
      forgotAuthPassword(
        deps,
        'owner@khana.dev',
        tenantId,
        '127.0.0.1',
        'jest'
      ).then((result) => ({ kind: 'result' as const, result })),
      new Promise<{ kind: 'timeout' }>((resolve) =>
        setTimeout(() => resolve({ kind: 'timeout' }), 25)
      ),
    ]);

    expect(race.kind).toBe('result');
    if (race.kind === 'result') {
      expect(race.result).toEqual({
        message: 'If that email exists, a reset link has been sent',
      });
    }
  });

  it('resetAuthPassword succeeds when the password-changed email rejects', async () => {
    passwordResetTokenRepository.findOne.mockResolvedValue({
      id: 'reset-token-1',
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        tenantId,
        email: 'owner@khana.dev',
        isActive: true,
        deletedAt: null,
      },
    });
    passwordService.hash.mockResolvedValue('new-hash');
    emailService.sendPasswordChangedNotification.mockRejectedValue(
      new Error('email failed')
    );

    await expect(
      resetAuthPassword(
        deps,
        'raw-reset-token',
        'NewPassword1',
        '127.0.0.1',
        'jest'
      )
    ).resolves.toEqual({
      message: 'Password has been reset successfully',
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(appLogger.error).toHaveBeenCalledWith(
      LOG_EVENTS.EMAIL_FAILED,
      'Failed to dispatch password changed notification after reset',
      expect.objectContaining({
        userId: 'user-1',
        tenantId,
      }),
      expect.any(Error)
    );
  });
});
