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
  BookingStatus,
  PaymentStatus,
  PromoDiscountType,
  PromoFacilityScope,
} from '@khana/shared-dtos';
import { CreateBookingDto } from '../dto';
import { CreateBookingService } from './create-booking.service';
import { BookingWriteSupportService } from './booking-write-support.service';

describe('CreateBookingService', () => {
  let service: CreateBookingService;
  let bookingRepository: {
    manager: {
      transaction: jest.Mock;
    };
  };
  let facilityRepository: {
    findOne: jest.Mock;
  };
  let userRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
  };
  let txBookingRepository: {
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

  const appLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const waitlistService = {
    markFulfilledForUserSlot: jest.fn().mockResolvedValue(undefined),
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
    sendNewBookingAlert: jest.fn(),
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
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
      create: jest.fn((payload: unknown) => payload),
      save: jest.fn().mockImplementation(async (payload: unknown) => ({
        id: 'booking-1',
        ...(payload as Record<string, unknown>),
        createdAt: new Date('2025-03-01T08:00:00.000Z'),
        updatedAt: new Date('2025-03-01T08:00:00.000Z'),
      })),
      exists: jest.fn().mockResolvedValue(false),
    };

    txPromoCodeRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
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
                if (entity === Facility) {
                  return {
                    createQueryBuilder: jest
                      .fn()
                      .mockReturnValue(lockQueryBuilder),
                  };
                }
                if (entity === PromoCode) return txPromoCodeRepository;
                if (entity === PromoCodeRedemption) {
                  return txPromoCodeRedemptionRepository;
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

    userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: userId,
        email: 'user@khana.dev',
        name: 'User',
      } as User),
      find: jest.fn().mockResolvedValue([]),
    };

    service = new CreateBookingService(
      bookingRepository as never,
      facilityRepository as never,
      userRepository as never,
      emailService as never,
      appLogger as never,
      waitlistService as never,
      goalsService as never,
      customersService as never,
      new BookingWriteSupportService()
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects invalid booking windows with 400', async () => {
    const dto = createDto({
      endTime: createDto().startTime,
    });

    await expect(
      service.execute(dto, tenantId, userId, 'OWNER')
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects terminal lifecycle status at create', async () => {
    const dto = createDto({
      status: BookingStatus.COMPLETED,
    });

    await expect(
      service.execute(dto, tenantId, userId, 'OWNER')
    ).rejects.toThrow(BadRequestException);
  });

  it('always persists server-owned payment status as pending', async () => {
    const saved = await service.execute(createDto(), tenantId, userId, 'OWNER');

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
      service.execute(createDto(), tenantId, userId, 'OWNER')
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

    const saved = await service.execute(
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
    await service.execute(
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
    const saved = await service.execute(createDto(), tenantId, userId, 'OWNER');

    expect(customersService.upsert).toHaveBeenCalledWith(
      tenantId,
      saved.customerName,
      saved.customerPhone
    );
  });

  it('does not fail booking creation if customer upsert fails', async () => {
    customersService.upsert.mockRejectedValueOnce(new Error('upsert failed'));

    const saved = await service.execute(createDto(), tenantId, userId, 'OWNER');

    expect(saved.id).toBeTruthy();
    expect(appLogger.error).toHaveBeenCalled();
  });
});
