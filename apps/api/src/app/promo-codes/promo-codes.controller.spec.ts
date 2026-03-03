import { PromoCodesController } from './promo-codes.controller';
import {
  PromoDiscountType,
  PromoFacilityScope,
  UserRole,
} from '@khana/shared-dtos';

describe('PromoCodesController', () => {
  const promoCodesService = {
    createPromoCode: jest.fn(),
    listPromoCodes: jest.fn(),
    updatePromoCode: jest.fn(),
  };

  let controller: PromoCodesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PromoCodesController(promoCodesService as never);
  });

  it('delegates createPromoCode to service', async () => {
    const dto = {
      code: 'SAVE10',
      discountType: PromoDiscountType.PERCENTAGE,
      discountValue: 10,
      facilityScope: PromoFacilityScope.ALL_FACILITIES,
    };
    const user = { id: 'user-1', role: UserRole.OWNER };
    promoCodesService.createPromoCode.mockResolvedValue({ id: 'promo-1' });

    await controller.createPromoCode(dto, 'tenant-1', user as never);

    expect(promoCodesService.createPromoCode).toHaveBeenCalledWith(
      dto,
      'tenant-1',
      user
    );
  });

  it('delegates listPromoCodes to service', async () => {
    const query = { page: 1, pageSize: 20 };
    const user = { id: 'user-1', role: UserRole.MANAGER };
    promoCodesService.listPromoCodes.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await controller.listPromoCodes(query, 'tenant-1', user as never);

    expect(promoCodesService.listPromoCodes).toHaveBeenCalledWith(
      query,
      'tenant-1',
      user
    );
  });

  it('delegates updatePromoCode to service', async () => {
    const dto = { isActive: false };
    const user = { id: 'user-1', role: UserRole.OWNER };
    promoCodesService.updatePromoCode.mockResolvedValue({ id: 'promo-1' });

    await controller.updatePromoCode('promo-1', dto, 'tenant-1', user as never);

    expect(promoCodesService.updatePromoCode).toHaveBeenCalledWith(
      'promo-1',
      dto,
      'tenant-1',
      user
    );
  });
});
