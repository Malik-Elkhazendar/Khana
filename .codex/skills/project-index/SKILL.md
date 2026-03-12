---
name: project-index
description: >
  Navigation guide for the Khana monorepo. Maps features, services, stores, entities,
  DTOs, and documentation to their exact file paths. Load when exploring an unfamiliar
  area, planning a new feature, or tracing where a concept is implemented.
---

# Khana Project Index

Quick navigation for the Khana monorepo. For architecture rules, see
`docs/current/repo-architecture.md` and `CLAUDE.md`.

---

## Documentation

| Topic                                        | File                                |
| -------------------------------------------- | ----------------------------------- |
| Architecture overview, commands, conventions | `CLAUDE.md`                         |
| API modules (current)                        | `docs/current/api-modules.md`       |
| Code commenting standard                     | `docs/current/code-commenting.md`   |
| Frontend modules (current)                   | `docs/current/frontend-modules.md`  |
| OpenAPI artifact                             | `apps/api/openapi/khana.v1.json`    |
| Repo architecture and file placement         | `docs/current/repo-architecture.md` |
| Monorepo layout                              | `docs/current/repository-map.md`    |
| Dev/DB/i18n/CI commands                      | `docs/current/scripts.md`           |
| Design system (Desert Night)                 | `docs/DESIGN_SYSTEM.md`             |
| Security and secrets                         | `docs/security-secrets.md`          |
| Logging setup and event catalog              | `docs/observability.md`             |

---

## Backend (`apps/api/src/app/`)

| Domain                         | Path                                  |
| ------------------------------ | ------------------------------------- |
| Auth (JWT, guards, decorators) | `apps/api/src/app/auth/`              |
| Users                          | `apps/api/src/app/users/`             |
| Bookings + recurrence          | `apps/api/src/app/bookings/`          |
| Waitlist                       | `apps/api/src/app/bookings/waitlist/` |
| Facilities                     | `apps/api/src/app/facilities/`        |
| Analytics                      | `apps/api/src/app/analytics/`         |
| Promo codes                    | `apps/api/src/app/promo-codes/`       |
| Onboarding                     | `apps/api/src/app/onboarding/`        |
| Goals tracking                 | `apps/api/src/app/goals/`             |
| Customers                      | `apps/api/src/app/customers/`         |
| Settings                       | `apps/api/src/app/settings/`          |
| Logging                        | `apps/api/src/app/logging/`           |
| Env config                     | `apps/api/src/app/config/`            |
| TypeORM data source            | `apps/api/src/typeorm/data-source.ts` |
| App module                     | `apps/api/src/app/app.module.ts`      |

### Backend internal workflow folders

| Concern                        | Path                                           |
| ------------------------------ | ---------------------------------------------- |
| Auth workflows and helpers     | `apps/api/src/app/auth/internal/`              |
| Analytics query workflows      | `apps/api/src/app/analytics/internal/`         |
| Waitlist workflows and helpers | `apps/api/src/app/bookings/waitlist/internal/` |

---

## Frontend - Features (`apps/manager-dashboard/src/app/features/`)

| Feature                     | Path                         |
| --------------------------- | ---------------------------- |
| Auth (login/register/reset) | `features/auth/`             |
| Landing (LTR)               | `features/landing/`          |
| Landing (RTL/AR)            | `features/landing-ar/`       |
| Onboarding flow             | `features/onboarding/`       |
| Booking calendar            | `features/booking-calendar/` |
| Booking detail              | `features/booking-detail/`   |
| Booking list                | `features/booking-list/`     |
| Booking preview             | `features/booking-preview/`  |
| Waitlist operations         | `features/waitlist/`         |
| Facilities management       | `features/facilities/`       |
| Team management             | `features/team/`             |
| Settings                    | `features/settings/`         |
| Analytics dashboard         | `features/analytics/`        |
| Promo codes                 | `features/promo-codes/`      |
| Forbidden / 403             | `features/forbidden/`        |

---

## Frontend - State (`apps/manager-dashboard/src/app/state/`)

| Store                   | Path                                     |
| ----------------------- | ---------------------------------------- |
| Bookings                | `state/bookings/booking.store.ts`        |
| Booking store internals | `state/bookings/internal/`               |
| Analytics               | `state/analytics/analytics.store.ts`     |
| Promo codes             | `state/promo-codes/promo-codes.store.ts` |
| Dashboard summary       | `state/dashboard/dashboard.store.ts`     |
| Auth (shared)           | `shared/state/auth.store.ts`             |
| Facility context        | `shared/state/facility-context.store.ts` |
| Layout                  | `shared/state/layout.store.ts`           |

---

## Frontend - Shared Infrastructure

