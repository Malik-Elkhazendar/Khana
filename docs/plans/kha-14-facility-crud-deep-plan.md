# KHA-14 Deep Implementation Plan

## Verification Summary

This plan is based on validated repo and Linear evidence:

- Linear issue exists: `KHA-14` ("Build Facility Management CRUD (API + UI)").
- Backend currently exposes only `GET /api/v1/bookings/facilities` for facilities read.
- There is no `apps/api/src/app/facilities/` module/controller/service.
- Frontend has a facilities page route and nav entry, but the page is read-only (selection view, no create/edit/deactivate form/actions).

## What Already Exists vs Missing

### Already Exists

- `Facility` entity with `isActive` and JSONB `config` (`pricePerHour`, `openTime`, `closeTime`).
- Dashboard route `/dashboard/facilities` and nav item.
- Read API surface through bookings flow (`/v1/bookings/facilities`).
- Facility context store used to select active facility in UI.

### Missing (KHA-14 Scope)

- Dedicated facilities CRUD API:
  - `POST /api/v1/facilities`
  - `GET /api/v1/facilities/:id`
  - `PATCH /api/v1/facilities/:id`
  - `DELETE /api/v1/facilities/:id` (deactivate/soft delete semantics)
- Tenant-scoped facilities service layer with role-based permissions.
- Facilities DTOs for create/update with strict validation.
- Facilities management UI (form + list actions for create/edit/deactivate/reactivate).
- Audit logging for facility mutations.

## Architectural Constraints (Must Follow)

- Keep NestJS feature boundaries consistent with existing modules (`auth`, `bookings`, `logging`).
- Keep tenant scoping explicit and mandatory for all facility reads/writes.
- Keep role model consistent with existing enums and guards:
  - OWNER/MANAGER: write
  - STAFF/VIEWER: read only
- Keep API contracts in `libs/shared-dtos` and consume from dashboard via `ApiService`.
- Keep frontend state split:
  - API/data state in a store/service layer
  - transient UI state in components
- Keep error shape and logging behavior aligned with current global error filter and structured logger.

## Deep Plan

## Phase 1: Backend Facilities Feature Module

1. Add module skeleton under `apps/api/src/app/facilities/`:
   - `facilities.module.ts`
   - `facilities.controller.ts`
   - `facilities.service.ts`
   - `dto/create-facility.dto.ts`
   - `dto/update-facility.dto.ts`
   - `dto/index.ts`
2. Wire `FacilitiesModule` into [`apps/api/src/app/app.module.ts`](/home/malek/projects/khana/apps/api/src/app/app.module.ts).
3. Register TypeORM entities in module:
   - `Facility`
   - `AuditLog`
4. Enforce auth + role access:
   - Use `JwtAuthGuard` at controller level.
   - Use `RolesGuard` + `@Roles(...)` for mutation endpoints.

## Phase 2: API Contract and Validation

1. Create backend DTOs:
   - `CreateFacilityDto`
   - `UpdateFacilityDto`
2. Validation rules:
   - `name`: required, trimmed, bounded length.
   - `type`: enum (existing facility type enum).
   - `config.pricePerHour`: positive number.
   - `config.openTime/closeTime`: HH:mm format + open < close.
3. Add/extend shared DTOs in `libs/shared-dtos`:
   - request/response DTOs for facilities CRUD used by frontend.
4. Keep response payloads API-safe and consistent with existing list DTO style.

## Phase 3: Facilities Service (Tenant-Scoped CRUD)

1. Implement methods:
   - `createFacility(tenantId, actor, dto)`
   - `getFacilityById(id, tenantId, actor)`
   - `listFacilities(tenantId, includeInactive?)`
   - `updateFacility(id, tenantId, actor, dto)`
   - `deactivateFacility(id, tenantId, actor)` (and optionally reactivate)
2. Tenant isolation:
   - Every query constrained by tenant ownership.
   - Return `404` for missing within scope, `403` for cross-tenant where applicable.
3. Mutation behavior:
   - `DELETE` endpoint sets `isActive = false` (no hard delete).
   - Optional `PATCH` flag to reactivate (`isActive = true`) for toggle UX.
4. Audit logging:
   - Log `CREATE/UPDATE/DELETE` actions into `AuditLog`.
   - Include actor, tenant, entity id, and change metadata.
