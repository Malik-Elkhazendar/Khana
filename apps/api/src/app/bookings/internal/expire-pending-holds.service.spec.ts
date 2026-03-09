import { AuditLog, Booking, Facility } from '@khana/data-access';
import {
  BookingCancellationReasonKey,
  BookingStatus,
  serializeCancellationReason,
} from '@khana/shared-dtos';
import { ExpirePendingHoldsService } from './expire-pending-holds.service';

describe('ExpirePendingHoldsService', () => {
  let service: ExpirePendingHoldsService;
  let bookingRepository: {
    manager: {
      transaction: jest.Mock;
    };
  };

  const appLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const waitlistService = {
    notifyFirstForSlot: jest.fn().mockResolvedValue({ notified: false }),
  };

  const goalsService = {
    syncMilestonesForCurrentMonth: jest.fn().mockResolvedValue(undefined),
  };

  const tenantId = 'tenant-1';
  const facilityId = 'facility-1';
  const userId = 'user-1';

  const activeFacility = {
    id: facilityId,
    name: 'Center Court',
    tenant: { id: tenantId },
    config: { pricePerHour: 100 },
  } as unknown as Facility;

  const buildPendingHoldBooking = (overrides: Partial<Booking> = {}): Booking =>
    ({
      id: 'booking-hold-1',
      bookingReference: 'REF-HOLD-1',
      facility: activeFacility,
      startTime: new Date('2025-03-10T09:00:00.000Z'),
      endTime: new Date('2025-03-10T10:00:00.000Z'),
      customerName: 'Pending User',
      customerPhone: '+966500000111',
      createdByUserId: userId,
      totalAmount: 100,
      currency: 'SAR',
      status: BookingStatus.PENDING,
      paymentStatus: 'PENDING',
      holdUntil: new Date('2025-03-10T08:45:00.000Z'),
      cancellationReason: null,
      recurrenceGroupId: null,
      recurrenceInstanceNumber: null,
      recurrenceRule: null,
      createdAt: new Date('2025-03-01T08:00:00.000Z'),
      updatedAt: new Date('2025-03-01T08:00:00.000Z'),
      ...overrides,
    } as Booking);

  beforeEach(() => {
    bookingRepository = {
      manager: {
        transaction: jest.fn(),
      },
    };

    service = new ExpirePendingHoldsService(
      bookingRepository as never,
      {} as never,
      appLogger as never,
      waitlistService as never,
      goalsService as never
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('cancels expired pending holds and notifies waitlist once per slot', async () => {
    const firstHold = buildPendingHoldBooking();
    const duplicateSlotHold = buildPendingHoldBooking({
      id: 'booking-hold-2',
      bookingReference: 'REF-HOLD-2',
      holdUntil: new Date('2025-03-10T08:30:00.000Z'),
    });

    const lockQueryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([firstHold, duplicateSlotHold]),
    };
    const transactionBookingRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(lockQueryBuilder),
      save: jest.fn().mockImplementation(async (payload: unknown) => payload),
    };
    const transactionAuditRepo = {
      create: jest.fn((payload: unknown) => payload),
      save: jest.fn().mockResolvedValue(undefined),
    };

    bookingRepository.manager.transaction.mockImplementationOnce(
      async (cb: (manager: unknown) => Promise<unknown>) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === Booking) {
              return transactionBookingRepo;
            }
            if (entity === AuditLog) {
              return transactionAuditRepo;
            }
            return null;
          },
        })
    );
    waitlistService.notifyFirstForSlot.mockResolvedValue({
      notified: true,
      entryId: 'waitlist-1',
    });

    const expiredCount = await service.execute(
      new Date('2025-03-10T09:01:00.000Z')
    );

    expect(expiredCount).toBe(2);
    expect(transactionBookingRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'booking-hold-1',
        status: BookingStatus.CANCELLED,
        holdUntil: null,
        cancellationReason: serializeCancellationReason(
          BookingCancellationReasonKey.OTHER,
          'Hold expired automatically'
        ),
      }),
      expect.objectContaining({
        id: 'booking-hold-2',
        status: BookingStatus.CANCELLED,
        holdUntil: null,
        cancellationReason: serializeCancellationReason(
          BookingCancellationReasonKey.OTHER,
          'Hold expired automatically'
        ),
      }),
    ]);
    expect(transactionAuditRepo.save).toHaveBeenCalledTimes(1);
    expect(waitlistService.notifyFirstForSlot).toHaveBeenCalledTimes(1);
    expect(goalsService.syncMilestonesForCurrentMonth).toHaveBeenCalledWith(
      tenantId
    );
  });

  it('returns zero when there are no expired holds', async () => {
    const lockQueryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const transactionBookingRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(lockQueryBuilder),
      save: jest.fn(),
    };
    const transactionAuditRepo = {
      create: jest.fn((payload: unknown) => payload),
      save: jest.fn(),
    };

    bookingRepository.manager.transaction.mockImplementationOnce(
      async (cb: (manager: unknown) => Promise<unknown>) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === Booking) {
              return transactionBookingRepo;
            }
            if (entity === AuditLog) {
              return transactionAuditRepo;
            }
            return null;
          },
        })
    );

    const expiredCount = await service.execute(
      new Date('2025-03-10T09:01:00.000Z')
    );

    expect(expiredCount).toBe(0);
    expect(transactionBookingRepo.save).not.toHaveBeenCalled();
    expect(transactionAuditRepo.save).not.toHaveBeenCalled();
    expect(waitlistService.notifyFirstForSlot).not.toHaveBeenCalled();
    expect(goalsService.syncMilestonesForCurrentMonth).not.toHaveBeenCalled();
  });
});
