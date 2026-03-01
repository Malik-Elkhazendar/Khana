import { BadRequestException, ConflictException } from '@nestjs/common';
import { Booking, Facility, User } from '@khana/data-access';
import { BookingStatus, PaymentStatus } from '@khana/shared-dtos';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto';

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingRepository: {
    manager: {
      transaction: jest.Mock;
    };
    createQueryBuilder: jest.Mock;
    update: jest.Mock;
    findOne: jest.Mock;
    exists: jest.Mock;
  };
  let facilityRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
  };
  let userRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
  };
  let auditLogRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let txBookingRepository: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    exists: jest.Mock;
  };
  let txFacilityRepository: {
    createQueryBuilder: jest.Mock;
  };

  const appLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const emailService = {
    sendBookingConfirmation: jest.fn(),
    sendBookingCreatedAlert: jest.fn(),
    sendBookingCancellation: jest.fn(),
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

  const createDto = (
    overrides: Partial<CreateBookingDto> = {}
  ): CreateBookingDto => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    return {
      facilityId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      customerName: 'Test Customer',
      customerPhone: '+966512345678',
      ...overrides,
    };
  };

  beforeEach(() => {
    const lockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(activeFacility),
    };

    txBookingRepository = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((payload: unknown) => payload),
      save: jest
        .fn()
        .mockImplementation(async (payload: Record<string, unknown>) => ({
          id: 'booking-1',
          ...payload,
        })),
      exists: jest.fn().mockResolvedValue(false),
    };

    txFacilityRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(lockQueryBuilder),
    };

    bookingRepository = {
      manager: {
        transaction: jest.fn(
          async (cb: (manager: unknown) => Promise<Booking>) =>
            cb({
              getRepository: (entity: unknown) => {
                if (entity === Booking) return txBookingRepository;
                if (entity === Facility) return txFacilityRepository;
                return null;
              },
            })
        ),
      },
      createQueryBuilder: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      exists: jest.fn(),
    };

    facilityRepository = {
      findOne: jest.fn().mockResolvedValue(activeFacility),
      find: jest.fn().mockResolvedValue([]),
    };

    userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: userId,
        email: 'user@khana.dev',
        name: 'User',
      } as User),
      find: jest.fn().mockResolvedValue([]),
    };

    auditLogRepository = {
      create: jest.fn((payload: unknown) => payload),
      save: jest.fn().mockResolvedValue(undefined),
    };

    service = new BookingsService(
      bookingRepository as never,
      facilityRepository as never,
      userRepository as never,
      auditLogRepository as never,
      emailService as never,
      appLogger as never
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBooking', () => {
    it('rejects invalid booking windows with 400', async () => {
      const dto = createDto({
        endTime: createDto().startTime,
      });

      await expect(
        service.createBooking(dto, tenantId, userId, 'OWNER')
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects terminal lifecycle status at create', async () => {
      const dto = createDto({
        status: BookingStatus.COMPLETED,
      });

      await expect(
        service.createBooking(dto, tenantId, userId, 'OWNER')
      ).rejects.toThrow(BadRequestException);
    });

    it('always persists server-owned payment status as PENDING', async () => {
      const dto = createDto();

      const saved = await service.createBooking(dto, tenantId, userId, 'OWNER');

      expect(txBookingRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ paymentStatus: PaymentStatus.PENDING })
      );
      expect(saved.paymentStatus).toBe(PaymentStatus.PENDING);
    });

    it('blocks create when facility is inactive', async () => {
      facilityRepository.findOne.mockResolvedValue({
        ...activeFacility,
        isActive: false,
      });

      await expect(
        service.createBooking(createDto(), tenantId, userId, 'OWNER')
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getFacilities', () => {
    it('requests only active facilities', async () => {
      facilityRepository.find.mockResolvedValue([activeFacility]);

      await service.getFacilities(tenantId);

      expect(facilityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant: { id: tenantId }, isActive: true },
        })
      );
    });
  });

  describe('previewBooking', () => {
    it('rejects inactive facility for preview', async () => {
      facilityRepository.findOne.mockResolvedValue({
        ...activeFacility,
        isActive: false,
      });

      await expect(
        service.previewBooking(
          {
            facilityId,
            startTime: createDto().startTime,
            endTime: createDto().endTime,
          },
          tenantId
        )
      ).rejects.toThrow(ConflictException);
    });
  });
});
