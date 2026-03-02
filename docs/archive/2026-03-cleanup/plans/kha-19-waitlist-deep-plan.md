# KHA-19 Waitlist for Fully Booked Slots (Phase 0/1 Baseline)

## Objective

Add a tenant-scoped waitlist capability for unavailable booking slots with additive APIs and strict role/tenant boundaries.

## Delivery Scope (Current Pass)

- Phase 0: planning guardrails + validator scripts.
- Phase 1: waitlist domain model and API endpoints (`join`, `status`) only.

## Endpoints

- `POST /api/v1/bookings/waitlist`
- `GET /api/v1/bookings/waitlist/status`

## Access Control

- JWT required.
- Roles allowed: `OWNER`, `MANAGER`, `STAFF`.
- Tenant scoping enforced by facility ownership checks.

## Core Behaviors (Phase 1)

- Join is idempotent for an existing active entry (`WAITING|NOTIFIED`) on the same slot.
- Joining requires the slot to be currently unavailable.
- Status endpoint returns whether the current actor is still on waitlist (`WAITING`) for the exact slot.
- Queue position is FIFO by creation time.

## Out of Scope (Deferred)

- Cancellation hook with notify-first dispatch.
- Waitlist auto-expiry cron.
- Fulfillment transition on booking creation.
- Frontend join/indicator integration.
- Email/WhatsApp waitlist notifications.

## Validation Commands

- `npm run validate:kha19:baseline`
- `npm run validate:kha19:target`
