# Logging and Observability Guide

## Scope

This project uses structured logging on:

- Backend API (`apps/api`): centralized request-correlated logging with redaction.
- Frontend dashboard (`apps/manager-dashboard`): centralized client logger abstraction for runtime logs.

## Principles

1. Keep logs structured and machine-readable.
2. Preserve request/session correlation fields.
3. Never log raw secrets or credentials.
4. Keep API response schemas unchanged when adding logging.

## Backend Logging

Core implementation:

- `apps/api/src/app/logging/app-logger.service.ts`
- `apps/api/src/app/logging/request-context.middleware.ts`
- `apps/api/src/app/logging/http-logging.interceptor.ts`
- `apps/api/src/app/logging/http-exception.filter.ts`

### Correlation

- Accepts incoming `x-request-id` when valid.
- Generates one when missing/invalid.
- Echoes `x-request-id` in responses.
- Parses optional `traceparent` and stores `traceId`, `spanId`, `traceFlags`.

### Output Modes

- `LOG_FORMAT=json|pretty`
- `LOG_COLOR=auto|on|off`
- `LOG_NEST_INFO=on|off|auto`

### Production defaults

- JSON output for machine ingestion.
- Severity split to stdout/stderr.

## Frontend Logging

Core implementation:

- `apps/manager-dashboard/src/app/shared/services/logger.service.ts`
- `apps/manager-dashboard/src/app/shared/services/error-reporter.service.ts`
- `apps/manager-dashboard/src/app/shared/errors/global-error-handler.ts`

### Behavior

- Runtime code logs through `LoggerService` only.
- `environment.logging` controls level and console output.
- Sensitive fields are redacted/masked before emission.

## Redaction Policy

### Always redact

- `password`, `newPassword`, `oldPassword`, `currentPassword`
- `token`, `refreshToken`, `accessToken`, `authorization`, `cookie`
- `resetToken`, `secret`, `apiKey`

### Mask

- `email`
- `phone`

## Validation Commands

```bash
NX_DAEMON=false NX_NO_CLOUD=true npx nx lint api --skip-nx-cache
NX_DAEMON=false NX_NO_CLOUD=true npx nx lint manager-dashboard --skip-nx-cache
NX_DAEMON=false NX_NO_CLOUD=true npx nx test api --skip-nx-cache --runInBand
NX_DAEMON=false NX_NO_CLOUD=true npx nx test manager-dashboard --skip-nx-cache --runInBand
NX_DAEMON=false NX_NO_CLOUD=true npx nx e2e api-e2e --skip-nx-cache --output-style=stream
NX_DAEMON=false NX_NO_CLOUD=true npx nx e2e manager-dashboard-e2e --skip-nx-cache -- --project=chromium
```
