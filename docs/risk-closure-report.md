# Risk Closure Report

Date: February 23, 2026
Status: Closed
Phase: Phase 4 (Closeout)

## Scope

This report closes the 9 high/medium findings identified in the monorepo risk audit across:

- `apps/api`
- `apps/manager-dashboard`
- `libs/shared-dtos` and related shared/runtime paths
- Unit and E2E validation coverage

## Finding Closure Summary

1. Public email endpoint exposure: Fixed

- `POST /api/v1/test-email` is protected with auth + role checks.
- Evidence paths: `apps/api/src/app/app.controller.ts`, `apps/api-e2e/src/api/api.spec.ts`

2. Booking race condition: Fixed

- Booking creation is guarded by transaction + facility row lock to prevent double-booking races.
- Evidence paths: `apps/api/src/app/bookings/bookings.service.ts`, `apps/api-e2e/src/api/api.spec.ts`

3. Auth interceptor deadlock: Fixed

- Frontend refresh flow uses a single in-flight refresh stream; queued requests resolve/fail correctly.
- Evidence paths: `apps/manager-dashboard/src/app/shared/interceptors/auth.interceptor.ts`, `apps/manager-dashboard/src/app/shared/interceptors/auth.interceptor.spec.ts`

4. Broken api-e2e configuration: Fixed

- E2E setup and global setup wiring restored for deterministic API test boot.
- Evidence paths: `apps/api-e2e/src/support/global-setup.ts`, `apps/api-e2e/project.json`, `apps/api-e2e/jest.config.cjs`

5. Frontend environment inconsistencies: Fixed

- API calls are unified around `environment.apiBaseUrl` usage.
- Evidence paths: `apps/manager-dashboard/src/app/shared/services/auth.service.ts`, `apps/manager-dashboard/src/app/shared/services/api.service.ts`, `apps/manager-dashboard/src/environments/environment.ts`, `apps/manager-dashboard/src/environments/environment.staging.ts`, `apps/manager-dashboard/src/environments/environment.prod.ts`

6. Tenant state leakage: Fixed

- Tenant resolution/storage/clearing behavior is consistent across auth lifecycle.
- Evidence path: `apps/manager-dashboard/src/app/shared/services/auth.service.ts`

7. Missing login/register throttling: Fixed

- Throttle policies applied and validated for auth endpoints.
- Evidence paths: `apps/api/src/app/auth/auth.controller.ts`, `apps/api-e2e/src/api/api.spec.ts`

8. Versioning inconsistencies: Fixed

- Versioned booking routes aligned with Nest URI versioning conventions.
- Evidence paths: `apps/api/src/app/bookings/bookings.controller.ts`, `apps/api/src/main.ts`

9. Shared DTO surface drift: Fixed

- Shared DTOs aligned to currently-used API request/response contracts.
- Evidence paths: `libs/shared-dtos/src/lib/dtos/booking-api.dto.ts`, `libs/shared-dtos/src/lib/dtos/user.dto.ts`

## Validation Evidence (Latest Gate Run)

1. `NX_DAEMON=false NX_NO_CLOUD=true npx nx e2e manager-dashboard-e2e -- --project=chromium`

- Result: PASS (61/61)

2. `NX_DAEMON=false NX_NO_CLOUD=true npx nx e2e api-e2e --output-style=stream`

- Result: PASS (19/19)

3. `NX_DAEMON=false NX_NO_CLOUD=true npx nx test manager-dashboard --runInBand`

- Result: PASS (629/629)

4. `NX_DAEMON=false NX_NO_CLOUD=true npx nx test api --runInBand`

- Result: PASS (52/52)

5. `NX_DAEMON=false NX_NO_CLOUD=true npx nx test shared-dtos --runInBand`

- Result: PASS (13/13)

## Residual Non-Blocking Note

- Nx may emit `Nx detected a flaky task` for `api-e2e` in some runs despite a full pass.
- This is tracked as non-blocking for release because all target tests passed.
- Optional pre-step to reduce startup race noise:
  - `pkill -f "api:serve:development|fork.js .*api:serve:development" || true`

## Release Recommendation

Release is approved based on implemented remediations and full validation pass evidence.
