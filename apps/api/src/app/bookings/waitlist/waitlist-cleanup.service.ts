import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppLoggerService, LOG_EVENTS } from '../../logging';
import { WaitlistService } from './waitlist.service';

@Injectable()
export class WaitlistCleanupService {
  constructor(
    private readonly waitlistService: WaitlistService,
    private readonly appLogger: AppLoggerService
  ) {}

  @Cron('*/15 * * * *')
  async expirePastEntries(): Promise<void> {
    try {
      const expiredCount = await this.waitlistService.expirePastEntries();
      this.appLogger.info(
        LOG_EVENTS.WAITLIST_EXPIRE_COMPLETE,
        'Waitlist expiry job completed',
        { expiredCount }
      );
    } catch (error) {
      this.appLogger.error(
        LOG_EVENTS.WAITLIST_EXPIRE_FAILED,
        'Waitlist expiry job failed',
        {},
        error
      );
    }
  }
}
