# Incident Runbook (Logging-Centric)

## Goal

Use request correlation and structured logs to triage production issues quickly without changing API behavior.

## 1) Start With Correlation

1. Capture the failing request timestamp and endpoint.
2. Retrieve `x-request-id` from client/network logs.
3. Search backend logs by that request ID.

## 2) Backend Triage Flow

1. Find `http.request.failed` or suspicious `http.request.completed` entries for that request.
2. Follow related domain events in order:
   - auth flow: `auth.*`
   - booking flow: `booking.*`
   - notification flow: `email.*`
3. Check status and duration fields to isolate hotspots.

## 3) Auth/Security Incidents

1. Look for `auth.refresh.reuse_detected` and `auth.security.escalation`.
2. Correlate by `userId`, `sessionId`, `tenantId`.
3. Validate expected audit DB writes still exist in `audit_logs`.

## 4) Booking Incidents

1. Check for `booking.create.conflict` and `booking.status.invalid_transition`.
2. Use `bookingId`, `facilityId`, and `tenantId` fields to reconstruct timeline.
3. Confirm whether failure is expected business rejection vs system fault.

## 5) Client-Side Incidents

1. Check browser console logs (when enabled by environment config).
2. Look for `client.*` events matching the user action and route.
3. Pair frontend timestamp with backend `x-request-id` where available.

## 6) Safety Checks

1. Ensure no secret/token/password values appear in logs.
2. Confirm masked email/phone in runtime output.
3. Verify 5xx responses keep sanitized public message contract.

## 7) Recovery and Verification

After fix deployment:

1. Run lint and unit tests.
2. Run API and dashboard e2e gates.
3. Confirm expected event sequence appears in fresh logs for the repaired path.
