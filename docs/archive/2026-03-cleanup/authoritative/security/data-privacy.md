# Data Privacy

Observed PII:

- Customer name and phone in booking list items.
- User email and phone in user DTOs.

Proposed handling (no policy found):

- Avoid logging PII in client or server logs.
- Redact PII in error telemetry.
- Limit PII fields in responses to the minimum required.

Evidence:

- libs/shared-dtos/src/lib/dtos/booking-api.dto.ts (BookingListItemDto.customerName/customerPhone)
- libs/shared-dtos/src/lib/dtos/user.dto.ts (UserDto.email/phone)
