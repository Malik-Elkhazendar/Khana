# Project Scripts (Current)

## Core

- `npm run start`: Start default Nx serve target.
- `npm run build`: Build all configured projects.
- `npm run test`: Run all tests.
- `npm run lint`: Run lint targets.
- `npm run check`: Run lint + test + build.

## Affected

- `npm run affected`
- `npm run affected:lint`
- `npm run affected:test`
- `npm run affected:build`

## Formatting

- `npm run format`
- `npm run format:check`

## Database / TypeORM

- `npm run typeorm -- <command>`
- `npm run migration:generate -- libs/data-access/src/lib/migrations/<MigrationName>`
- `npm run migration:create -- libs/data-access/src/lib/migrations/<MigrationName>`
- `npm run migration:run`
- `npm run migration:revert`

## Docker

- `npm run docker:up`
- `npm run docker:down`
- `npm run docker:logs`
- `npm run docker:reset`
- `npm run db:connect`

## Scaffolding

- `npm run gen:lib`
- `npm run gen:nest-app`
- `npm run gen:angular-app`

## i18n

- `npm run i18n:extract`
- `npm run i18n:audit`

## Full Validation Gate (CI / Pre-release)

Disable Nx daemon and cloud noise before running the full suite:

```bash
export NX_DAEMON=false
export NX_NO_CLOUD=true
```

Run in this order:

```bash
# 1. Frontend E2E
npx nx e2e manager-dashboard-e2e -- --project=chromium

# 2. Backend E2E (optional: clear startup race first)
pkill -f "api:serve:development|fork.js .*api:serve:development" || true
npx nx e2e api-e2e --output-style=stream

# 3. Frontend unit tests
npx nx test manager-dashboard --runInBand

# 4. Backend unit tests
npx nx test api --runInBand

# 5. Shared contracts
npx nx test shared-dtos --runInBand
```

Note: `api-e2e` may emit an Nx flaky-task notice even on full pass — rerun after the `pkill` step if you see a startup race.
