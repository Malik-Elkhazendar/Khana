import { PricingConfig } from '@khana/shared-dtos';
import {
  calculatePrice,
  calculateTimeMultiplier,
  calculateDayMultiplier,
  calculateDurationDiscount,
  calculatePricingUnits,
  DEFAULT_CURRENCY,
} from './price-calculator';

describe('PriceCalculator', () => {
  // Helper to create dates at specific times
  const createDate = (
    year: number,
    month: number,
    day: number,
    hour: number,
    minute = 0
  ): Date => {
    return new Date(year, month - 1, day, hour, minute, 0, 0);
  };

  // Standard pricing config for tests
  const basePricingConfig: PricingConfig = {
    basePrice: 100,
    currency: 'SAR',
  };

  const fullPricingConfig: PricingConfig = {
    basePrice: 100,
    currency: 'SAR',
    peakHours: {
      start: 17,
      end: 22,
      multiplier: 1.5,
    },
    weekendMultiplier: 1.3,
    durationDiscounts: [
      { minDuration: 120, discount: 0.1 }, // 10% off for 2+ hours
      { minDuration: 180, discount: 0.15 }, // 15% off for 3+ hours
    ],
  };

  describe('calculatePricingUnits', () => {
    it('should return 1 for exactly 60 minutes', () => {
      expect(calculatePricingUnits(60)).toBe(1);
    });

    it('should round up to nearest hour', () => {
      expect(calculatePricingUnits(61)).toBe(2);
      expect(calculatePricingUnits(90)).toBe(2);
      expect(calculatePricingUnits(120)).toBe(2);
      expect(calculatePricingUnits(121)).toBe(3);
    });
  });

  describe('calculateTimeMultiplier', () => {
    it('should return 1.0 when no peak hours configured', () => {
      const result = calculateTimeMultiplier(
        createDate(2025, 1, 15, 18),
        basePricingConfig
      );
      expect(result).toBe(1.0);
    });

    it('should return multiplier during peak hours', () => {
      const result = calculateTimeMultiplier(
        createDate(2025, 1, 15, 18), // 6 PM - peak
        fullPricingConfig
      );
      expect(result).toBe(1.5);
    });

    it('should return 1.0 outside peak hours', () => {
      const result = calculateTimeMultiplier(
        createDate(2025, 1, 15, 10), // 10 AM - not peak
        fullPricingConfig
      );
      expect(result).toBe(1.0);
    });

    it('should handle peak hour boundary (start)', () => {
      const result = calculateTimeMultiplier(
        createDate(2025, 1, 15, 17), // 5 PM - start of peak
        fullPricingConfig
      );
      expect(result).toBe(1.5);
    });

    it('should handle peak hour boundary (end)', () => {
      const result = calculateTimeMultiplier(
        createDate(2025, 1, 15, 22), // 10 PM - end of peak (exclusive)
        fullPricingConfig
      );
      expect(result).toBe(1.0);
    });
  });

  describe('calculateDayMultiplier', () => {
    it('should return 1.0 when no weekend multiplier configured', () => {
      const result = calculateDayMultiplier(
        createDate(2025, 1, 16, 10), // Thursday
        basePricingConfig
      );
      expect(result).toBe(1.0);
    });

    it('should return multiplier on Thursday (MENA weekend)', () => {
      // January 16, 2025 is Thursday
      const result = calculateDayMultiplier(
        createDate(2025, 1, 16, 10),
        fullPricingConfig
      );
      expect(result).toBe(1.3);
    });

    it('should return multiplier on Friday (MENA weekend)', () => {
      // January 17, 2025 is Friday
      const result = calculateDayMultiplier(
        createDate(2025, 1, 17, 10),
        fullPricingConfig
      );
      expect(result).toBe(1.3);
    });

    it('should return 1.0 on weekdays', () => {
      // January 15, 2025 is Wednesday
      const result = calculateDayMultiplier(
        createDate(2025, 1, 15, 10),
        fullPricingConfig
      );
      expect(result).toBe(1.0);
    });
  });

  describe('calculateDurationDiscount', () => {
    it('should return 0 when no discounts configured', () => {
      const result = calculateDurationDiscount(180, basePricingConfig);
      expect(result).toBe(0);
    });

    it('should return 0 for short duration', () => {
      const result = calculateDurationDiscount(60, fullPricingConfig);
      expect(result).toBe(0);
    });

    it('should return correct discount for 2+ hours', () => {
      const result = calculateDurationDiscount(120, fullPricingConfig);
      expect(result).toBe(0.1); // 10% discount
    });

    it('should return best discount for 3+ hours', () => {
      const result = calculateDurationDiscount(180, fullPricingConfig);
      expect(result).toBe(0.15); // 15% discount
    });
  });

  describe('calculatePrice', () => {
    it('should calculate basic price without multipliers', () => {
      const startTime = createDate(2025, 1, 15, 10); // Wednesday, 10 AM
      const endTime = createDate(2025, 1, 15, 11); // 1 hour

      const result = calculatePrice({
        startTime,
        endTime,
        pricingConfig: basePricingConfig,
      });

      expect(result.basePrice).toBe(100);
      expect(result.timeMultiplier).toBe(1.0);
      expect(result.dayMultiplier).toBe(1.0);
      expect(result.durationDiscount).toBe(0);
      expect(result.subtotal).toBe(100);
      expect(result.discountAmount).toBe(0);
      expect(result.total).toBe(100);
      expect(result.currency).toBe('SAR');
    });

    it('should apply peak hour multiplier', () => {
      const startTime = createDate(2025, 1, 15, 18); // Wednesday, 6 PM (peak)
      const endTime = createDate(2025, 1, 15, 19); // 1 hour

      const result = calculatePrice({
        startTime,
        endTime,
        pricingConfig: fullPricingConfig,
      });

      expect(result.timeMultiplier).toBe(1.5);
      expect(result.subtotal).toBe(150); // 100 * 1.5
      expect(result.total).toBe(150);
    });

    it('should apply weekend multiplier', () => {
      const startTime = createDate(2025, 1, 16, 10); // Thursday (MENA weekend), 10 AM
      const endTime = createDate(2025, 1, 16, 11); // 1 hour

      const result = calculatePrice({
        startTime,
        endTime,
        pricingConfig: fullPricingConfig,
      });

      expect(result.dayMultiplier).toBe(1.3);
      expect(result.subtotal).toBe(130); // 100 * 1.3
      expect(result.total).toBe(130);
    });

    it('should apply duration discount', () => {
      const startTime = createDate(2025, 1, 15, 10); // Wednesday, 10 AM
      const endTime = createDate(2025, 1, 15, 12); // 2 hours

      const result = calculatePrice({
        startTime,
        endTime,
        pricingConfig: fullPricingConfig,
      });

      expect(result.durationDiscount).toBe(0.1);
      expect(result.subtotal).toBe(200); // 100 * 2 hours
      expect(result.discountAmount).toBe(20); // 10% of 200
      expect(result.total).toBe(180);
    });

    it('should apply promo code discount', () => {
      const startTime = createDate(2025, 1, 15, 10);
      const endTime = createDate(2025, 1, 15, 11);

      const result = calculatePrice({
        startTime,
        endTime,
        pricingConfig: basePricingConfig,
        promoCode: 'DISCOUNT10',
      });

      expect(result.promoCode).toBe('DISCOUNT10');
      expect(result.promoDiscount).toBe(10); // 10% of 100
      expect(result.total).toBe(90);
    });

    it('should stack all multipliers and discounts correctly', () => {
      // Thursday (weekend) at 6 PM (peak) for 3 hours with promo code
      const startTime = createDate(2025, 1, 16, 18);
      const endTime = createDate(2025, 1, 16, 21);

      const result = calculatePrice({
        startTime,
        endTime,
        pricingConfig: fullPricingConfig,
        promoCode: 'DISCOUNT10',
      });

      // 100 base * 3 hours * 1.5 peak * 1.3 weekend = 585 subtotal
      expect(result.subtotal).toBe(585);
      // 15% duration discount + 10% promo discount
      const durationDiscountAmount = 585 * 0.15; // 87.75
      const promoDiscountAmount = 585 * 0.1; // 58.5
      expect(result.discountAmount).toBeCloseTo(
        durationDiscountAmount + promoDiscountAmount
      );
      expect(result.total).toBeCloseTo(585 - 87.75 - 58.5);
    });

    it('should use default currency when not specified', () => {
      const result = calculatePrice({
        startTime: createDate(2025, 1, 15, 10),
        endTime: createDate(2025, 1, 15, 11),
        pricingConfig: { basePrice: 100, currency: '' },
      });

      expect(result.currency).toBe(DEFAULT_CURRENCY);
    });
  });
});
