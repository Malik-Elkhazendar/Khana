# Engineering Architecture

Overview:

- Nx monorepo with frontend and backend apps plus shared libs.
- Backend depends on booking-engine and data-access for domain logic and entities.
- Frontend uses ApiService and BookingStore for API calls and state.

Key boundaries:

- Business logic: libs/booking-engine (server-side usage).
- Data entities: libs/data-access (TypeORM entities).
- Shared DTOs and enums: libs/shared-dtos.
- Shared utilities: libs/shared-utils (filters, validators, formatters).

Evidence:

- apps/manager-dashboard/project.json
- apps/api/project.json
- libs/booking-engine/project.json
- libs/data-access/project.json
- libs/shared-dtos/project.json
- libs/shared-utils/project.json
- apps/api/src/app/bookings/bookings.service.ts (imports @khana/booking-engine, @khana/data-access)
- apps/api/src/app/app.module.ts (TypeOrmModule, postgres)
- apps/manager-dashboard/src/app/state/bookings/booking.store.ts (signalStore)
- apps/manager-dashboard/src/app/shared/services/api.service.ts (ApiService)
