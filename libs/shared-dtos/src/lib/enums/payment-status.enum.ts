/**
 * Payment status for a booking
 */
export enum PaymentStatus {
  /** No payment received yet */
  PENDING = 'PENDING',

  /** Partial payment received (deposit) */
  PARTIALLY_PAID = 'PARTIALLY_PAID',

  /** Full payment received */
  PAID = 'PAID',

  /** Payment refunded to customer */
  REFUNDED = 'REFUNDED',

  /** Partial refund issued */
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}
