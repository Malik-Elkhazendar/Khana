import {
  BookingCancellationReasonKey,
  serializeCancellationReason,
} from '@khana/shared-dtos';

export const BOOKINGS_ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
export const BOOKINGS_RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';
export const BOOKINGS_INACTIVE_FACILITY_MESSAGE =
  'This facility is currently inactive and cannot be booked.';

export const PENDING_HOLD_MINUTES = 15;
export const HOLD_EXPIRED_CANCELLATION_NOTE = 'Hold expired automatically';
export const HOLD_EXPIRED_CANCELLATION_REASON = serializeCancellationReason(
  BookingCancellationReasonKey.OTHER,
  HOLD_EXPIRED_CANCELLATION_NOTE
);
