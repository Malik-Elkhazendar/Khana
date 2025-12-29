/**
 * Price Calculator
 * Pure functions for calculating booking prices
 */

import { PriceBreakdown, PricingConfig } from '@khana/shared-dtos';
import { diffInMinutes, isMenaWeekend, isPeakHour } from '@khana/shared-utils';
import { PriceCalculationInput } from './types';

/**
 * Default currency for MENA region
 */
export const DEFAULT_CURRENCY = 'SAR';

/**
 * Calculate time multiplier based on peak hours
 */
export function calculateTimeMultiplier(
  startTime: Date,
  pricingConfig: PricingConfig
): number {
  if (!pricingConfig.peakHours) {
    return 1.0;
  }

  const { start, end, multiplier } = pricingConfig.peakHours;
  const isPeak = isPeakHour(startTime, start, end);

  return isPeak ? multiplier : 1.0;
}

/**
 * Calculate day multiplier based on MENA weekend (Thu-Fri)
 */
export function calculateDayMultiplier(
  startTime: Date,
  pricingConfig: PricingConfig
): number {
  if (!pricingConfig.weekendMultiplier) {
    return 1.0;
  }

  return isMenaWeekend(startTime) ? pricingConfig.weekendMultiplier : 1.0;
}

/**
 * Calculate duration discount based on booking length
 */
export function calculateDurationDiscount(
  durationMinutes: number,
  pricingConfig: PricingConfig
): number {
  if (
    !pricingConfig.durationDiscounts ||
    pricingConfig.durationDiscounts.length === 0
  ) {
    return 0;
  }

  // Sort discounts by minDuration descending to find the best applicable discount
  const sortedDiscounts = [...pricingConfig.durationDiscounts].sort(
    (a, b) => b.minDuration - a.minDuration
  );

  for (const discount of sortedDiscounts) {
    if (durationMinutes >= discount.minDuration) {
      return discount.discount;
    }
  }

  return 0;
}

/**
 * Calculate the number of pricing units (hours for hourly facilities)
 */
export function calculatePricingUnits(durationMinutes: number): number {
  // Round up to the nearest hour
  return Math.ceil(durationMinutes / 60);
}

/**
 * Calculate price breakdown for a booking
 *
 * Pure function - no side effects, fully deterministic
 *
 * @param input - Price calculation input
 * @returns Complete price breakdown
 */
export function calculatePrice(input: PriceCalculationInput): PriceBreakdown {
  const { startTime, endTime, pricingConfig, promoCode } = input;

  const durationMinutes = diffInMinutes(startTime, endTime);
  const pricingUnits = calculatePricingUnits(durationMinutes);

  const basePrice = pricingConfig.basePrice;
  const currency = pricingConfig.currency || DEFAULT_CURRENCY;

  const timeMultiplier = calculateTimeMultiplier(startTime, pricingConfig);
  const dayMultiplier = calculateDayMultiplier(startTime, pricingConfig);
  const durationDiscount = calculateDurationDiscount(
    durationMinutes,
    pricingConfig
  );

  // Calculate subtotal: basePrice * units * timeMultiplier * dayMultiplier
  const subtotal = basePrice * pricingUnits * timeMultiplier * dayMultiplier;

  // Calculate duration discount amount
  const durationDiscountAmount = subtotal * durationDiscount;

  // Calculate promo discount (placeholder - in real system, would look up promo code)
  let promoDiscount = 0;
  if (promoCode) {
    // Simple placeholder: 10% discount for any valid promo code
    // In production, this would query a promo code service
    promoDiscount = subtotal * 0.1;
  }

  const discountAmount = durationDiscountAmount + promoDiscount;
  const total = Math.max(0, subtotal - discountAmount);

  return {
    basePrice,
    timeMultiplier,
    dayMultiplier,
    durationDiscount,
    subtotal,
    discountAmount,
    promoDiscount: promoCode ? promoDiscount : undefined,
    promoCode: promoCode || undefined,
    total,
    currency,
  };
}
