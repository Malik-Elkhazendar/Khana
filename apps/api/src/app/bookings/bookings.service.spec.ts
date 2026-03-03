import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  Booking,
  Facility,
  PromoCode,
  PromoCodeRedemption,
  User,
} from '@khana/data-access';
import {
  BookingStatus,
  PaymentStatus,
  PromoDiscountType,
  PromoFacilityScope,
  PromoValidationReason,
} from '@khana/shared-dtos';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto';

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingRepository: {
    manager: {
      transaction: jest.Mock;
    };
    createQueryBuilder: jest.Mock;
    find: jest.Mock;
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
      facilityRepository as never,
      userRepository as never,
      promoCodeRepository as never,
      promoCodeRedemptionRepository as never,
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
