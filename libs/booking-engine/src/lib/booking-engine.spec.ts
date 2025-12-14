/**
 * Booking Engine Integration Tests
 *
 * These tests verify that all exports work correctly together.
 * Detailed unit tests are in individual spec files.
 */

import {
  detectConflicts,
  calculatePrice,
  previewBooking,
  FacilityConfig,
  OccupiedSlot,
} from './booking-engine';

describe('BookingEngine', () => {
  it('should export all core functions', () => {
    expect(typeof detectConflicts).toBe('function');
    expect(typeof calculatePrice).toBe('function');
    expect(typeof previewBooking).toBe('function');
  });

  it('should handle a complete booking preview workflow', () => {
    // Setup
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const startTime = new Date(tomorrow);
    const endTime = new Date(tomorrow);
    endTime.setHours(11);

    const facilityConfig: FacilityConfig = {
      id: 'padel-court-1',
      name: 'Padel Court 1',
      openTime: '08:00',
      closeTime: '22:00',
      slotDurationMinutes: 60,
      pricing: {
        basePrice: 150,
        currency: 'SAR',
      },
    };

    const occupiedSlots: OccupiedSlot[] = [];

    // Execute
    const result = previewBooking(
      {
        facilityId: 'padel-court-1',
        startTime,
        endTime,
      },
      facilityConfig,
      occupiedSlots
    );

    // Assert
    expect(result.canBook).toBe(true);
    expect(result.priceBreakdown.total).toBe(150);
    expect(result.priceBreakdown.currency).toBe('SAR');
    expect(result.conflict).toBeUndefined();
  });
});
