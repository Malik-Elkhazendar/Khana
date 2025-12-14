/**
 * Lifecycle status of a booking
 */
export enum BookingStatus {
  /** Booking created but not yet confirmed (awaiting payment or approval) */
  PENDING = 'PENDING',

  /** Booking is confirmed and active */
  CONFIRMED = 'CONFIRMED',

  /** Booking was cancelled (by customer or owner) */
  CANCELLED = 'CANCELLED',

  /** Booking completed (time has passed) */
  COMPLETED = 'COMPLETED',

  /** Booking is a no-show (customer didn't arrive) */
  NO_SHOW = 'NO_SHOW',
}
