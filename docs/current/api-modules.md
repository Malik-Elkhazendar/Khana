# API Modules (Current)

Location: `apps/api/src/app`

## Application Modules

- `auth`: login/signup/refresh/password reset/role-aware auth.
- `users`: user management and invitation endpoints.
- `bookings`: booking CRUD, preview, recurrence, status updates.
- `bookings/waitlist`: waitlist join/list/status/notification flows.
- `facilities`: facility management endpoints.
- `analytics`: occupancy, revenue, peak-hours analytics endpoints.
- `onboarding`: tenant onboarding completion flow.
- `promo-codes`: promo code CRUD/list and validation related operations.

## Cross-Cutting

- `logging`: request context, filters, interceptors, logger services.
- `config`: env and secret validation helpers.
- `typeorm`: data source bootstrap for migrations/runtime.

## Data Layer Dependencies

- Uses `@khana/data-access` for entities/migrations.
- Uses `@khana/shared-dtos` for contract shapes.
- Uses `@khana/booking-engine` and `@khana/shared-utils` for business logic helpers.
- Uses `@khana/notifications` for outbound notifications.
