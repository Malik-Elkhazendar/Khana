# Threat Model (Lite)

Assets (observed):

- Booking data and customer contact info.

Threats (proposed):

- Unauthorized access to booking data.
- Tampering with booking status or payment state.
- Leakage of customer contact details.

Mitigations (proposed):

- Enforce auth guards before exposing endpoints.
- Validate input DTOs and reject malformed requests.
- Standardize error responses and avoid leaking internals.

Evidence:

- libs/shared-dtos/src/lib/dtos/booking-api.dto.ts (customer data fields)
- apps/api/src/main.ts (ValidationPipe, HttpExceptionFilter)
