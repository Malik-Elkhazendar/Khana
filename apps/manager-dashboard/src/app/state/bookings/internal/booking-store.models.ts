import { HttpErrorResponse } from '@angular/common/http';
import { WritableStateSource } from '@ngrx/signals';
import {
  BookingCancellationScope,
  BookingListItemDto,
  BookingStatus,
  PaymentStatus,
} from '@khana/shared-dtos';

export type BookingState = {
  bookings: BookingListItemDto[];
  bookingDetailsById: Record<string, BookingListItemDto>;
  loading: boolean;
  error: Error | null;
  errorCode: string | null;
  filter: { facilityId: string | null };
  actionLoadingById: Record<string, boolean>;
  actionErrorsById: Record<string, string | null>;
  detailLoadingById: Record<string, boolean>;
  detailErrorsById: Record<string, string | null>;
};

export const initialBookingState: BookingState = {
  bookings: [],
  bookingDetailsById: {},
  loading: false,
  error: null,
  errorCode: null,
  filter: { facilityId: null },
  actionLoadingById: {},
  actionErrorsById: {},
  detailLoadingById: {},
  detailErrorsById: {},
};

export type BookingErrorCode =
  | 'NETWORK'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export const BOOKING_ERROR_MESSAGES: Record<BookingErrorCode, string> = {
  NETWORK: 'Network error. Check your connection and try again.',
  VALIDATION: 'Validation failed. Please check the inputs.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied. Please contact an administrator.',
  NOT_FOUND: 'Booking not found. Refresh and try again.',
  CONFLICT: 'Conflict detected. Please refresh and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNKNOWN: 'Unexpected error. Please try again.',
};

export type BookingStoreSlice = {
  bookings(): BookingListItemDto[];
  bookingDetailsById(): Record<string, BookingListItemDto>;
  loading(): boolean;
  error(): Error | null;
  errorCode(): string | null;
  filter(): { facilityId: string | null };
  actionLoadingById(): Record<string, boolean>;
  actionErrorsById(): Record<string, string | null>;
  detailLoadingById(): Record<string, boolean>;
  detailErrorsById(): Record<string, string | null>;
};

export type BookingStoreStateSource = WritableStateSource<BookingState> &
  BookingStoreSlice;

export type BookingStatusUpdates = {
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
  cancellationReason?: string | null;
  cancellationScope?: BookingCancellationScope;
};

export const resolveBookingError = (
  err: unknown
): { code: BookingErrorCode; message: string } => {
  if (err instanceof HttpErrorResponse) {
    const statusMap: Record<number, BookingErrorCode> = {
      0: 'NETWORK',
      400: 'VALIDATION',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      500: 'SERVER_ERROR',
    };
    const fallbackCode = statusMap[err.status] ?? 'UNKNOWN';
    const serverMessage =
      typeof err.error?.message === 'string' ? err.error.message : undefined;
    const message = serverMessage ?? BOOKING_ERROR_MESSAGES[fallbackCode];
    return { code: fallbackCode, message };
  }

  return { code: 'UNKNOWN', message: BOOKING_ERROR_MESSAGES.UNKNOWN };
};

export const toBookingError = (message: string): Error => new Error(message);

export const resolveRequestId = (err: unknown): string | undefined => {
  if (!(err instanceof HttpErrorResponse)) return undefined;
  return err.headers?.get('x-request-id') ?? undefined;
};

export const isAuthSensitiveError = (err: unknown): boolean => {
  return err instanceof HttpErrorResponse && [401, 403].includes(err.status);
};

export const upsertBookingDetail = (
  details: Record<string, BookingListItemDto>,
  booking: BookingListItemDto
): Record<string, BookingListItemDto> => ({
  ...details,
  [booking.id]: booking,
});

export const mergeBookingsIntoDetails = (
  details: Record<string, BookingListItemDto>,
  bookings: BookingListItemDto[]
): Record<string, BookingListItemDto> => {
  let next = details;
  for (const booking of bookings) {
    next = upsertBookingDetail(next, booking);
  }
  return next;
};
