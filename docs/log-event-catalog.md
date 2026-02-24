# Log Event Catalog

## Backend Canonical Events

Defined in `apps/api/src/app/logging/logging.constants.ts`.

### HTTP

- `http.request.completed`
- `http.request.failed`

### Auth

- `auth.register.success`
- `auth.login.success`
- `auth.login.failed`
- `auth.refresh.rotated`
- `auth.refresh.failed`
- `auth.refresh.reuse_detected`
- `auth.logout`
- `auth.logout.device`
- `auth.logout.all_devices`
- `auth.password.changed`
- `auth.password.reset_requested`
- `auth.password.reset_completed`
- `auth.security.escalation`

### Booking

- `booking.create.success`
- `booking.create.conflict`
- `booking.status.updated`
- `booking.status.invalid_transition`

### Email

- `email.sent`
- `email.failed`

### Metrics

- `metrics.refresh_token.reuse_detected`
- `metrics.refresh_token.failed`
- `metrics.refresh_token.rotation_latency`
- `metrics.refresh_token.active_sessions`
- `metrics.refresh_token.security_escalation`

### System

- `system.startup`
- `system.seed.complete`
- `system.seed.skipped`
- `system.seed.failed`
- `system.cleanup.complete`

## Frontend Runtime Events

Current dashboard events (emitted by `LoggerService` call sites):

- `client.api.request_failed`
- `client.booking.status_update.rollback`
- `client.booking.load.failed`
- `client.booking.facilities.load_failed`
- `client.landing.initialization.failed`
- `client.landing.intersection_observer.unsupported`
- `client.landing.scroll_observer.failed`
- `client.landing.scroll_target.missing`
- `client.landing.scroll.failed`
- `client.landing.scroll.fallback_failed`
- `client.landing.component.error`
- `client.landing_ar.initialization.failed`
- `client.landing_ar.intersection_observer.unsupported`
- `client.landing_ar.scroll_observer.failed`
- `client.landing_ar.scroll_target.missing`
- `client.landing_ar.scroll.failed`
- `client.landing_ar.scroll.fallback_failed`
- `client.landing_ar.component.error`
- `client.error.unhandled`
- `client.error.reporter.provider_pending`

## Naming Convention

- Dot-separated lowercase namespaces.
- Prefix by domain (`auth.*`, `booking.*`, `http.*`, `system.*`, `client.*`).
- Keep event names stable once released.
