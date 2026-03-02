# KHA-18 Analytics Dashboard Deep Plan

## Objective

Add a tenant-scoped analytics dashboard (read-only) that gives owners/managers/viewers KPI visibility and operational insights from aggregated booking data.

## Scope

- Backend: additive analytics endpoints only.
- Frontend: new `/dashboard/analytics` page with date-range filters, KPIs, charts, facility comparison, occupancy details, and insights.
- Shared contracts: typed analytics DTOs in `shared-dtos`.
- UX: EN/AR i18n, responsive dashboard layout, no hardcoded API assumptions.

## Endpoints

- `GET /api/v1/analytics/summary`
- `GET /api/v1/analytics/occupancy`
- `GET /api/v1/analytics/revenue`
- `GET /api/v1/analytics/peak-hours`

All endpoints are:

- JWT protected
- Role-limited to `OWNER|MANAGER|VIEWER`
- Tenant-scoped
- Read-only

## Data Contracts

- `AnalyticsSummaryResponseDto`
- `AnalyticsOccupancyResponseDto`
- `AnalyticsRevenueResponseDto`
- `AnalyticsPeakHoursResponseDto`
- Base query contract with `from`, `to`, optional `facilityId`, optional `timeZone`.

## Frontend Delivery

- New analytics store: `state/analytics/analytics.store.ts`.
- New page: `features/analytics/analytics.component.*`.
- Dashboard default redirect changed to `/dashboard/analytics`.
- New nav item and icon for analytics.
- Route archetype uses `analytics-wide` and maps to `--content-max-analytics-wide`.

## Validation Strategy

1. Plan checks:
   - `npm run validate:kha18:baseline`
   - `npm run validate:kha18:target`
2. Unit/build/lint gates:
   - `npm run test -- --projects=api --runInBand`
   - `npm run test -- --projects=manager-dashboard --runInBand`
   - `npm run lint`
   - `npm run build`
3. UX checks:
   - `/dashboard/analytics` with range/facility/group-by changes.
   - EN/AR labels + metadata key coverage.
   - Responsive layout at 320/390/768/1024/1440/1920.

## Constraints

- No breaking changes to existing API contracts.
- No forecasting/ML.
- `mostBookedCourt` remains nullable until court/resource schema exists.
