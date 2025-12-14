import { SlotStatus } from '@khana/shared-dtos';
import { FacilityConfig, OccupiedSlot } from '@khana/booking-engine';

/**
 * Mock Facilities
 * In production, this would come from the database
 */
export const MOCK_FACILITIES: Record<string, FacilityConfig> = {
  'padel-court-1': {
    id: 'padel-court-1',
    name: 'Padel Court 1',
    openTime: '08:00',
    closeTime: '22:00',
    slotDurationMinutes: 60,
    pricing: {
      basePrice: 150,
      currency: 'SAR',
      peakHours: {
        start: 17,
        end: 22,
        multiplier: 1.5,
      },
      weekendMultiplier: 1.3,
      durationDiscounts: [
        { minDuration: 120, discount: 0.1 },
        { minDuration: 180, discount: 0.15 },
      ],
    },
  },
  'padel-court-2': {
    id: 'padel-court-2',
    name: 'Padel Court 2',
    openTime: '08:00',
    closeTime: '22:00',
    slotDurationMinutes: 60,
    pricing: {
      basePrice: 150,
      currency: 'SAR',
      peakHours: {
        start: 17,
        end: 22,
        multiplier: 1.5,
      },
      weekendMultiplier: 1.3,
    },
  },
  'football-field-1': {
    id: 'football-field-1',
    name: 'Football Field A',
    openTime: '06:00',
    closeTime: '23:00',
    slotDurationMinutes: 60,
    pricing: {
      basePrice: 300,
      currency: 'SAR',
      peakHours: {
        start: 18,
        end: 22,
        multiplier: 1.4,
      },
      weekendMultiplier: 1.2,
    },
  },
};

/**
 * Generate mock occupied slots
 * In production, this would come from the database
 */
export function getMockOccupiedSlots(): OccupiedSlot[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const createSlot = (
    facilityId: string,
    hour: number,
    durationHours: number,
    status: SlotStatus = SlotStatus.BOOKED,
    bookingRef?: string
  ): OccupiedSlot => {
    const start = new Date(tomorrow);
    start.setHours(hour);
    const end = new Date(tomorrow);
    end.setHours(hour + durationHours);

    return {
      id: `slot-${facilityId}-${hour}`,
      facilityId,
      startTime: start,
      endTime: end,
      status,
      bookingReference: status === SlotStatus.BOOKED ? bookingRef || `KH-2025-${String(hour).padStart(3, '0')}` : undefined,
      notes: status === SlotStatus.MAINTENANCE ? 'Scheduled maintenance' : undefined,
    };
  };

  return [
    // Padel Court 1 - some bookings tomorrow
    createSlot('padel-court-1', 10, 1),
    createSlot('padel-court-1', 14, 2), // 2-hour booking
    createSlot('padel-court-1', 18, 1),

    // Padel Court 2 - maintenance in the morning
    createSlot('padel-court-2', 8, 2, SlotStatus.MAINTENANCE),
    createSlot('padel-court-2', 16, 1),

    // Football Field - evening games
    createSlot('football-field-1', 19, 2),
    createSlot('football-field-1', 21, 2),
  ];
}

/**
 * Get facility by ID
 */
export function getFacilityById(facilityId: string): FacilityConfig | undefined {
  return MOCK_FACILITIES[facilityId];
}

/**
 * Get all facilities
 */
export function getAllFacilities(): FacilityConfig[] {
  return Object.values(MOCK_FACILITIES);
}
