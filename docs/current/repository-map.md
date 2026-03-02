# Repository Map (Current)

## Monorepo Layout

- `apps/api`: NestJS backend application.
- `apps/api-e2e`: API end-to-end tests (Jest).
- `apps/manager-dashboard`: Angular frontend application.
- `apps/manager-dashboard-e2e`: Frontend end-to-end tests (Playwright).
- `libs/booking-engine`: Shared booking calculation/conflict logic.
- `libs/data-access`: TypeORM entities and migrations.
- `libs/notifications`: Email/WhatsApp notification module/services/templates.
- `libs/shared-dtos`: Shared DTOs, enums, interfaces.
- `libs/shared-utils`: Shared utility helpers.
- `tools/i18n`: i18n audit tooling.

## Root Config

- `package.json`: workspace scripts and dependencies.
- `nx.json`: Nx workspace configuration.
- `tsconfig.base.json`: shared TypeScript config and path aliases.
- `eslint.config.mjs`: workspace ESLint config.
- `jest.config.ts`, `jest.preset.js`: Jest base config.
- `docker-compose.yml`: local postgres stack.

## Documentation

- Active docs: `docs/current/`, `docs/testing/`, runbooks and security docs in `docs/`.
- Archived docs (retired planning/agent-era): `docs/archive/2026-03-cleanup/`.
