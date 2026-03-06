import { BookingHoldCleanupService } from './booking-hold-cleanup.service';
import { LOG_EVENTS } from '../logging';

describe('BookingHoldCleanupService', () => {
  const bookingsService = {
    expirePendingHolds: jest.fn(),
  };

  const appLogger = {
    info: jest.fn(),
    error: jest.fn(),
  };

  let service: BookingHoldCleanupService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingHoldCleanupService(
      bookingsService as never,
      appLogger as never
    );
  });

  it('logs the number of expired holds when the cleanup job succeeds', async () => {
    bookingsService.expirePendingHolds.mockResolvedValue(3);

    await service.expirePendingHolds();

    expect(bookingsService.expirePendingHolds).toHaveBeenCalledTimes(1);
    expect(appLogger.info).toHaveBeenCalledWith(
      LOG_EVENTS.BOOKING_HOLD_EXPIRE_COMPLETE,
      'Booking hold expiry job completed',
      { expiredCount: 3 }
    );
  });

  it('logs failures without throwing out of the cron job', async () => {
    const error = new Error('cleanup failed');
    bookingsService.expirePendingHolds.mockRejectedValue(error);

    await expect(service.expirePendingHolds()).resolves.toBeUndefined();

    expect(appLogger.error).toHaveBeenCalledWith(
      LOG_EVENTS.BOOKING_HOLD_EXPIRE_FAILED,
      'Booking hold expiry job failed',
      {},
      error
    );
  });
});
