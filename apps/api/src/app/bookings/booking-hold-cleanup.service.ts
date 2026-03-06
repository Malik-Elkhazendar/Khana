import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppLoggerService, LOG_EVENTS } from '../logging';
import { BookingsService } from './bookings.service';

@Injectable()
export class BookingHoldCleanupService {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly appLogger: AppLoggerService
  ) {}

  @Cron('* * * * *')
  async expirePendingHolds(): Promise<void> {
    try {
      const expiredCount = await this.bookingsService.expirePendingHolds();
      this.appLogger.info(
        LOG_EVENTS.BOOKING_HOLD_EXPIRE_COMPLETE,
        'Booking hold expiry job completed',
        { expiredCount }
      );
    } catch (error) {
      this.appLogger.error(
        LOG_EVENTS.BOOKING_HOLD_EXPIRE_FAILED,
        'Booking hold expiry job failed',
        {},
        error
      );
    }
  }
}
