/**
 * Status of an inventory slot
 *
 * CRITICAL DESIGN DECISION:
 * There is NO "AVAILABLE" status. Available slots are calculated in-memory
 * by subtracting occupied slots from generated time ranges.
 * This prevents database bloat (92% reduction in rows).
 *
 * Only OCCUPIED states are stored in the database.
 */
export enum SlotStatus {
  /** Slot is booked by a customer - linked to a Booking record */
  BOOKED = 'BOOKED',

  /** Slot is manually blocked by owner - no booking attached */
  BLOCKED = 'BLOCKED',

  /** Slot is under maintenance - facility unavailable */
  MAINTENANCE = 'MAINTENANCE',
}
