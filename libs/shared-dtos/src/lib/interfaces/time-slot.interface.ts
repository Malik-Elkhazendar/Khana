/**
 * Basic time slot representation
 * Used throughout the system for availability and booking calculations
 */
export interface TimeSlot {
  /** Start time of the slot */
  startTime: Date;

  /** End time of the slot */
  endTime: Date;
}

/**
 * Time slot with pricing information
 * Returned by availability calculator
 */
export interface PricedTimeSlot extends TimeSlot {
  /** Calculated price for this slot */
  price: number;

  /** Currency code (default: SAR) */
  currency: string;
}

/**
 * Time slot with availability metadata
 */
export interface AvailableSlot extends PricedTimeSlot {
  /** Unique identifier for this slot (generated, not from DB) */
  slotId: string;

  /** Whether this is a peak time slot */
  isPeakTime: boolean;

  /** Whether this is a weekend slot (Thu-Fri in MENA) */
  isWeekend: boolean;
}
