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
