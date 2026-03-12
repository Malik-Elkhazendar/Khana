# Project Scripts (Current)

## Core

- `npm run start`: Start default Nx serve target.
- `npm run build`: Build all configured projects.
- `npm run test`: Run all Nx test targets. Use WSL/Linux shells only.
- `npm run lint`: Run lint targets.
- `npm run check`: Run lint + test + build.

## Architecture / Maintenance

- `npm run audit:structure`
- `npm run audit:comments`
- `npm run audit:entrypoints`
- `npm run audit:entrypoints:check`
- `npm run audit:hotspots`

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

## Swagger / OpenAPI

Swagger is mounted by the API app only.

- Development default: enabled unless `SWAGGER_ENABLED=false`
- Non-development environments: disabled unless `SWAGGER_ENABLED=true`
- UI route: `/api/docs`
- Raw document: `/api/docs-json`
- Exported spec: `apps/api/openapi/khana.v1.json`

Start the API and open Swagger:

```bash
node ./node_modules/nx/bin/nx.js serve api
```

Validate the API app plus Swagger smoke coverage:

```bash
node ./node_modules/typescript/bin/tsc -p apps/api/tsconfig.app.json --noEmit
node ./node_modules/jest/bin/jest.js --config apps/api/jest.config.js --runInBand --runTestsByPath apps/api/src/app/swagger/swagger.bootstrap.spec.ts
node ./node_modules/nx/bin/nx.js test api --runInBand
```

The direct Jest smoke command above is also the CI-safe Swagger check. It
avoids local Nx project-graph noise while still validating docs exposure,
security scheme wiring, and generated operation IDs.

Export and lint the committed OpenAPI artifact:

```bash
npm run openapi:export
npm run openapi:lint
```

`npm run openapi:check` runs both steps in sequence and is the canonical
pre-client-generation validation path.

Generate the Angular OpenAPI transport client from the committed spec:

```bash
npm run openapi:generate
```

Generated client code lives under
`apps/manager-dashboard/src/app/shared/services/api/generated/`. This phase is
additive: handwritten domain API services remain the public frontend adapters.

## WSL-First Validation

Run test and validation commands from a WSL/Linux shell opened inside the repo
path, for example `/home/malek/projects/khana`. Do not run `npm` or `nx`
commands from a Windows shell against `\\wsl$...`; that path currently fails
before Jest starts with Windows launcher/UNC issues.

Prerequisite: install Node.js inside WSL. If `bash -lc 'node --version'`
returns `node: command not found`, install Node in WSL first; Windows `node.exe`
against the UNC workspace is not a supported fallback for unit tests.

Architecture and compile checks:

```bash
node tools/architecture/audit-hotspots.mjs
node tools/architecture/audit-structure.mjs
node ./node_modules/typescript/bin/tsc -p apps/api/tsconfig.app.json --noEmit
node ./node_modules/typescript/bin/tsc -p apps/manager-dashboard/tsconfig.app.json --noEmit
```

Canonical unit test commands:

```bash
node ./node_modules/nx/bin/nx.js test api --runInBand
node ./node_modules/nx/bin/nx.js test manager-dashboard --runInBand
node ./node_modules/nx/bin/nx.js test shared-dtos --runInBand
```

Troubleshooting:

- If `npm` or `nx` fails immediately with `ERR_INVALID_URL`, you are still
  running from a Windows shell against `\\wsl$...`.
- If dashboard Jest fails with an `esbuild` platform mismatch, you are still
  using the Windows runtime instead of the WSL/Linux runtime.

## Full Validation Gate (CI / Pre-release)

Disable Nx daemon and cloud noise before running the full suite:

```bash
export NX_DAEMON=false
export NX_NO_CLOUD=true
```

Run in this order:

```bash
# 1. Frontend E2E
node ./node_modules/nx/bin/nx.js e2e manager-dashboard-e2e -- --project=chromium

# 2. Backend E2E (optional: clear startup race first)
pkill -f "api:serve:development|fork.js .*api:serve:development" || true
node ./node_modules/nx/bin/nx.js e2e api-e2e --output-style=stream

# 3. Frontend unit tests
node ./node_modules/nx/bin/nx.js test manager-dashboard --runInBand

# 4. Backend unit tests
node ./node_modules/nx/bin/nx.js test api --runInBand

# 5. Shared contracts
node ./node_modules/nx/bin/nx.js test shared-dtos --runInBand
```

Note: `api-e2e` may emit an Nx flaky-task notice even on full pass — rerun after the `pkill` step if you see a startup race.
