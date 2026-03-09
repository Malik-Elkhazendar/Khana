import { ConflictException } from '@nestjs/common';
import { Booking, Facility, PromoCode } from '@khana/data-access';
import {
  BookingStatus,
  PromoDiscountType,
  PromoValidationReason,
} from '@khana/shared-dtos';
import { PreviewBookingService } from './preview-booking.service';

describe('PreviewBookingService', () => {
  let service: PreviewBookingService;
  let bookingRepository: {
    find: jest.Mock;
  };
  let facilityRepository: {
    findOne: jest.Mock;
  };
  let promoCodeRepository: {
    findOne: jest.Mock;
  };

  const tenantId = 'tenant-1';
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

  beforeEach(() => {
    bookingRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    facilityRepository = {
      findOne: jest.fn().mockResolvedValue(activeFacility),
    };
    promoCodeRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    service = new PreviewBookingService(
      bookingRepository as never,
      facilityRepository as never,
      promoCodeRepository as never
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects inactive facility for preview', async () => {
    facilityRepository.findOne.mockResolvedValue({
      ...activeFacility,
      isActive: false,
    });

    await expect(
      service.execute(
        {
          facilityId,
          startTime: '2025-03-10T09:00:00.000Z',
          endTime: '2025-03-10T10:00:00.000Z',
        },
        tenantId
      )
    ).rejects.toThrow(ConflictException);
  });

  it('returns invalid promo validation state when promo code is not found', async () => {
    const result = await service.execute(
      {
        facilityId,
        startTime: '2025-03-10T09:00:00.000Z',
        endTime: '2025-03-10T10:00:00.000Z',
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

  it('applies valid promo discounts to preview price breakdown', async () => {
    promoCodeRepository.findOne.mockResolvedValue({
      id: 'promo-1',
      tenantId,
      code: 'SAVE10',
      discountType: PromoDiscountType.PERCENTAGE,
      discountValue: 10,
      maxUses: 100,
      currentUses: 0,
      expiresAt: null,
      isActive: true,
      facilityScope: 'ALL_FACILITIES',
      facilityId: null,
    } as unknown as PromoCode);

    const result = await service.execute(
      {
        facilityId,
        startTime: '2025-03-10T09:00:00.000Z',
        endTime: '2025-03-10T10:00:00.000Z',
        promoCode: 'save10',
      },
      tenantId
    );

    expect(result.promoValidation).toEqual(
      expect.objectContaining({
        code: 'SAVE10',
        isValid: true,
      })
    );
    expect(result.priceBreakdown.promoCode).toBe('SAVE10');
    expect(result.priceBreakdown.promoDiscount).toBeGreaterThan(0);
  });
});
