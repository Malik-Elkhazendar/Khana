/**
 * Booking Engine Types
 * Framework-agnostic domain types for the booking engine
 */

import {
  ConflictType,
  SlotStatus,
  PriceBreakdown,
  PricingConfig,
  PricedTimeSlot,
} from '@khana/shared-dtos';

/**
 * Represents an occupied slot (from database or mock)
 * Only occupied slots are stored - available is calculated
 */
export interface OccupiedSlot {
  id: string;
  facilityId: string;
  startTime: Date;
  endTime: Date;
  status: SlotStatus;
  bookingReference?: string;
  notes?: string;
}

/**
 * Facility configuration for pricing and scheduling
 */
export interface FacilityConfig {
  id: string;
  name: string;
  /** Opening time in HH:mm format */
  openTime: string;
  /** Closing time in HH:mm format */
  closeTime: string;
  /** Slot duration in minutes (default: 60) */
  slotDurationMinutes: number;
  /** Pricing configuration */
  pricing: PricingConfig;
}

/**
 * Input for booking preview
 */
export interface BookingPreviewInput {
  facilityId: string;
  startTime: Date;
  endTime: Date;
  /** Optional promo code */
  promoCode?: string;
}

/**
 * Result of a booking preview
 */
export interface BookingPreviewResult {
  /** Whether the booking can be made */
  canBook: boolean;
  /** Calculated price breakdown */
  priceBreakdown: PriceBreakdown;
  /** Conflict information (if any) */
  conflict?: {
    hasConflict: boolean;
    conflictType?: ConflictType;
    message: string;
    conflictingSlots: Array<{
      startTime: Date;
      endTime: Date;
      status: SlotStatus;
      bookingReference?: string;
    }>;
  };
  /** Suggested alternative slots (if conflict exists) */
  suggestedAlternatives?: PricedTimeSlot[];
  /** Validation errors (if any) */
  validationErrors?: string[];
}

/**
 * Input for conflict detection
 */
export interface ConflictDetectionInput {
  facilityId: string;
  requestedStart: Date;
  requestedEnd: Date;
  occupiedSlots: OccupiedSlot[];
}

/**
 * Result of conflict detection
 */
export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflictType?: ConflictType;
  message: string;
  conflictingSlots: OccupiedSlot[];
}

/**
 * Input for price calculation
 */
export interface PriceCalculationInput {
  startTime: Date;
  endTime: Date;
  pricingConfig: PricingConfig;
  promoCode?: string;
}
