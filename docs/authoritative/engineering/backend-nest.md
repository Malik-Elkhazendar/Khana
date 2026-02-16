# Backend (NestJS) Patterns

Runtime:

- NestJS app with a global /api prefix.
- Global ValidationPipe with whitelist and transform.
- Global HttpExceptionFilter to standardize errors.

Booking API:

- Controller routes under /api/v1/bookings.
- Service delegates domain logic to booking-engine.
- Entities come from data-access.

Evidence:

- apps/api/src/main.ts (global prefix, ValidationPipe, HttpExceptionFilter)
- apps/api/src/app/bookings/bookings.controller.ts (routes)
- apps/api/src/app/bookings/bookings.service.ts (booking-engine usage)
- apps/api/src/app/app.module.ts (TypeOrmModule with postgres)
