import {
  SimpleOperatingHours,
  WeeklyOperatingHours,
} from './operating-hours.interface';
import { PricingConfig } from './price-breakdown.interface';

/**
 * Metadata for a facility
 * Stored as JSONB in the database for flexibility
 */
export interface FacilityMetadata {
  /** Maximum capacity (players, guests, etc.) */
  capacity?: number;

  /** Slot duration in minutes (for HOURLY inventory) */
  slotDuration?: number;

  /** Minimum booking duration in minutes */
  minBookingDuration?: number;

  /** Maximum booking duration in minutes */
  maxBookingDuration?: number;

  /** Minimum stay in days (for DAILY inventory - chalets) */
  minimumStay?: number;

  /** Maximum stay in days */
  maximumStay?: number;

  /** Operating hours - simple or weekly */
  operatingHours: SimpleOperatingHours | WeeklyOperatingHours;

  /** Pricing configuration */
  pricing: PricingConfig;

  /** List of amenities */
  amenities?: string[];

  /** Description of the facility */
  description?: string;

  /** Image URLs */
  images?: string[];

  /** Check-in time for daily rentals (HH:mm) */
  checkInTime?: string;

  /** Check-out time for daily rentals (HH:mm) */
  checkOutTime?: string;

  /** Buffer time between bookings in minutes */
  bufferTime?: number;

  /** Whether advance booking is required */
  advanceBookingRequired?: boolean;

  /** Minimum hours in advance to book */
  minAdvanceHours?: number;

  /** Maximum days in advance to book */
  maxAdvanceDays?: number;

  /** Cancellation policy */
  cancellationPolicy?: {
    /** Hours before start time for free cancellation */
    freeUntilHours: number;
    /** Cancellation fee percentage after free period */
    feePercentage: number;
  };

  /** Custom fields for flexibility */
  customFields?: Record<string, unknown>;
}
