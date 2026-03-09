import { AuditLog, Booking, Customer, Facility } from '@khana/data-access';
import {
  BookingStatus,
  PaymentStatus,
  RecurrenceFrequency,
} from '@khana/shared-dtos';
import { CreateRecurringBookingDto } from '../dto';
import { CreateRecurringBookingsService } from './create-recurring-bookings.service';
import { BookingWriteSupportService } from './booking-write-support.service';

describe('CreateRecurringBookingsService', () => {
  let service: CreateRecurringBookingsService;
  let bookingRepository: {
    manager: {
      transaction: jest.Mock;
    };
  };
  let facilityRepository: {
    findOne: jest.Mock;
  };
  let auditLogRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };

  const appLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const customersService = {
    upsert: jest.fn().mockResolvedValue({
      id: 'customer-1',
    } as Customer),
  };

  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const facilityId = 'facility-1';

  const activeFacility = {
    id: facilityId,
    name: 'Center Court',
    isActive: true,
    tenant: { id: tenantId },
    config: {
      openTime: '08:00',
      closeTime: '23:00',
      pricePerHour: 100,
    },
  } as unknown as Facility;

  const createRecurringDto = (
    overrides: Partial<CreateRecurringBookingDto> = {}
  ): CreateRecurringBookingDto => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    return {
      facilityId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      customerName: 'Recurring Customer',
      customerPhone: '0551234567',
      recurrenceRule: {
        frequency: RecurrenceFrequency.WEEKLY,
        intervalWeeks: 1,
        occurrences: 1,
      },
      ...overrides,
    };
  };

  beforeEach(() => {
    const lockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(activeFacility),
    };
    const txBookingRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
      create: jest.fn((payload: unknown) => payload),
      save: jest.fn().mockImplementation(async (payload: Booking[]) =>
        payload.map((item, index) => ({
          id: `booking-${index + 1}`,
          ...(item as unknown as Record<string, unknown>),
          createdAt: new Date('2025-03-01T08:00:00.000Z'),
          updatedAt: new Date('2025-03-01T08:00:00.000Z'),
        }))
      ),
      exists: jest.fn().mockResolvedValue(false),
    };

    bookingRepository = {
      manager: {
        transaction: jest.fn(
          async (
            cb: (
              manager: unknown
            ) => Promise<ReturnType<CreateRecurringBookingsService['execute']>>
          ) =>
            cb({
              getRepository: (entity: unknown) => {
                if (entity === Booking) return txBookingRepository;
                if (entity === Facility) {
                  return {
                    createQueryBuilder: jest
                      .fn()
                      .mockReturnValue(lockQueryBuilder),
                  };
                }
                return null;
              },
            })
        ),
      },
    };

    facilityRepository = {
      findOne: jest.fn().mockResolvedValue(activeFacility),
    };

    auditLogRepository = {
      create: jest.fn((payload: unknown) => payload),
      save: jest.fn().mockResolvedValue(undefined),
    };

    service = new CreateRecurringBookingsService(
      bookingRepository as never,
      facilityRepository as never,
      auditLogRepository as never,
      appLogger as never,
      customersService as never,
      new BookingWriteSupportService()
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('upserts customer after recurring booking creation', async () => {
    const result = await service.execute(
      createRecurringDto(),
      tenantId,
      userId,
      'OWNER'
    );

    expect(result.createdCount).toBeGreaterThan(0);
    expect(customersService.upsert).toHaveBeenCalledWith(
      tenantId,
      'Recurring Customer',
      '+966551234567'
    );
    expect(auditLogRepository.save).toHaveBeenCalled();
  });
});
