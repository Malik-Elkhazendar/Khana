/**
 * Additional metadata for a booking
 * Stored as JSONB for flexibility
 */
export interface BookingMetadata {
  /** Special requests from the customer */
  specialRequests?: string;

  /** Internal notes (visible to staff only) */
  internalNotes?: string;

  /** Number of participants/guests */
  guestCount?: number;

  /** Equipment rental requests */
  equipmentRequests?: {
    /** Equipment name */
    name: string;
    /** Quantity */
    quantity: number;
    /** Additional cost */
    price: number;
  }[];

  /** Source of the booking */
  source?:
    | 'DASHBOARD'
    | 'WEBSITE'
    | 'MOBILE_APP'
    | 'PHONE'
    | 'WALK_IN'
    | 'WHATSAPP';

  /** Referral code used */
  referralCode?: string;

  /** Whether this is a recurring booking */
  isRecurring?: boolean;

  /** Recurring booking pattern */
  recurringPattern?: {
    /** Frequency: daily, weekly, monthly */
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    /** Interval (e.g., every 2 weeks) */
    interval: number;
    /** Days of week for weekly recurrence (0=Sunday, 6=Saturday) */
    daysOfWeek?: number[];
    /** End date for recurrence */
    endDate?: Date;
    /** Maximum occurrences */
    maxOccurrences?: number;
  };

  /** Parent booking ID for recurring bookings */
  parentBookingId?: string;

  /** Cancellation reason (if cancelled) */
  cancellationReason?: string;

  /** Cancelled by user ID */
  cancelledBy?: string;

  /** Cancellation timestamp */
  cancelledAt?: Date;

  /** Check-in timestamp */
  checkedInAt?: Date;

  /** Check-out timestamp */
  checkedOutAt?: Date;

  /** Custom fields for flexibility */
  customFields?: Record<string, unknown>;
}
