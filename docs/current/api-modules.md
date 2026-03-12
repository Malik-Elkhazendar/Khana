# API Modules (Current)

Location: `apps/api/src/app`

## Application Modules

- `auth`: login/signup/refresh/password reset/role-aware auth.
- `users`: user management and invitation endpoints.
- `bookings`: booking CRUD, preview, recurrence, status updates.
- `bookings/waitlist`: waitlist join/list/status/notification flows.
- `facilities`: facility management endpoints.
- `analytics`: occupancy, revenue, peak-hours analytics endpoints.
- `customers`: customer profiles, booking-linked customer history, and tagging support.
- `dashboard`: today snapshot and dashboard summary endpoints.
- `goals`: tenant goal settings and nudges for dashboard/settings flows.
- `onboarding`: tenant onboarding completion flow.
- `promo-codes`: promo code CRUD/list and validation related operations.
- `settings`: tenant settings such as timezone management.

## Cross-Cutting

- `logging`: request context, filters, interceptors, logger services.
- `config`: env and secret validation helpers.
- `swagger`: API-local OpenAPI bootstrap and docs exposure under `/api/docs` and `/api/docs-json`.
- `typeorm`: data source bootstrap for migrations/runtime.

## Data Layer Dependencies

- Uses `@khana/data-access` for entities/migrations.
- Uses `@khana/shared-dtos` for contract shapes.
- Uses `@khana/booking-engine` and `@khana/shared-utils` for business logic helpers.
- Uses `@khana/notifications` for outbound notifications.

## Swagger Availability

- Runtime setup lives in `apps/api/src/app/swagger/`.
- Phase 1 exposes internal API docs only.
- Phase 2 adds controller tags and protected-route bearer metadata without moving Swagger into shared libraries.
- Phase 3 adds `@ApiProperty`/`@ApiPropertyOptional` on API-local request DTO classes for the frontend-critical modules.
- Interface-backed response contracts are documented with API-local Swagger model classes inside the owning API modules.
- Phase 4 adds deterministic OpenAPI operation IDs and reusable standard error examples, and keeps the Swagger smoke test in CI.
- Exported OpenAPI artifacts live under `apps/api/openapi/` and are the source input for later client-generation work.
- Angular client generation is configured from the exported spec through `orval.config.cjs`, with output under `apps/manager-dashboard/src/app/shared/services/api/generated/`.
- Shared DTO interfaces in `libs/shared-dtos` stay framework-agnostic and must not import `@nestjs/swagger`.

## Swagger Tag Mapping

- `Auth` -> `apps/api/src/app/auth`
- `Users` -> `apps/api/src/app/users`
- `Bookings` -> `apps/api/src/app/bookings`
- `Waitlist` -> `apps/api/src/app/bookings/waitlist`
- `Facilities` -> `apps/api/src/app/facilities`
- `Analytics` -> `apps/api/src/app/analytics`
- `Dashboard` -> `apps/api/src/app/dashboard`
- `Customers` -> `apps/api/src/app/customers`
- `Promo Codes` -> `apps/api/src/app/promo-codes`
- `Settings` -> `apps/api/src/app/settings`
- `Onboarding` -> `apps/api/src/app/onboarding`
