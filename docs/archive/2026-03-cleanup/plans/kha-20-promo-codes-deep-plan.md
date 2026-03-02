# KHA-20 Promo Code System Deep Plan

## Objective

Implement a tenant-scoped promo code system with real validation and redemption tracking, replacing the current preview placeholder discount behavior.

## Delivery Scope

1. Backend promo management APIs:
   - `POST /api/v1/promo-codes`
   - `GET /api/v1/promo-codes`
   - `PATCH /api/v1/promo-codes/:id`
2. Booking preview promo validation (non-blocking invalid state).
3. Booking creation promo application with transactional redemption tracking.
4. Shared DTO/enum contracts and data-access entities/migrations.
5. Frontend booking preview integration and i18n messaging updates.

## Locked Decisions

1. Discount model supports `PERCENTAGE` and `FIXED_AMOUNT`.
2. Facility scope supports tenant-wide (`ALL_FACILITIES`) or one facility (`SINGLE_FACILITY`).
3. Usage is consumed only on successful booking creation.
4. Invalid promo in preview returns `200` with promo validation payload and no promo discount.
5. Recurring bookings do not support promo codes in this ticket.
6. Promo management APIs are restricted to `OWNER` and `MANAGER`.

## Validation Commands

1. `npm run validate:kha20:baseline`
2. `npm run validate:kha20:target`
