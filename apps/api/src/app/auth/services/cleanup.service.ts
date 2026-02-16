import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { RefreshToken } from '@khana/data-access';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly configService: ConfigService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredTokens(): Promise<void> {
    const retentionDays = parseInt(
      this.configService.get<string>('REVOKED_TOKEN_RETENTION_DAYS') || '90',
      10
    );
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000
    );
    const now = new Date();

    const result = await this.refreshTokenRepository.delete({
      expiresAt: LessThan(now),
      revokedAt: LessThan(cutoffDate),
    });

    this.logger.log(
      `Cleanup: deleted ${result.affected ?? 0} revoked refresh tokens`
    );
  }
}
