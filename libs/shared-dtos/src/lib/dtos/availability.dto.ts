import { InventoryType } from '../enums/inventory-type.enum';
import { SlotStatus } from '../enums/slot-status.enum';
import {
  AvailableSlot,
  PricedTimeSlot,
} from '../interfaces/time-slot.interface';

/**
 * Request DTO for availability query
 */
export interface AvailabilityQueryDto {
  /** Facility ID */
  facilityId: string;

  /** Start date of query range */
  startDate: Date;

  /** End date of query range */
  endDate: Date;

  /** Inventory type (defaults to facility's type) */
  inventoryType?: InventoryType;

  /** Minimum duration in minutes (filter shorter slots) */
  minDuration?: number;

  /** Include pricing in response */
  includePricing?: boolean;
}

/**
 * Response DTO for availability query
 */
export interface AvailabilityResponseDto {
  /** Facility ID */
  facilityId: string;

  /** Facility name */
  facilityName: string;

  /** Query date range */
  dateRange: {
    start: Date;
    end: Date;
  };

  /** Inventory type used */
  inventoryType: InventoryType;

  /** Total possible slots in range */
  totalSlots: number;

  /** Number of available slots */
  availableCount: number;

  /** Number of occupied slots */
  occupiedCount: number;

  /** Occupancy rate (0-100) */
  occupancyRate: number;

  /** Available slots with pricing */
  availableSlots: AvailableSlot[];

  /** Occupied slots (for calendar display) */
  occupiedSlots: OccupiedSlotDto[];
}

/**
 * Occupied slot info for calendar display
 */
export interface OccupiedSlotDto {
  /** Start time */
  startTime: Date;

  /** End time */
  endTime: Date;

  /** Status */
  status: SlotStatus;

  /** Display label (e.g., "Booked", "Maintenance") */
  label: string;

  /** Notes (if any) */
  notes?: string;
}

/**
 * Daily availability summary (for month view)
 */
export interface DailyAvailabilitySummaryDto {
  /** Date */
  date: Date;

  /** Total slots for the day */
  totalSlots: number;

  /** Available slots */
  availableSlots: number;

  /** Occupancy rate (0-100) */
  occupancyRate: number;

  /** Whether fully booked */
  isFullyBooked: boolean;

  /** Lowest price available */
  lowestPrice?: number;

  /** Currency */
  currency?: string;
}

/**
 * Monthly availability overview
 */
export interface MonthlyAvailabilityDto {
  /** Facility ID */
  facilityId: string;

  /** Month (1-12) */
  month: number;

  /** Year */
  year: number;

  /** Daily summaries */
  days: DailyAvailabilitySummaryDto[];

  /** Overall monthly occupancy */
  monthlyOccupancyRate: number;
}

/**
 * Multi-facility availability (for marketplace view)
 */
export interface MultiFacilityAvailabilityDto {
  /** Query date */
  date: Date;

  /** Facilities with availability */
  facilities: {
    facilityId: string;
    facilityName: string;
    tenantName: string;
    availableSlots: number;
    lowestPrice: number;
    currency: string;
    nextAvailableSlot?: PricedTimeSlot;
  }[];
}
