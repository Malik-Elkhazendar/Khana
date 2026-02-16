/**
 * Booking Preview
 * Orchestrates conflict detection and price calculation for booking preview
 */

import { PricedTimeSlot } from '@khana/shared-dtos';
import {
  addMinutes,
  diffInMinutes,
  setTimeFromString,
} from '@khana/shared-utils';
import { detectConflicts } from './conflict-detector';
import { calculatePrice } from './price-calculator';
import {
  BookingPreviewInput,
  BookingPreviewResult,
  FacilityConfig,
  OccupiedSlot,
} from './types';

/**
 * Validate booking preview input
 *
 * @param input - Booking preview input
 * @param facilityConfig - Facility configuration
 * @returns Array of validation error messages (empty if valid)
 */
export function validateBookingInput(
  input: BookingPreviewInput,
  facilityConfig: FacilityConfig
): string[] {
  const errors: string[] = [];

  // Validate facility exists
  if (!facilityConfig) {
    errors.push('Facility not found.');
    return errors;
  }

  // Validate start time is before end time
  if (input.startTime >= input.endTime) {
    errors.push('Start time must be before end time.');
  }

  // Validate booking is not in the past
  const now = new Date();
  if (input.startTime < now) {
    errors.push('Cannot book in the past.');
  }

  // Validate minimum duration (at least one slot)
  const durationMinutes = diffInMinutes(input.startTime, input.endTime);
  if (durationMinutes < facilityConfig.slotDurationMinutes) {
    errors.push(
      `Minimum booking duration is ${facilityConfig.slotDurationMinutes} minutes.`
    );
  }

  // Validate duration is a multiple of slot duration
  if (durationMinutes % facilityConfig.slotDurationMinutes !== 0) {
    errors.push(
      `Booking duration must be a multiple of ${facilityConfig.slotDurationMinutes} minutes.`
    );
  }

  // Validate booking is within operating hours
  const dayOpen = setTimeFromString(input.startTime, facilityConfig.openTime);
  const dayClose = setTimeFromString(input.startTime, facilityConfig.closeTime);
  if (input.startTime < dayOpen || input.endTime > dayClose) {
    errors.push(
      `Booking must be within operating hours (${facilityConfig.openTime}-${facilityConfig.closeTime}).`
    );
  }

  return errors;
}

/**
 * Find alternative available slots near the requested time
 *
 * @param requestedStart - Original requested start time
 * @param occupiedSlots - Currently occupied slots
 * @param facilityConfig - Facility configuration
 * @param maxAlternatives - Maximum number of alternatives to return
 * @returns Array of available time slots with pricing
 */
export function findAlternativeSlots(
  requestedStart: Date,
  requestedEnd: Date,
  occupiedSlots: OccupiedSlot[],
  facilityConfig: FacilityConfig,
  maxAlternatives = 3
): PricedTimeSlot[] {
  const alternatives: PricedTimeSlot[] = [];
  const slotDuration = facilityConfig.slotDurationMinutes;
  const requestedDurationMinutes = diffInMinutes(requestedStart, requestedEnd);
  const facilitySlots = occupiedSlots.filter(
    (s) => s.facilityId === facilityConfig.id
  );

  // Check slots before and after the requested time
  const searchRangeHours = 4; // Search 4 hours before and after
  const slotsToCheck = Math.ceil((searchRangeHours * 60 * 2) / slotDuration);

  for (let i = -slotsToCheck / 2; i <= slotsToCheck / 2; i++) {
    if (alternatives.length >= maxAlternatives) break;

    const candidateStart = addMinutes(requestedStart, i * slotDuration);
    const candidateEnd = addMinutes(candidateStart, requestedDurationMinutes);

    // Skip if candidate is in the past
    if (candidateStart < new Date()) continue;

    const dayOpen = setTimeFromString(candidateStart, facilityConfig.openTime);
    const dayClose = setTimeFromString(
      candidateStart,
      facilityConfig.closeTime
    );
    if (candidateStart < dayOpen || candidateEnd > dayClose) continue;

    // Check if this slot conflicts with any occupied slot
    const hasConflict = facilitySlots.some((occupied) => {
      return (
        candidateStart < occupied.endTime && candidateEnd > occupied.startTime
      );
    });

    if (!hasConflict) {
      const priceBreakdown = calculatePrice({
        startTime: candidateStart,
        endTime: candidateEnd,
        pricingConfig: facilityConfig.pricing,
      });

      alternatives.push({
        startTime: candidateStart,
        endTime: candidateEnd,
        price: priceBreakdown.total,
        currency: priceBreakdown.currency,
      });
    }
  }

  return alternatives;
}

/**
 * Generate a booking preview
 *
 * This is the main entry point for booking preview functionality.
 * It validates input, checks for conflicts, calculates price, and suggests alternatives.
 *
 * Pure function - no side effects, fully deterministic given the same inputs
 *
 * @param input - Booking preview input
 * @param facilityConfig - Facility configuration
 * @param occupiedSlots - Currently occupied slots for this facility
 * @returns Complete booking preview result
 */
export function previewBooking(
  input: BookingPreviewInput,
  facilityConfig: FacilityConfig,
  occupiedSlots: OccupiedSlot[]
): BookingPreviewResult {
  // Step 1: Validate input
  const validationErrors = validateBookingInput(input, facilityConfig);

  if (validationErrors.length > 0) {
    // Return early with validation errors and empty price breakdown
    return {
      canBook: false,
      priceBreakdown: {
        basePrice: 0,
        timeMultiplier: 1,
        dayMultiplier: 1,
        durationDiscount: 0,
        subtotal: 0,
        discountAmount: 0,
        total: 0,
        currency: facilityConfig?.pricing?.currency || 'SAR',
      },
      validationErrors,
    };
  }

  // Step 2: Calculate price
  const priceBreakdown = calculatePrice({
    startTime: input.startTime,
    endTime: input.endTime,
    pricingConfig: facilityConfig.pricing,
    promoCode: input.promoCode,
  });

  // Step 3: Detect conflicts
  const conflictResult = detectConflicts({
    facilityId: input.facilityId,
    requestedStart: input.startTime,
    requestedEnd: input.endTime,
    occupiedSlots,
  });

  // Step 4: If conflict, find alternatives
  let suggestedAlternatives: PricedTimeSlot[] | undefined;
  if (conflictResult.hasConflict) {
    suggestedAlternatives = findAlternativeSlots(
      input.startTime,
      input.endTime,
      occupiedSlots,
      facilityConfig
    );
  }

  // Step 5: Build result
  return {
    canBook: !conflictResult.hasConflict,
    priceBreakdown,
    conflict: conflictResult.hasConflict
      ? {
          hasConflict: true,
          conflictType: conflictResult.conflictType,
          message: conflictResult.message,
          conflictingSlots: conflictResult.conflictingSlots.map((slot) => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: slot.status,
            bookingReference: slot.bookingReference,
          })),
        }
      : undefined,
    suggestedAlternatives,
  };
}
