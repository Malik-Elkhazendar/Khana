import { BadRequestException } from '@nestjs/common';
import { AuditLog, Booking, Facility, User } from '@khana/data-access';
import {
  BookingCancellationReasonKey,
  BookingStatus,
  PaymentStatus,
  serializeCancellationReason,
} from '@khana/shared-dtos';
import { UpdateBookingStatusService } from './update-booking-status.service';

describe('UpdateBookingStatusService', () => {
  let service: UpdateBookingStatusService;
  let bookingRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let auditLogRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let userRepository: {
    findOne: jest.Mock;
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

  const emailService = {
    sendCancellationNotification: jest.fn(),
  };

  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const facilityId = 'facility-1';

  const facility = {
    id: facilityId,
    name: 'Center Court',
    tenant: { id: tenantId },
    config: { pricePerHour: 100 },
  } as unknown as Facility;

  const buildOwnedBooking = (): Booking =>
    ({
      id: 'booking-status-1',
      bookingReference: 'REF-STATUS-1',
      facility,
      startTime: new Date('2025-03-10T09:00:00.000Z'),
      endTime: new Date('2025-03-10T10:00:00.000Z'),
      customerName: 'Status User',
      customerPhone: '+966500000111',
      createdByUserId: userId,
      totalAmount: 100,
      currency: 'SAR',
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PENDING,
      holdUntil: null,
      cancellationReason: null,
      recurrenceGroupId: null,
      recurrenceInstanceNumber: null,
      recurrenceRule: null,
      createdAt: new Date('2025-03-01T08:00:00.000Z'),
      updatedAt: new Date('2025-03-01T08:00:00.000Z'),
    } as Booking);

  beforeEach(() => {
    bookingRepository = {
      findOne: jest.fn().mockResolvedValue(buildOwnedBooking()),
      save: jest.fn().mockImplementation(async (payload: unknown) => payload),
      createQueryBuilder: jest.fn(),
    };
    auditLogRepository = {
      create: jest.fn((payload: unknown) => payload),
      save: jest.fn().mockResolvedValue(undefined),
    };
    userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: userId,
        email: 'user@khana.dev',
      } as User),
    };

    service = new UpdateBookingStatusService(
      bookingRepository as never,
      auditLogRepository as never,
      userRepository as never,
      emailService as never,
      appLogger as never,
      waitlistService as never,
      goalsService as never
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('accepts and stores canonical preset key reason and dispatches follow-up work', async () => {
    const updated = await service.execute(
      'booking-status-1',
      {
        status: BookingStatus.CANCELLED,
        cancellationReason: BookingCancellationReasonKey.CUSTOMER_REQUEST,
      },
      tenantId,
      {
        id: userId,
        role: 'MANAGER',
      } as User
    );

    expect(updated.status).toBe(BookingStatus.CANCELLED);
    expect(updated.cancellationReason).toBe(
      BookingCancellationReasonKey.CUSTOMER_REQUEST
    );
    expect(waitlistService.notifyFirstForSlot).toHaveBeenCalledWith({
      tenantId,
      facilityId,
      desiredStartTime: buildOwnedBooking().startTime,
      desiredEndTime: buildOwnedBooking().endTime,
      cancelledBookingId: 'booking-status-1',
      actorUserId: userId,
    });
    expect(goalsService.syncMilestonesForCurrentMonth).toHaveBeenCalledWith(
      tenantId
    );
  });

  it('normalizes and stores canonical other reason with note', async () => {
    const updated = await service.execute(
      'booking-status-1',
      {
        status: BookingStatus.CANCELLED,
        cancellationReason: '  other|  Customer asked to reschedule  ',
      },
      tenantId,
      {
        id: userId,
        role: 'MANAGER',
      } as User
    );

    expect(updated.cancellationReason).toBe(
      serializeCancellationReason(
        BookingCancellationReasonKey.OTHER,
        'Customer asked to reschedule'
      )
    );
  });

  it('rejects unsupported cancellation reason keys', async () => {
    await expect(
      service.execute(
        'booking-status-1',
        {
          status: BookingStatus.CANCELLED,
          cancellationReason: 'unsupported_reason_key',
        },
        tenantId,
        {
          id: userId,
          role: 'MANAGER',
        } as User
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects notes when reason key is not other', async () => {
    await expect(
      service.execute(
        'booking-status-1',
        {
          status: BookingStatus.CANCELLED,
          cancellationReason: 'customer_request|manual note',
        },
        tenantId,
        {
          id: userId,
          role: 'MANAGER',
        } as User
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid status transitions', async () => {
    bookingRepository.findOne.mockResolvedValue({
      ...buildOwnedBooking(),
      status: BookingStatus.CANCELLED,
    });

    await expect(
      service.execute(
        'booking-status-1',
        {
          status: BookingStatus.CONFIRMED,
        },
        tenantId,
        {
          id: userId,
          role: 'MANAGER',
        } as User
      )
    ).rejects.toThrow(BadRequestException);
    expect(appLogger.warn).toHaveBeenCalled();
  });
});
