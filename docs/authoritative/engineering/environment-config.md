# Environment Configuration

## Goal

Make runtime configuration deterministic in development and explicit across environments.

## API Env Precedence

`apps/api/src/app/config/env-files.ts` defines env file order.

Priority (highest -> lowest):

1. `.env.<env>.local`
2. `.env.local` (except `test`)
3. `.env.<env>` (supports aliases like `production` + `prod`)
4. `.env`

Examples:

- `NODE_ENV=development`: `.env.development.local` -> `.env.local` -> `.env.development` -> `.env`
- `NODE_ENV=staging`: `.env.staging.local` -> `.env.local` -> `.env.staging` -> `.env`
- `NODE_ENV=production`: `.env.production.local` -> `.env.local` -> `.env.production` -> `.env.prod` -> `.env`

## Runtime Behavior

`apps/api/src/app/app.module.ts` now:

- Loads env files via `resolveEnvFilePaths()`
- Enables `expandVariables` and `cache`
- Uses deterministic file-driven config in `development` and `test`:
  - `skipProcessEnv: true`
  - `validatePredefined: false`
- Uses standard environment-variable behavior in non-dev environments.

## Standardized Usage

Runtime modules should use `ConfigService`, not direct `process.env`.

Implemented in:

- `apps/api/src/main.ts` (API port + prefix)
- `apps/api/src/app/app.module.ts` (database config)
- `apps/api/src/app/auth/auth.service.ts` (token TTL + HMAC secret)
- `apps/api/src/app/auth/services/cleanup.service.ts` (retention days)
- `libs/notifications/src/lib/notification.module.ts` (mail transport)

## E2E Alignment

`apps/api-e2e/src/support/global-setup.ts` now loads env files using the same resolver (`resolveEnvFilePaths`) so tests and runtime follow identical precedence.

## Best Practices

1. Keep real secrets in `*.local` files (gitignored).
2. Keep `.env`, `.env.development`, `.env.staging`, `.env.prod` as non-secret templates/defaults.
3. Prefer `ConfigService` for all app runtime reads.
4. Avoid `import 'dotenv/config'` in app runtime entrypoints when ConfigModule already handles env loading.
