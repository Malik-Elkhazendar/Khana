# Repository Map (Current)

## Monorepo Layout

- `apps/api`: NestJS backend application.
- `apps/api-e2e`: API end-to-end tests (Jest).
- `apps/manager-dashboard`: Angular frontend application.
- `apps/manager-dashboard-e2e`: frontend end-to-end tests (Playwright).
- `libs/booking-engine`: shared booking calculation and conflict logic.
- `libs/data-access`: TypeORM entities and migrations.
- `libs/notifications`: email and WhatsApp notification module, services, and templates.
- `libs/shared-dtos`: shared DTOs, enums, and interfaces.
- `libs/shared-utils`: shared utility helpers.
- `tools/architecture`: structural audit tooling.

## Notable Internal Structure

- `apps/api/src/app/auth/internal`: auth workflows and helper modules behind `auth.service.ts`.
- `apps/api/src/app/analytics/internal`: analytics query workflows behind `analytics.service.ts`.
- `apps/api/src/app/bookings/waitlist/internal`: waitlist workflows and helpers behind `waitlist.service.ts`.
- `apps/manager-dashboard/src/app/shared/services/api`: domain API clients behind `api.service.ts`.
- `apps/manager-dashboard/src/app/state/bookings/internal`: booking store method and model modules behind `booking.store.ts`.

## Root Config

- `package.json`: workspace scripts and dependencies.
- `nx.json`: Nx workspace configuration.
- `tsconfig.base.json`: shared TypeScript config and path aliases.
- `eslint.config.mjs`: workspace ESLint config.
- `jest.config.ts`, `jest.preset.js`: Jest base config.
- `docker-compose.yml`: local Postgres stack.

## Documentation

- Active docs: `docs/current/`, `docs/testing/`, runbooks, and security docs in `docs/`.
- Commenting standard: `docs/current/code-commenting.md`.
- Architecture guidance: `docs/current/repo-architecture.md`.
- Archived docs: `docs/archive/2026-03-cleanup/`.
