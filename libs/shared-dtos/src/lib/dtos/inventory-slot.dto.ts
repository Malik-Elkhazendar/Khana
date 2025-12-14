import { InventoryType } from '../enums/inventory-type.enum';
import { SlotStatus } from '../enums/slot-status.enum';

/**
 * Inventory Slot DTO
 *
 * IMPORTANT: This represents OCCUPIED slots only (BOOKED, BLOCKED, MAINTENANCE).
 * Available slots are calculated in-memory and never stored in the database.
 */
export interface InventorySlotDto {
  /** Unique identifier */
  id: string;

  /** Facility ID this slot belongs to */
  facilityId: string;

  /** Type of inventory (HOURLY, DAILY) */
  type: InventoryType;

  /** Start time of the slot */
  startTime: Date;

  /** End time of the slot */
  endTime: Date;

  /** Status (BOOKED, BLOCKED, MAINTENANCE - never AVAILABLE) */
  status: SlotStatus;

  /** Associated booking ID (if status is BOOKED) */
  bookingId?: string;

  /** Notes (reason for blocking, maintenance details) */
  notes?: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * DTO for creating a blocked/maintenance slot
 * (BOOKED slots are created automatically with bookings)
 */
export interface CreateBlockedSlotDto {
  /** Facility ID */
  facilityId: string;

  /** Start time */
  startTime: Date;

  /** End time */
  endTime: Date;

  /** Status (BLOCKED or MAINTENANCE) */
  status: SlotStatus.BLOCKED | SlotStatus.MAINTENANCE;

  /** Reason for blocking */
  notes?: string;
}

/**
 * DTO for updating a blocked/maintenance slot
 */
export interface UpdateBlockedSlotDto {
  /** New end time */
  endTime?: Date;

  /** Updated notes */
  notes?: string;

  /** Change status */
  status?: SlotStatus.BLOCKED | SlotStatus.MAINTENANCE;
}

/**
 * DTO for bulk blocking (e.g., holiday closure)
 */
export interface BulkBlockSlotsDto {
  /** Facility IDs to block (or all if empty) */
  facilityIds?: string[];

  /** Start date of block period */
  startDate: Date;

  /** End date of block period */
  endDate: Date;

  /** Status for blocked slots */
  status: SlotStatus.BLOCKED | SlotStatus.MAINTENANCE;

  /** Reason for bulk blocking */
  notes: string;
}
