import { ConflictType } from '../enums/conflict-type.enum';
import { SlotStatus } from '../enums/slot-status.enum';
import { PricedTimeSlot } from './time-slot.interface';

/**
 * Details of a single conflict
 */
export interface ConflictDetail {
  /** ID of the conflicting inventory slot */
  slotId: string;

  /** Start time of the conflicting slot */
  startTime: Date;

  /** End time of the conflicting slot */
  endTime: Date;

  /** Status of the conflicting slot */
  status: SlotStatus;

  /** Notes/reason for the blocking (if BLOCKED or MAINTENANCE) */
  notes?: string;

  /** Booking reference if status is BOOKED */
  bookingReference?: string;
}

/**
 * Result of conflict detection
 * Returned by ConflictDetector.detectConflicts()
 */
export interface ConflictResult {
  /** Whether any conflicts were found */
  hasConflict: boolean;

  /** Type of conflict (if any) */
  conflictType?: ConflictType;

  /** List of conflicts found */
  conflicts?: ConflictDetail[];

  /** Suggested alternative time slots */
  suggestedAlternatives?: PricedTimeSlot[];

  /** Human-readable message */
  message: string;
}

/**
 * Availability map for a facility
 * Returned by AvailabilityCalculator.calculateAvailability()
 */
export interface AvailabilityMap {
  /** Facility ID */
  facilityId: string;

  /** Facility name */
  facilityName: string;

  /** Query date range */
  dateRange: {
    start: Date;
    end: Date;
  };

  /** Total possible slots in the range */
  totalSlots: number;

  /** Available slots with pricing */
  availableSlots: PricedTimeSlot[];

  /** Occupied slots (for display purposes) */
  occupiedSlots: {
    startTime: Date;
    endTime: Date;
    status: SlotStatus;
    notes?: string;
  }[];

  /** Occupancy rate as percentage (0-100) */
  occupancyRate: number;
}
