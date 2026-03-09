# Frontend Modules (Current)

Location: `apps/manager-dashboard/src/app`

## Feature Areas

- `features/auth`: login/register/forgot/reset/change-password.
- `features/landing`, `features/landing-ar`: marketing and entry pages.
- `features/onboarding`: tenant onboarding flow.
- `features/booking-calendar`, `features/booking-detail`, `features/booking-list`, `features/booking-preview`.
- `features/waitlist`.
- `features/facilities`.
- `features/team`.
- `features/settings`.
- `features/analytics`.
- `features/promo-codes`.
- `features/forbidden`.

## State Management

- `state/dashboard`
- `state/bookings`: root SignalStore plus `state/bookings/internal/` method and model modules.
- `state/analytics`
- `state/promo-codes`
- shared state in `shared/state` (auth, layout, facility context).

## Shared Infrastructure

- `shared/components/ui`: UI primitives such as icons, badges, and toasts.
- `shared/components/navigation`: shell and navigation composition.
- `shared/components/dialogs`: reusable generic dialogs.
- `shared/components/booking`: reusable booking-specific shared components.
- `shared/components/tag-chip`: shared semantic chip component.
- `shared/interceptors`: auth and error HTTP interceptors.
- `shared/guards`: auth, role, onboarding, and public route guards.
- `shared/services`: auth, i18n, locale formatting, logging, and error reporting.
- `shared/services/api.service.ts`: backwards-compatible API facade for existing callers.
- `shared/services/api/`: domain API clients and request helpers.
- `shared/styles`: shared styling partials and cross-feature visual primitives.
- `shared/navigation`: dashboard and landing navigation models.

## App Wiring

- Entry and routing: `app.ts`, `app.config.ts`, `app.routes.ts`.
- Environment definitions: `src/environments/*`.
