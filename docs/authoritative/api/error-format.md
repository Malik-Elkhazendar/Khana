# API Error Format

Observed format:

- statusCode: number
- message: string (5xx sanitized)
- timestamp: ISO string
- path: request path

Client mapping:

- BookingStore maps HttpErrorResponse.status to domain error codes and messages.

Client dependencies (observed):

- HTTP status code: used to map BookingErrorCode.
  Evidence: apps/manager-dashboard/src/app/state/bookings/booking.store.ts (resolveBookingError)
- Error body message: uses err.error.message if present.
  Evidence: apps/manager-dashboard/src/app/state/bookings/booking.store.ts (resolveBookingError)
- statusCode field: UNKNOWN (not referenced by client logic).

Evidence:

- libs/shared-utils/src/lib/filters/http-exception.filter.ts (ErrorResponseBody)
- apps/manager-dashboard/src/app/state/bookings/booking.store.ts (resolveBookingError)