5. Logging:
   - Use `AppLoggerService` event names aligned to current pattern.

## Phase 4: Controller Endpoints

1. `POST /v1/facilities`
   - OWNER/MANAGER only.
2. `GET /v1/facilities/:id`
   - OWNER/MANAGER/STAFF/VIEWER.
3. `PATCH /v1/facilities/:id`
   - OWNER/MANAGER only.
4. `DELETE /v1/facilities/:id`
   - OWNER/MANAGER only, deactivate behavior.
5. Add `GET /v1/facilities` list endpoint for management screen:
   - staff can view active; owner/manager can optionally include inactive.

## Phase 5: Bookings Integration Guardrails

1. Ensure booking facility reads use only active facilities for booking actions.
2. Preserve current booking flows and update only necessary contracts.
3. Maintain backwards compatibility where `bookings/facilities` is still consumed during migration.
4. Prefer gradual migration:
   - Introduce `/v1/facilities` for management UI.
   - Keep `/v1/bookings/facilities` stable until frontend fully moved.

## Phase 6: Frontend API Layer

1. Extend [`apps/manager-dashboard/src/app/shared/services/api.service.ts`](/home/malek/projects/khana/apps/manager-dashboard/src/app/shared/services/api.service.ts):
   - `getFacilitiesList(...)`
   - `getFacilityById(id)`
   - `createFacility(dto)`
   - `updateFacility(id, dto)`
   - `deactivateFacility(id)` and `reactivateFacility(id)` (if supported)
2. Extend shared DTO usage (typed requests/responses).
3. Keep existing request error logging with `requestId` capture.

## Phase 7: Frontend Facilities Management UI

1. Upgrade existing facilities page from read-only cards to management experience:
   - Table/list with status, name, type, base price, hours.
   - Create/edit form (drawer/modal/inline form).
   - Deactivate/reactivate action with confirmation.
2. Role-aware behavior:
   - OWNER/MANAGER: full actions.
   - STAFF/VIEWER: read-only view.
3. Reuse current design system tokens/components and i18n patterns.
4. Preserve facility selection behavior from `FacilityContextStore`.

## Phase 8: State Management

1. Add dedicated facilities management store (recommended) or extend existing context store carefully:
   - management list state
   - action loading/error state per facility
   - optimistic toggle handling with rollback on failure
2. Keep selected booking facility context isolated from CRUD form state.

## Phase 9: Tests

1. Backend unit tests:
   - `FacilitiesService` tenant scoping, role restrictions, deactivate/reactivate.
   - DTO validation edge cases.
2. Backend e2e tests:
   - CRUD lifecycle per tenant.
   - cross-tenant access denial.
   - STAFF read allowed, write denied.
3. Frontend unit tests:
   - Facilities component render/actions by role.
   - API service endpoints.
   - store optimistic updates + rollback.
4. Frontend e2e tests:
   - owner create/update/deactivate/reactivate flow.

## Phase 10: Rollout and Migration

1. Ship backend endpoints first behind existing UI compatibility.
2. Switch facilities page to new endpoints.
3. Monitor logs/audit entries for mutation endpoints.
4. Keep `bookings/facilities` endpoint until all consumers are moved.

## Acceptance Criteria Mapping

- Owner can add court/chalet with pricing/hours:
  - covered by `POST /v1/facilities` + management form.
- Owner can update pricing/hours:
  - covered by `PATCH /v1/facilities/:id` + edit form.
- Owner can deactivate court (hidden from booking):
  - covered by `DELETE /v1/facilities/:id` + booking active-only filtering.
- All actions tenant-scoped and audit-logged:
  - covered by service query scoping + `AuditLog` writes.

## Risk Controls

- Prevent cross-tenant leakage by never querying facility by id without tenant guard.
- Prevent stale UI state by separating context selection from CRUD list cache.
- Avoid breaking booking flows by keeping existing read endpoint during transition.
- Preserve API error format to avoid frontend regression in interceptor/store error handling.

## Validation Commands (Post-Implementation)

```bash
npm run test -- --projects=api --runInBand
npx nx run api-e2e:e2e --runInBand
npm run test -- --projects=manager-dashboard --runInBand
npx nx run manager-dashboard-e2e:e2e
npm run lint
npm run build
```
