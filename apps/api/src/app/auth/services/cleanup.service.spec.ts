import { ConfigService } from '@nestjs/config';
import { CleanupService } from './cleanup.service';

describe('CleanupService', () => {
  it('deletes both expired unrevoked tokens and expired old-revoked tokens', async () => {
    const where = jest.fn().mockReturnThis();
    const andWhere = jest.fn().mockReturnThis();
    const execute = jest.fn().mockResolvedValue({ affected: 3 });
    const deleteFn = jest.fn().mockReturnValue({
      where,
      andWhere,
      execute,
    });

    const refreshTokenRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        delete: deleteFn,
      }),
    };

    const configService = {
      get: jest.fn().mockReturnValue('90'),
    } as unknown as ConfigService;

    const appLogger = {
      info: jest.fn(),
    };

    const service = new CleanupService(
      refreshTokenRepository as never,
      configService,
      appLogger as never
    );

    await service.cleanupExpiredTokens();

    expect(where).toHaveBeenCalledWith('expiresAt < :now', {
      now: expect.any(Date),
    });
    expect(andWhere).toHaveBeenCalledWith(
      '(revokedAt IS NULL OR revokedAt < :cutoffDate)',
      {
        cutoffDate: expect.any(Date),
      }
    );
    expect(appLogger.info).toHaveBeenCalledWith(
      expect.any(String),
      'Cleanup completed',
      expect.objectContaining({ deletedCount: 3, retentionDays: 90 })
    );
  });
});
