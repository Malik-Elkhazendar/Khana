# API Contract

Scope:
This contract is derived from frontend ApiService usage and backend controller
routes. It is evidence-based and minimal.

Current Observed Contract:

- Base URL (current implementation): http://localhost:3000/api
  NOTE: This is a hardcoded client value, not canonical.
- Global prefix: /api
- Version prefix: /v1
- Endpoints:
  - GET /v1/bookings/facilities -> FacilityListItemDto[]
  - GET /v1/bookings?facilityId=... -> BookingListItemDto[]
  - POST /v1/bookings/preview -> BookingPreviewResponseDto
    Request: BookingPreviewRequestDto
  - POST /v1/bookings -> BookingListItemDto
    Request: CreateBookingRequestDto
  - PATCH /v1/bookings/{id}/status -> BookingListItemDto
    Request: UpdateBookingStatusRequestDto

Target Contract (Proposed):

- Base URL must be configured via environment config (see env-config tag).
- Paths and DTOs remain as observed unless changed by backend contract updates.

Transport Assumptions (Observed / UNKNOWN):

- Content-Type: UNKNOWN (no explicit header configuration observed).
  Evidence: apps/manager-dashboard/src/app/shared/services/api.service.ts
- Auth headers: UNKNOWN (no guards/interceptors observed).
  Evidence: rg "guard|interceptor" in apps (no results)
- Timeouts / retries: UNKNOWN (no retry/timeout operators observed).
  Evidence: apps/manager-dashboard/src/app/shared/services/api.service.ts
- CORS: Observed (backend enables CORS for localhost origins).
  Evidence: apps/api/src/main.ts

Auth:

- UNKNOWN (no guards/interceptors observed).

API<->Client Consistency Gate:

- ApiService endpoints match controller routes.
- DTOs used in ApiService match DTOs exported from shared-dtos.
- Error format follows api/error-format.md.
- Base URL comes from environment config (no hardcoded URLs).

Evidence:

- apps/manager-dashboard/src/app/shared/services/api.service.ts
- apps/api/src/app/bookings/bookings.controller.ts
- apps/api/src/main.ts
- libs/shared-dtos/src/lib/dtos/booking-api.dto.ts
