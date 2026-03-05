import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  Booking,
  Customer,
  Facility,
  PromoCode,
  PromoCodeRedemption,
  User,
} from '@khana/data-access';
import {
  BookingCancellationReasonKey,
  BookingStatus,
  RecurrenceFrequency,
  PaymentStatus,
  PromoDiscountType,
  PromoFacilityScope,
  PromoValidationReason,
  serializeCancellationReason,
} from '@khana/shared-dtos';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, CreateRecurringBookingDto } from './dto';

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingRepository: {
    manager: {
      transaction: jest.Mock;
    };
    createQueryBuilder: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    exists: jest.Mock;
  };
  let facilityRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
  };
  let customerRepository: {
    find: jest.Mock;
  };
  let userRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
  };
  let promoCodeRepository: {
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
  };
  let promoCodeRedemptionRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let auditLogRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let txBookingRepository: {
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    exists: jest.Mock;
  };
  let txPromoCodeRepository: {
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
  };
  let txPromoCodeRedemptionRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let txFacilityRepository: {
    createQueryBuilder: jest.Mock;
  };

  const appLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const waitlistService = {
    markFulfilledForUserSlot: jest.fn().mockResolvedValue(undefined),
    notifyFirstForSlot: jest.fn().mockResolvedValue({ notified: false }),
  };

  const goalsService = {
    syncMilestonesForCurrentMonth: jest.fn().mockResolvedValue(undefined),
  };

  const customersService = {
    upsert: jest.fn().mockResolvedValue({
      id: 'customer-1',
    } as Customer),
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

    txBookingRepository = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
      create: jest.fn((payload: unknown) => payload),
      save: jest.fn().mockImplementation(async (payload: unknown) => {
        if (Array.isArray(payload)) {
          return payload.map((item, index) => ({
            id: `booking-${index + 1}`,
            ...(item as Record<string, unknown>),
            createdAt: new Date('2025-03-01T08:00:00.000Z'),
            updatedAt: new Date('2025-03-01T08:00:00.000Z'),
          }));
        }

        return {
          id: 'booking-1',
          ...(payload as Record<string, unknown>),
          createdAt: new Date('2025-03-01T08:00:00.000Z'),
          updatedAt: new Date('2025-03-01T08:00:00.000Z'),
        };
      }),
      exists: jest.fn().mockResolvedValue(false),
    };

    txFacilityRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(lockQueryBuilder),
    };

    txPromoCodeRepository = {
      createQueryBuilder: jest.fn(),
      save: jest.fn().mockImplementation(async (payload: PromoCode) => payload),
    };

    txPromoCodeRedemptionRepository = {
      create: jest.fn((payload: unknown) => payload),
      save: jest.fn(),
    };

    bookingRepository = {
      manager: {
        transaction: jest.fn(
          async (cb: (manager: unknown) => Promise<Booking>) =>
            cb({
              getRepository: (entity: unknown) => {
                if (entity === Booking) return txBookingRepository;
                if (entity === Facility) return txFacilityRepository;
                if (entity === PromoCode) return txPromoCodeRepository;
                if (entity === PromoCodeRedemption)
                  return txPromoCodeRedemptionRepository;
                return null;
              },
            })
        ),
      },
      createQueryBuilder: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      save: jest
        .fn()
        .mockImplementation(async (payload: unknown) => payload as Booking),
      findOne: jest.fn(),
      exists: jest.fn(),
    };

    facilityRepository = {
      findOne: jest.fn().mockResolvedValue(activeFacility),
      find: jest.fn().mockResolvedValue([]),
    };

    customerRepository = {
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

    promoCodeRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      save: jest.fn(),
    };

    promoCodeRedemptionRepository = {
      create: jest.fn((payload: unknown) => payload),
      save: jest.fn(),
    };

    auditLogRepository = {
      create: jest.fn((payload: unknown) => payload),
      save: jest.fn().mockResolvedValue(undefined),
    };

    service = new BookingsService(
      bookingRepository as never,
      customerRepository as never,
      facilityRepository as never,
      userRepository as never,
      promoCodeRepository as never,
      promoCodeRedemptionRepository as never,
      auditLogRepository as never,
      emailService as never,
      appLogger as never,
      waitlistService as never,
      goalsService as never,
      customersService as never
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

    it('applies valid promo and tracks redemption transactionally', async () => {
      const promo = {
        id: 'promo-1',
        tenantId,
        code: 'SAVE10',
        discountType: PromoDiscountType.PERCENTAGE,
        discountValue: 10,
        maxUses: 100,
        currentUses: 0,
        expiresAt: null,
        isActive: true,
        facilityScope: PromoFacilityScope.ALL_FACILITIES,
        facilityId: null,
      } as PromoCode;

      txPromoCodeRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(promo),
      });

      const saved = await service.createBooking(
        createDto({ promoCode: 'save10' }),
        tenantId,
        userId,
        'OWNER'
      );

      expect(saved.priceBreakdown?.promoCode).toBe('SAVE10');
      expect(saved.priceBreakdown?.promoDiscount).toBeGreaterThan(0);
      expect(txPromoCodeRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentUses: 1 })
      );
      expect(txPromoCodeRedemptionRepository.save).toHaveBeenCalled();
    });

    it('normalizes customer phone to +966 before persisting booking', async () => {
      await service.createBooking(
        createDto({ customerPhone: '0551234567' }),
        tenantId,
        userId,
        'OWNER'
      );

      expect(txBookingRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ customerPhone: '+966551234567' })
      );
    });

    it('upserts customer after booking create', async () => {
      const saved = await service.createBooking(
        createDto(),
        tenantId,
        userId,
        'OWNER'
      );

      expect(customersService.upsert).toHaveBeenCalledWith(
        tenantId,
        saved.customerName,
        saved.customerPhone
      );
    });

    it('does not fail booking creation if customer upsert fails', async () => {
      customersService.upsert.mockRejectedValueOnce(new Error('upsert failed'));

      const saved = await service.createBooking(
        createDto(),
        tenantId,
        userId,
        'OWNER'
      );

      expect(saved.id).toBeTruthy();
      await Promise.resolve();
      expect(appLogger.error).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('maps customer tags onto booking list items using normalized phone', async () => {
      const booking = {
        id: 'booking-1',
        bookingReference: 'REF-1',
        facility: activeFacility,
        startTime: new Date('2025-03-01T09:00:00.000Z'),
        endTime: new Date('2025-03-01T10:00:00.000Z'),
        customerName: 'Layla',
        customerPhone: '0551234567',
        totalAmount: 120,
        currency: 'SAR',
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING,
        createdAt: new Date('2025-03-01T08:00:00.000Z'),
        updatedAt: new Date('2025-03-01T08:00:00.000Z'),
        holdUntil: null,
        cancellationReason: null,
        recurrenceGroupId: null,
        recurrenceInstanceNumber: null,
        recurrenceRule: null,
      } as Booking;

      const expiredPendingQuery = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      const listQuery = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([booking]),
      };

      bookingRepository.createQueryBuilder
        .mockReturnValueOnce(expiredPendingQuery)
        .mockReturnValueOnce(listQuery);
      customerRepository.find.mockResolvedValueOnce([
        {
          phone: '+966551234567',
          tags: ['VIP', 'Corporate'],
        } as Customer,
      ]);

      const result = await service.findAll(tenantId, {
        id: userId,
        role: 'MANAGER',
      } as User);

      expect(result).toHaveLength(1);
      expect(result[0]?.customerTags).toEqual(['VIP', 'Corporate']);
    });
  });

  describe('updateStatus cancellation reason validation', () => {
    const buildOwnedBooking = (): Booking =>
      ({
        id: 'booking-status-1',
        bookingReference: 'REF-STATUS-1',
        facility: {
          ...activeFacility,
          tenant: { id: tenantId },
        },
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

    it('accepts and stores canonical preset key reason', async () => {
      bookingRepository.findOne.mockResolvedValue(buildOwnedBooking());

      const updated = await service.updateStatus(
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
      expect(bookingRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          cancellationReason: BookingCancellationReasonKey.CUSTOMER_REQUEST,
        })
      );
    });

    it('normalizes and stores canonical other reason with note', async () => {
      bookingRepository.findOne.mockResolvedValue(buildOwnedBooking());

      const updated = await service.updateStatus(
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
      bookingRepository.findOne.mockResolvedValue(buildOwnedBooking());

      await expect(
        service.updateStatus(
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
      bookingRepository.findOne.mockResolvedValue(buildOwnedBooking());

      await expect(
        service.updateStatus(
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
  });

  describe('createRecurringBookings', () => {
    it('upserts customer after recurring booking creation', async () => {
      const result = await service.createRecurringBookings(
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

    it('returns invalid promo validation state when promo code is not found', async () => {
      const result = await service.previewBooking(
        {
          facilityId,
          startTime: createDto().startTime,
          endTime: createDto().endTime,
          promoCode: 'MISSING10',
        },
        tenantId
      );

      expect(result.promoValidation).toEqual(
        expect.objectContaining({
          code: 'MISSING10',
          isValid: false,
          reason: PromoValidationReason.NOT_FOUND,
        })
      );
      expect(result.priceBreakdown.promoCode).toBeUndefined();
    });
  });
});
