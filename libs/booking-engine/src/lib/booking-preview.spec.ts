import { SlotStatus, ConflictType } from '@khana/shared-dtos';
import { diffInMinutes } from '@khana/shared-utils';
import {
  previewBooking,
  validateBookingInput,
  findAlternativeSlots,
} from './booking-preview';
import { FacilityConfig, OccupiedSlot, BookingPreviewInput } from './types';

describe('BookingPreview', () => {
  // Future date for testing (to avoid "booking in the past" validation)
  const futureDate = (hour: number, minute = 0): Date => {
    const date = new Date();
    date.setDate(date.getDate() + 1); // Tomorrow
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  const baseFacilityConfig: FacilityConfig = {
    id: 'facility-1',
    name: 'Padel Court 1',
    openTime: '08:00',
    closeTime: '22:00',
    slotDurationMinutes: 60,
    pricing: {
      basePrice: 100,
      currency: 'SAR',
      peakHours: {
        start: 17,
        end: 22,
        multiplier: 1.5,
      },
      weekendMultiplier: 1.3,
    },
  };

  const createOccupiedSlot = (
    startHour: number,
    endHour: number,
    status: SlotStatus = SlotStatus.BOOKED
  ): OccupiedSlot => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startTime = new Date(tomorrow);
    startTime.setHours(startHour, 0, 0, 0);

    const endTime = new Date(tomorrow);
    endTime.setHours(endHour, 0, 0, 0);

    return {
      id: `slot-${startHour}-${endHour}`,
      facilityId: 'facility-1',
      startTime,
      endTime,
      status,
      bookingReference:
        status === SlotStatus.BOOKED ? 'KH-2025-001' : undefined,
    };
  };

  describe('validateBookingInput', () => {
    it('should pass validation for valid input', () => {
      const input: BookingPreviewInput = {
        facilityId: 'facility-1',
        startTime: futureDate(10),
        endTime: futureDate(11),
      };

      const errors = validateBookingInput(input, baseFacilityConfig);
      expect(errors).toHaveLength(0);
    });

    it('should reject when start time is after end time', () => {
      const input: BookingPreviewInput = {
        facilityId: 'facility-1',
        startTime: futureDate(15),
        endTime: futureDate(14),
      };

      const errors = validateBookingInput(input, baseFacilityConfig);
      expect(errors).toContain('Start time must be before end time.');
    });

    it('should reject booking in the past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      pastDate.setHours(10, 0, 0, 0);

      const input: BookingPreviewInput = {
        facilityId: 'facility-1',
        startTime: pastDate,
        endTime: new Date(pastDate.getTime() + 60 * 60 * 1000),
      };

      const errors = validateBookingInput(input, baseFacilityConfig);
      expect(errors.some((e) => e.includes('past'))).toBe(true);
    });

    it('should reject duration shorter than minimum slot', () => {
      const input: BookingPreviewInput = {
        facilityId: 'facility-1',
        startTime: futureDate(10),
        endTime: futureDate(10, 30), // Only 30 minutes
      };

      const errors = validateBookingInput(input, baseFacilityConfig);
      expect(errors.some((e) => e.includes('Minimum booking duration'))).toBe(
        true
      );
    });

    it('should reject duration not multiple of slot duration', () => {
      const input: BookingPreviewInput = {
        facilityId: 'facility-1',
        startTime: futureDate(10),
        endTime: futureDate(11, 30), // 90 minutes, not multiple of 60
      };

      const errors = validateBookingInput(input, baseFacilityConfig);
      expect(errors.some((e) => e.includes('multiple of'))).toBe(true);
    });
  });

  describe('previewBooking', () => {
    it('should return successful preview when slot is available', () => {
      const input: BookingPreviewInput = {
        facilityId: 'facility-1',
        startTime: futureDate(10),
        endTime: futureDate(11),
      };

      const result = previewBooking(input, baseFacilityConfig, []);

      expect(result.canBook).toBe(true);
      expect(result.conflict).toBeUndefined();
      expect(result.validationErrors).toBeUndefined();
      expect(result.priceBreakdown.total).toBeGreaterThan(0);
    });

    it('should calculate correct price for peak hours', () => {
      const input: BookingPreviewInput = {
        facilityId: 'facility-1',
        startTime: futureDate(18), // Peak hour
        endTime: futureDate(19),
      };

      const result = previewBooking(input, baseFacilityConfig, []);

      expect(result.canBook).toBe(true);
      expect(result.priceBreakdown.timeMultiplier).toBe(1.5);
      expect(result.priceBreakdown.total).toBe(150);
    });

    it('should detect conflict and return alternatives', () => {
      const input: BookingPreviewInput = {
        facilityId: 'facility-1',
        startTime: futureDate(14),
        endTime: futureDate(15),
      };

      const occupiedSlots = [createOccupiedSlot(14, 15)];

      const result = previewBooking(input, baseFacilityConfig, occupiedSlots);

      expect(result.canBook).toBe(false);
      expect(result.conflict).toBeDefined();
      expect(result.conflict?.hasConflict).toBe(true);
      expect(result.conflict?.conflictType).toBe(ConflictType.EXACT_OVERLAP);
      expect(result.suggestedAlternatives).toBeDefined();
      expect((result.suggestedAlternatives ?? []).length).toBeGreaterThan(0);
    });

    it('should return validation errors for invalid input', () => {
      const input: BookingPreviewInput = {
        facilityId: 'facility-1',
        startTime: futureDate(15),
        endTime: futureDate(14), // Invalid: end before start
      };

      const result = previewBooking(input, baseFacilityConfig, []);

      expect(result.canBook).toBe(false);
      expect(result.validationErrors).toBeDefined();
      expect((result.validationErrors ?? []).length).toBeGreaterThan(0);
    });

    it('should apply promo code discount', () => {
      const input: BookingPreviewInput = {
        facilityId: 'facility-1',
        startTime: futureDate(10),
        endTime: futureDate(11),
        promoCode: 'SUMMER10',
      };

      const result = previewBooking(input, baseFacilityConfig, []);

      expect(result.canBook).toBe(true);
      expect(result.priceBreakdown.promoCode).toBe('SUMMER10');
      expect(result.priceBreakdown.promoDiscount).toBeGreaterThan(0);
    });

    it('should still calculate price even when conflict exists', () => {
      const input: BookingPreviewInput = {
        facilityId: 'facility-1',
        startTime: futureDate(14),
        endTime: futureDate(15),
      };

      const occupiedSlots = [createOccupiedSlot(14, 15)];

      const result = previewBooking(input, baseFacilityConfig, occupiedSlots);

      expect(result.canBook).toBe(false);
      expect(result.priceBreakdown.total).toBeGreaterThan(0);
    });
  });

  describe('findAlternativeSlots', () => {
    it('should find available slots near requested time', () => {
      const requestedStart = futureDate(14);
      const requestedEnd = futureDate(15);
      const occupiedSlots = [createOccupiedSlot(14, 15)];

      const alternatives = findAlternativeSlots(
        requestedStart,
        requestedEnd,
        occupiedSlots,
        baseFacilityConfig,
        3
      );

      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives.length).toBeLessThanOrEqual(3);

      // Verify none of the alternatives conflict with occupied slots
      for (const alt of alternatives) {
        expect(alt.startTime.getHours()).not.toBe(14);
      }
    });

    it('should include pricing information in alternatives', () => {
      const requestedStart = futureDate(14);
      const requestedEnd = futureDate(15);
      const occupiedSlots = [createOccupiedSlot(14, 15)];

      const alternatives = findAlternativeSlots(
        requestedStart,
        requestedEnd,
        occupiedSlots,
        baseFacilityConfig
      );

      for (const alt of alternatives) {
        expect(alt.price).toBeGreaterThan(0);
        expect(alt.currency).toBe('SAR');
      }
    });

    it('should not suggest slots in the past', () => {
      const requestedStart = futureDate(10);
      const requestedEnd = futureDate(11);
      const occupiedSlots = [createOccupiedSlot(10, 11)];

      const alternatives = findAlternativeSlots(
        requestedStart,
        requestedEnd,
        occupiedSlots,
        baseFacilityConfig
      );

      const now = new Date();
      for (const alt of alternatives) {
        expect(alt.startTime.getTime()).toBeGreaterThan(now.getTime());
      }
    });

    it('should preserve requested duration in alternatives', () => {
      const requestedStart = futureDate(14);
      const requestedEnd = futureDate(16);
      const occupiedSlots = [createOccupiedSlot(14, 16)];

      const alternatives = findAlternativeSlots(
        requestedStart,
        requestedEnd,
        occupiedSlots,
        baseFacilityConfig
      );

      for (const alt of alternatives) {
        expect(diffInMinutes(alt.startTime, alt.endTime)).toBe(120);
      }
    });
  });
});
