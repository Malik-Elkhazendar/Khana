# Observability Guide

Covers logging setup, log event catalog, and production incident triage for the Khana platform.

---

## 1. Architecture

### Backend

Core implementation files:

- `apps/api/src/app/logging/app-logger.service.ts` — centralized logger
- `apps/api/src/app/logging/request-context.middleware.ts` — request ID injection
- `apps/api/src/app/logging/http-logging.interceptor.ts` — request/response logging
- `apps/api/src/app/logging/http-exception.filter.ts` — exception logging
- `apps/api/src/app/logging/redaction.util.ts` — field masking
- `apps/api/src/app/logging/logging.constants.ts` — canonical event name constants

**Correlation:** Every request gets an `x-request-id` (accepted from client or generated). Echoed in responses. `traceparent` header is parsed for `traceId`, `spanId`, `traceFlags`.

**Output modes:**

- `LOG_FORMAT=json|pretty`
- `LOG_COLOR=auto|on|off`
- `LOG_NEST_INFO=on|off|auto`
- Production default: JSON to stdout/stderr split by severity.

### Frontend

Core implementation files:

- `apps/manager-dashboard/src/app/shared/services/logger.service.ts`
- `apps/manager-dashboard/src/app/shared/services/error-reporter.service.ts`
- `apps/manager-dashboard/src/app/shared/errors/global-error-handler.ts`

**Behavior:** All runtime code logs through `LoggerService` only (never `console.*` directly — enforced by ESLint `no-console` rule). A `clientSessionId` is generated per page load and attached to every log. The `requestId` from backend responses is propagated to error logs.

---

## 2. Redaction Policy

### Always redact (never logged)

`password`, `newPassword`, `oldPassword`, `currentPassword`, `token`, `refreshToken`, `accessToken`, `authorization`, `cookie`, `resetToken`, `secret`, `apiKey`

### Mask (logged in obfuscated form)

`email`, `phone`

---

## 3. Security Headers (API)

Set via Helmet in `apps/api/src/main.ts`:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Powered-By`: disabled
- `Content-Security-Policy`: disabled (JSON-only API)
- `Strict-Transport-Security`: production + secure requests only

`TRUST_PROXY` env var controls secure-request detection behind a load balancer.

---

## 4. Booking RBAC (Role Visibility)

- `OWNER` / `MANAGER`: full booking visibility, status/payment actions.
- `STAFF`: own bookings only; can cancel own bookings only.
- `VIEWER`: read-only; cannot create or update bookings.

Frontend: `/dashboard/new` restricted to OWNER / MANAGER / STAFF. Viewer action controls are hidden.

---

## 5. Log Event Catalog

All event name constants are defined in `apps/api/src/app/logging/logging.constants.ts`.

### Backend

**HTTP**

- `http.request.completed`
- `http.request.failed`

**Auth**

- `auth.register.success`
- `auth.login.success` / `auth.login.failed`
- `auth.refresh.rotated` / `auth.refresh.failed` / `auth.refresh.reuse_detected`
- `auth.logout` / `auth.logout.device` / `auth.logout.all_devices`
- `auth.password.changed` / `auth.password.reset_requested` / `auth.password.reset_completed`
- `auth.security.escalation`

**Booking**

- `booking.create.success` / `booking.create.conflict`
- `booking.status.updated` / `booking.status.invalid_transition`

**Email**

- `email.sent` / `email.failed`

**Metrics**

- `metrics.refresh_token.reuse_detected`
- `metrics.refresh_token.failed`
- `metrics.refresh_token.rotation_latency`
- `metrics.refresh_token.active_sessions`
- `metrics.refresh_token.security_escalation`

**System**

- `system.startup`
- `system.seed.complete` / `system.seed.skipped` / `system.seed.failed`
- `system.cleanup.complete`

### Frontend

Standard fields on every frontend log: `ts`, `level`, `service`, `event`, `message`, `clientSessionId`. Optional: `requestId`, `route`, `context`, `error`.

- `client.api.request_failed`
- `client.auth.request.unauthorized`
- `client.auth.refresh.started` / `client.auth.refresh.succeeded` / `client.auth.refresh.reused_inflight` / `client.auth.refresh.failed`
- `client.booking.status_update.rollback` / `client.booking.load.failed` / `client.booking.facilities.load_failed`
- `client.http.response.failed`
- `client.landing.initialization.failed` / `client.landing.intersection_observer.unsupported` / `client.landing.scroll_observer.failed` / `client.landing.scroll_target.missing` / `client.landing.scroll.failed` / `client.landing.scroll.fallback_failed` / `client.landing.component.error`
- `client.landing_ar.*` (same suffixes as above)
- `client.error.unhandled` / `client.error.reporter.provider_pending`

**Naming convention:** Dot-separated lowercase namespaces. Prefix by domain. Keep event names stable once released.

---

## 6. Incident Triage

### Step 1: Establish Correlation

1. Capture the failing request timestamp and endpoint.
2. Get `x-request-id` from client/network logs.
3. Search backend logs by that request ID.

### Step 2: Backend Triage

1. Find `http.request.failed` or suspicious `http.request.completed` for that request.
2. Follow domain events in order:
   - Auth flow: `auth.*`
   - Booking flow: `booking.*`
   - Notification flow: `email.*`
3. Check `status` and `duration` fields to isolate hotspots.

### Step 3: Auth/Security Incidents

1. Look for `auth.refresh.reuse_detected` and `auth.security.escalation`.
2. Correlate by `userId`, `sessionId`, `tenantId`.
3. Validate expected audit writes exist in `audit_logs`.

### Step 4: Booking Incidents

1. Check `booking.create.conflict` and `booking.status.invalid_transition`.
2. Use `bookingId`, `facilityId`, `tenantId` to reconstruct timeline.
3. Confirm whether failure is business rejection or system fault.

### Step 5: Client-Side Incidents

1. Check browser console logs (when enabled by environment config).
2. Look for `client.*` events matching the user action and route.
3. Pair frontend timestamp with backend `x-request-id` where available.

### Step 6: Safety Checks

1. Confirm no secret/token/password values appear in logs.
2. Confirm masked email/phone in runtime output.
3. Verify 5xx responses keep sanitized public message contract.

### Step 7: Recovery Verification

After fix deployment:

1. Run lint and unit tests.
2. Run API and dashboard E2E gates.
3. Confirm expected event sequence appears in fresh logs for the repaired path.
