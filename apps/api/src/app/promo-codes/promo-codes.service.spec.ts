import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Facility, PromoCode, User } from '@khana/data-access';
import {
  PromoDiscountType,
  PromoFacilityScope,
  UserRole,
} from '@khana/shared-dtos';
import { PromoCodesService } from './promo-codes.service';

describe('PromoCodesService', () => {
  let service: PromoCodesService;

  const tenantId = 'tenant-1';
  const facilityId = 'facility-1';
  const userId = 'user-1';

  const promoCodeRepository = {
    findOne: jest.fn(),
    create: jest.fn((payload: unknown) => payload),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const facilityRepository = {
    findOne: jest.fn(),
  };

  const auditLogRepository = {
    create: jest.fn((payload: unknown) => payload),
    save: jest.fn(),
  };

  const appLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    facilityRepository.findOne.mockResolvedValue({
      id: facilityId,
      tenant: { id: tenantId },
    } as Facility);

    promoCodeRepository.save.mockImplementation(async (payload: PromoCode) => ({
      id: 'promo-1',
      tenantId,
      code: payload.code,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      maxUses: payload.maxUses ?? null,
      currentUses: payload.currentUses ?? 0,
      expiresAt: payload.expiresAt ?? null,
      facilityScope: payload.facilityScope,
      facilityId: payload.facilityId ?? null,
      isActive: payload.isActive ?? true,
      createdAt: new Date('2026-03-02T00:00:00.000Z'),
      updatedAt: new Date('2026-03-02T00:00:00.000Z'),
    }));

    service = new PromoCodesService(
      promoCodeRepository as never,
      facilityRepository as never,
      auditLogRepository as never,
      appLogger as never
    );
  });

  describe('createPromoCode', () => {
    it('creates promo code and normalizes code to uppercase', async () => {
      promoCodeRepository.findOne.mockResolvedValue(null);

      const result = await service.createPromoCode(
        {
          code: 'summer_10',
          discountType: PromoDiscountType.PERCENTAGE,
          discountValue: 10,
          maxUses: 100,
          facilityScope: PromoFacilityScope.ALL_FACILITIES,
        },
        tenantId,
        { id: userId, role: UserRole.OWNER } as User
      );

      expect(result.code).toBe('SUMMER_10');
      expect(result.discountValue).toBe(10);
      expect(promoCodeRepository.save).toHaveBeenCalled();
    });

    it('rejects non-managerial roles', async () => {
      await expect(
        service.createPromoCode(
          {
            code: 'SAVE20',
            discountType: PromoDiscountType.PERCENTAGE,
            discountValue: 20,
            facilityScope: PromoFacilityScope.ALL_FACILITIES,
          },
          tenantId,
          { id: userId, role: UserRole.STAFF } as User
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects duplicate promo codes in same tenant', async () => {
      promoCodeRepository.findOne.mockResolvedValue({ id: 'promo-existing' });

      await expect(
        service.createPromoCode(
          {
            code: 'SAVE20',
            discountType: PromoDiscountType.PERCENTAGE,
            discountValue: 20,
            facilityScope: PromoFacilityScope.ALL_FACILITIES,
          },
          tenantId,
          { id: userId, role: UserRole.MANAGER } as User
        )
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updatePromoCode', () => {
    it('rejects maxUses lower than currentUses', async () => {
      promoCodeRepository.findOne.mockResolvedValue({
        id: 'promo-1',
        tenantId,
        code: 'SAVE10',
        discountType: PromoDiscountType.PERCENTAGE,
        discountValue: 10,
        maxUses: 20,
        currentUses: 10,
        expiresAt: null,
        facilityScope: PromoFacilityScope.ALL_FACILITIES,
        facilityId: null,
        isActive: true,
        createdAt: new Date('2026-03-02T00:00:00.000Z'),
        updatedAt: new Date('2026-03-02T00:00:00.000Z'),
      } as PromoCode);

      await expect(
        service.updatePromoCode('promo-1', { maxUses: 5 }, tenantId, {
          id: userId,
          role: UserRole.OWNER,
        } as User)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listPromoCodes', () => {
    it('returns paginated promo list', async () => {
      const getManyAndCount = jest.fn().mockResolvedValue([
        [
          {
            id: 'promo-1',
            tenantId,
            code: 'SAVE10',
            discountType: PromoDiscountType.PERCENTAGE,
            discountValue: 10,
            maxUses: null,
            currentUses: 0,
            expiresAt: null,
            facilityScope: PromoFacilityScope.ALL_FACILITIES,
            facilityId: null,
            isActive: true,
            createdAt: new Date('2026-03-02T00:00:00.000Z'),
            updatedAt: new Date('2026-03-02T00:00:00.000Z'),
          } as PromoCode,
        ],
        1,
      ]);

      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount,
      };
      promoCodeRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listPromoCodes(
        { page: 1, pageSize: 20 },
        tenantId,
        { id: userId, role: UserRole.MANAGER } as User
      );

      expect(result.total).toBe(1);
      expect(result.items[0]?.code).toBe('SAVE10');
    });
  });
});
