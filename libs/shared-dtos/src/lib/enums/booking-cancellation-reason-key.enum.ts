/**
 * Canonical cancellation reason keys used across dashboard and API.
 */
export enum BookingCancellationReasonKey {
  CUSTOMER_REQUEST = 'customer_request',
  NO_PAYMENT = 'no_payment',
  DOUBLE_BOOKING = 'double_booking',
  FACILITY_UNAVAILABLE = 'facility_unavailable',
  STAFF_ERROR = 'staff_error',
  OTHER = 'other',
}