| Concern                  | Path                                    |
| ------------------------ | --------------------------------------- |
| API client facade        | `shared/services/api.service.ts`        |
| Domain API clients       | `shared/services/api/`                  |
| Generated API client     | `shared/services/api/generated/`        |
| Auth/error interceptors  | `shared/interceptors/`                  |
| Route guards             | `shared/guards/`                        |
| i18n / locale formatting | `shared/services/`                      |
| Navigation config        | `shared/navigation/dashboard-nav.ts`    |
| Shared style partials    | `shared/styles/`                        |
| UI primitives            | `shared/components/ui/`                 |
| Navigation components    | `shared/components/navigation/`         |
| Shared dialogs           | `shared/components/dialogs/`            |
| Shared booking widgets   | `shared/components/booking/`            |
| Translation files        | `public/assets/i18n/en.json`, `ar.json` |
| App routes               | `src/app/app.routes.ts`                 |

---

## Libraries

| Library                                        | Alias                   | Source                     |
| ---------------------------------------------- | ----------------------- | -------------------------- |
| Booking engine (conflict, pricing, recurrence) | `@khana/booking-engine` | `libs/booking-engine/src/` |
| TypeORM entities + migrations                  | `@khana/data-access`    | `libs/data-access/src/`    |
| Email/WhatsApp notifications                   | `@khana/notifications`  | `libs/notifications/src/`  |
| Shared DTOs, enums, interfaces                 | `@khana/shared-dtos`    | `libs/shared-dtos/src/`    |
| Utility helpers                                | `@khana/shared-utils`   | `libs/shared-utils/src/`   |

### Key entity files

| Entity             | Path                                                             |
| ------------------ | ---------------------------------------------------------------- |
| Tenant             | `libs/data-access/src/lib/entities/tenant.entity.ts`             |
| Facility           | `libs/data-access/src/lib/entities/facility.entity.ts`           |
| Booking            | `libs/data-access/src/lib/entities/booking.entity.ts`            |
| Waiting list entry | `libs/data-access/src/lib/entities/waiting-list-entry.entity.ts` |
| Customer           | `libs/data-access/src/lib/entities/customer.entity.ts`           |
| Goal milestone     | `libs/data-access/src/lib/entities/goal-milestone.entity.ts`     |
| Migrations         | `libs/data-access/src/lib/migrations/`                           |

### Key DTO files

| Domain         | Path                                                  |
| -------------- | ----------------------------------------------------- |
| Booking API    | `libs/shared-dtos/src/lib/dtos/booking-api.dto.ts`    |
| Analytics      | `libs/shared-dtos/src/lib/dtos/analytics.dto.ts`      |
| Waitlist       | `libs/shared-dtos/src/lib/dtos/waitlist.dto.ts`       |
| Settings       | `libs/shared-dtos/src/lib/dtos/settings.dto.ts`       |
| Goals          | `libs/shared-dtos/src/lib/dtos/goals.dto.ts`          |
| Today snapshot | `libs/shared-dtos/src/lib/dtos/today-snapshot.dto.ts` |
| DTO barrel     | `libs/shared-dtos/src/lib/dtos/index.ts`              |
| Time zone      | `libs/shared-dtos/src/lib/timezone.ts`                |
| Enums          | `libs/shared-dtos/src/lib/enums/`                     |

---

## Root Config Files

| File                     | Purpose                    |
| ------------------------ | -------------------------- |
| `tsconfig.base.json`     | Path aliases (`@khana/*`)  |
| `nx.json`                | Nx workspace config        |
| `docker-compose.yml`     | Local Postgres stack       |
| `jest.config.ts`         | Jest base config           |
| `eslint.config.mjs`      | ESLint workspace config    |
| `.env.development.local` | Local secrets (gitignored) |

---

## Architecture Tooling

| Tool             | Path / Command                                                          |
| ---------------- | ----------------------------------------------------------------------- |
| Structure audit  | `tools/architecture/audit-structure.mjs`, `npm run audit:structure`     |
| Comment audit    | `tools/architecture/audit-comments.mjs`, `npm run audit:comments`       |
| Entrypoint audit | `tools/architecture/audit-entrypoints.mjs`, `npm run audit:entrypoints` |
| Hotspot audit    | `tools/architecture/audit-hotspots.mjs`, `npm run audit:hotspots`       |

---

## Skill System (`.codex/skills/`)

| Skill                 | Type        | Purpose                                     |
| --------------------- | ----------- | ------------------------------------------- |
| `project-guardrails`  | Reference   | Deep implementation rules                   |
| `project-index`       | Reference   | This file - repo navigation                 |
| `repo-architecture`   | Reference   | File placement, layering, structure review  |
| `api-engineer`        | Task        | NestJS endpoint workflows                   |
| `auth-engineer`       | Task        | Auth system implementation                  |
| `database-architect`  | Task        | Entity and migration design                 |
| `feature-strategist`  | Task        | Feature recommendation                      |
| `frontend-engineer`   | Task        | Angular component workflows                 |
| `qa-engineer`         | Task        | Testing workflows                           |
| `design-system`       | Reference   | Desert Night tokens, RTL, a11y, breakpoints |
| `skills-audit`        | Maintenance | Detect dead and stale skills                |
| `update-project-docs` | Maintenance | Sync docs/current/ with code                |
