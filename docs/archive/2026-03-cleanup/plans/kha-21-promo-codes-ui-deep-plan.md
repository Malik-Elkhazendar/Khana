# KHA-21 Promo Codes Management UI (Dashboard) — Decision-Complete Plan

## Summary

Build a new dashboard page at `/dashboard/promo-codes` so `OWNER` and `MANAGER` can create, list, edit, activate/deactivate promo codes without Postman, fully aligned with existing repo patterns (standalone route, signal store, `ApiService`, `dashboard-card`/`dashboard-btn` UI contract, i18n-first copy, role-guard routing).

Locked decisions from your inputs:

1. Create/edit UX: modal form.
2. API scope: keep existing backend promo APIs (no search/sort extension now).
3. Usage visibility: summary fields only from existing DTO (`currentUses`, `remainingUses`, `isExpired`, `isExhausted`), no redemption-history table.
4. Nav placement: after `Facilities`.
5. Nav icon: add dedicated new `promo` icon token.

## Public APIs / Interface / Type Changes

1. Backend APIs: no contract changes in this ticket.
2. Frontend service contract additions in `ApiService`:
   - `createPromoCode(request: CreatePromoCodeRequestDto)`
   - `listPromoCodes(query: PromoCodeListQueryDto)`
   - `updatePromoCode(id: string, request: UpdatePromoCodeRequestDto)`
3. Dashboard navigation type contract:
   - Extend `DashboardNavIcon` with `promo`.
   - Add promo icon glyph in `ui-icon` component.
4. Route metadata additions:
   - `META.TITLES.PROMO_CODES`
   - `DASHBOARD.BREADCRUMBS.PROMO_CODES`
   - `DASHBOARD.NAV.ITEMS.PROMO_CODES`

## Implementation Phases

1. Phase 0 — Guardrails and planning artifacts.
2. Phase 1 — Route/nav/icon wiring.
3. Phase 2 — API client methods + tests.
4. Phase 3 — Promo signal store + tests.
5. Phase 4 — Promo Codes feature page + modal UX.
6. Phase 5 — i18n/meta integration.
7. Phase 6 — Contract/regression tests.
8. Phase 7 — Validation gates.

## Validation Gates

1. `npm run validate:kha21:baseline` before implementation.
2. `npm run validate:kha21:target` after implementation.
3. `npm run test -- --projects=manager-dashboard --runInBand`
4. `npm run test -- --projects=api --runInBand`
5. `npm run i18n:audit`
6. `npm run lint`
7. `npm run build`

## Assumptions

1. Frontend-only follow-up; backend promo APIs already implemented.
2. No promo redemption-history endpoint/UI in this ticket.
3. No search/sort API extension in this ticket.
4. Promo page uses `contentArchetype: 'data'`.
5. Promo appears after Facilities in nav.
