# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Khana is a B2B SaaS platform for booking-based businesses (sports facilities, short-term rentals) in the MENA region. It's an **Nx monorepo** with an Angular 20 frontend and NestJS backend, designed for multi-tenancy and RTL (Arabic) support.

## Commands

### Development

```bash
npm run docker:up          # Start local Postgres (required before running API)
npm run start              # nx serve (default project)
nx serve api               # NestJS API on :3000
nx serve manager-dashboard # Angular frontend on :4200
```

### Testing

```bash
npm run test                              # Run all tests (affected)
npm test -- --testPathPattern="<pattern>" # Run specific test file(s)
npm test -- --testPathPattern="auth.service.spec" --watch  # Watch mode
npm run test:all                          # Run every project
```

### Quality

```bash
npm run check          # lint + test + build (affected)
npm run check:all      # lint + test + build (all projects)
npm run lint:fix       # Auto-fix ESLint issues
npm run format         # Prettier format write
npm run affected:test  # Test only changed projects
```

### Database (TypeORM)

```bash
npm run migration:generate -- libs/data-access/src/lib/migrations/<MigrationName>
npm run migration:run
npm run migration:revert
npm run db:connect     # psql shell into local container
npm run docker:reset   # Wipe DB volume and restart
```

### i18n

```bash
npm run i18n:extract   # Sync translation keys from source to en.json/ar.json
npm run i18n:audit     # Find missing/extra keys
```

## Architecture

### Monorepo Layout

| Path                         | Purpose                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `apps/api`                   | NestJS backend (port 3000)                              |
| `apps/manager-dashboard`     | Angular 20 frontend (port 4200)                         |
| `apps/api-e2e`               | API integration tests (Jest/supertest)                  |
| `apps/manager-dashboard-e2e` | Playwright E2E tests                                    |
| `libs/booking-engine`        | Conflict detection, price calculation, recurrence logic |
| `libs/data-access`           | TypeORM entities + migrations                           |
| `libs/shared-dtos`           | Shared DTOs, enums, interfaces (the API contract)       |
| `libs/notifications`         | Email/WhatsApp notification services                    |
| `libs/shared-utils`          | Utility helpers                                         |

**Lib path aliases** (from `tsconfig.base.json`): `@khana/shared-dtos`, `@khana/booking-engine`, `@khana/data-access`, `@khana/shared-utils`, `@khana/notifications`.

### Backend (NestJS)

Feature modules live in `apps/api/src/app/`. Each module follows: `*.module.ts` → `*.controller.ts` → `*.service.ts` → `dto/`.

**Auth pattern** — every protected route uses:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER)
```

`JwtAuthGuard` and `RolesGuard` are exported from `AuthModule`. Use `@TenantId()` and `@CurrentUser()` parameter decorators in controllers.

**Multi-tenancy** — all data is scoped by `tenantId`. In TypeORM query builders: `facility.tenantId = :tenantId` (FK column, no `@JoinColumn` needed for ManyToOne).

**Raw queries return numbers as strings** — always cast with `Number()`.

**Env files** — resolved from workspace root via `resolveEnvFilePaths()` in `apps/api/src/app/config/env-files.ts`. Do **not** use `apps/api/.env`. Use `.env.development.local` (gitignored) for local secrets.

**Synchronize behavior** — `synchronize: true` only in `development`; use explicit migrations for staging/production.

### Frontend (Angular 20)

Feature pages: `apps/manager-dashboard/src/app/features/`
State stores: `apps/manager-dashboard/src/app/state/` (NgRx SignalStore)
Shared infrastructure: `apps/manager-dashboard/src/app/shared/`

**SignalStore pattern:**

```ts
signalStore(
  withState(initialState),
  withComputed(...),
  withMethods((store) => ({
    loadData: rxMethod<void>(pipe(
      tap(() => patchState(store, { loading: true })),
      switchMap(() => service.getData().pipe(
        tap(data => patchState(store, { data, loading: false })),
        catchError(err => { patchState(store, { error: err, loading: false }); return of(null); })
      ))
    ))
  }))
)
```

Use per-section loading flags (not a single `loading`) when sections load independently.

**Layout archetypes** — defined in `layout-shell.component.ts` as `ContentArchetype`. The `'analytics-wide'` archetype maps to `var(--content-max-analytics-wide)`.

**Navigation** — add entries to `shared/navigation/dashboard-nav.ts` (`DashboardNavIcon` type) and add the SVG case to `shared/components/ui/ui-icon.component.html`.

**RTL** — CSS Logical Properties throughout (use `margin-inline-start` not `margin-left`).

**i18n** — translation keys in `public/assets/i18n/en.json` and `ar.json`. Namespaces: `DASHBOARD.NAV.ITEMS.*`, `DASHBOARD.BREADCRUMBS.*`, `META.TITLES.*`, feature-level keys (e.g., `ANALYTICS.*`).

### Shared DTOs

Add DTOs to `libs/shared-dtos/src/lib/dtos/`, export from the barrel `libs/shared-dtos/src/lib/dtos/index.ts`, and ensure `libs/shared-dtos/src/index.ts` re-exports. New enums go in `libs/shared-dtos/src/lib/enums/`.

### Data Entities

Add TypeORM entity files to `libs/data-access/src/lib/entities/`, export from `libs/data-access/src/index.ts`. After adding/changing an entity, generate a migration:

```bash
npm run migration:generate -- libs/data-access/src/lib/migrations/<DescriptiveName>
```

## Code Comments

Use comments to explain non-obvious intent, not to narrate obvious code. Prefer
JSDoc for public workflow entrypoints and short `//` comments for concurrency,
tenant-safety, retry, rollback, or browser-specific behavior. See
`docs/current/code-commenting.md` for the repo standard.

## Key Conventions

- **UserRole enum**: `@khana/shared-dtos` → `libs/shared-dtos/src/lib/enums/user-role.enum.ts`
- **FacilityContextStore** exposes `facilities: Signal<FacilityListItemDto[]>` (not `FacilityManagementItemDto`)
- **Occupancy formula**: `occupied / (hoursPerDay × daysInRange)` — computed in app layer, not DB
- **Period comparison**: previous period = same length ending just before the current `from` date
- **Analytics charts**: custom inline SVG (no third-party chart lib) — `buildLinePath`, `buildAreaPath`, `buildMarkers` in `analytics.component.ts`

## Documentation

Active docs under `docs/current/` and `docs/testing/`. Secret management: `docs/security-secrets.md`. Archived planning docs: `docs/archive/2026-03-cleanup/`.
