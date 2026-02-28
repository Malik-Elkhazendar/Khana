# KHA-16 Deep Implementation Plan

## Verification Summary

This plan and implementation align to the existing KHA delivery pattern used in KHA-14 and KHA-15:

- Tenant-scoped service logic with repository access.
- Controller endpoints remain thin and delegated.
- Dashboard integrations are centralized in `ApiService`.
- UI behaviors are integrated into existing booking list/calendar/preview flows.
- Validation-agent workflow is preserved (`baseline` and `target` checks).

## Scope Delivered

### Backend

- Added recurrence fields on `Booking` entity:
  - `recurrenceRule` (JSONB)
  - `recurrenceGroupId`
  - `recurrenceInstanceNumber`
- Added `POST /api/v1/bookings/recurring`.
- Added all-or-nothing recurring conflict detection across generated instances.
- Added cancellation scope to status endpoint:
  - `SINGLE`
  - `THIS_AND_FUTURE`
- Added grouped recurring cancellation from selected instance onward.
- Added audit logging for recurring series create and cancellation actions.

### Frontend

- Booking preview form supports recurring creation:
  - repeat weekly toggle
  - weekly/biweekly selector
  - end by count or end date
- Booking list cancellation dialog supports:
  - cancel single
  - cancel this + future (for recurring bookings)
- Booking calendar cancellation dialog supports the same scope options.
- Calendar cards/timeline now visibly indicate recurring bookings.

## Acceptance Mapping

- Owner can create weekly recurring bookings for N weeks:
  - via `POST /v1/bookings/recurring` + preview form recurrence controls.
- Conflict detection across all instances:
  - preflight validates every generated occurrence before save.
- Cancel single or series:
  - `PATCH /v1/bookings/:id/status` with `cancellationScope`.
- Calendar distinct recurring display:
  - recurring badge + dashed marker classes in calendar/timeline cards.

## Validation Commands

```bash
npm run validate:kha16:target
npx tsc -p apps/api/tsconfig.app.json --noEmit
npx tsc -p apps/manager-dashboard/tsconfig.app.json --noEmit
npx tsc -p libs/shared-dtos/tsconfig.lib.json --noEmit
npx jest --config apps/api/jest.config.js --runInBand --testPathPattern=bookings.service.spec.ts
npx jest --config apps/manager-dashboard/jest.config.cjs --runInBand --testPathPattern="api.service.spec.ts|booking.store.spec.ts|booking-list.component.spec.ts|booking-calendar.component.spec.ts|booking-preview.component.spec.ts"
```
