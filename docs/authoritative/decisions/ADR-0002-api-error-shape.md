# ADR-0002 API Error Shape

Status: ACCEPTED

Context:

- Backend has a global HttpExceptionFilter that formats error responses.
- Client store maps HTTP status to domain error codes.

Decision:

- API errors return a consistent body: statusCode, message, timestamp, path.
- Client maps HttpErrorResponse status to BookingErrorCode and message.

Consequences:

- Frontend can rely on stable error fields.
- 5xx errors are sanitized before reaching clients.

Evidence:

- libs/shared-utils/src/lib/filters/http-exception.filter.ts (ErrorResponseBody)
- apps/manager-dashboard/src/app/state/bookings/booking.store.ts (resolveBookingError)
