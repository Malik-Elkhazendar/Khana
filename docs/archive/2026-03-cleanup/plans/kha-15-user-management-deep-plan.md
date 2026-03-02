# KHA-15 Deep Implementation Plan

## Verification Summary

This plan is grounded in validated repo and Linear evidence:

- Linear issue exists: `KHA-15` ("Build User Management & Role Assignment (API + UI)").
- Backend currently has auth endpoints (`register`, `login`, `me`) but no `/v1/users` management endpoints.
- Role enum already exists (`OWNER`, `MANAGER`, `STAFF`, `VIEWER`).
- Manager Dashboard `Team` page is currently profile-only and does not support listing all users, role changes, status toggles, or invites.

## Current Baseline

### Already Exists

- Auth module with secure register/login/refresh/password flows.
- User entity scoped by `tenantId` and includes role + `isActive`.
- Login path already blocks inactive users.
- Audit logging infrastructure and conventions exist.

### Missing (KHA-15 Scope)

- Dedicated user management API module/controller/service.
- Endpoints:
  - `GET /api/v1/users`
  - `PATCH /api/v1/users/:id/role`
  - `PATCH /api/v1/users/:id/status`
  - `POST /api/v1/users/invite`
- Shared DTO contracts for user management actions.
- Team management UI in dashboard.
- Invite email template/service path for team invitations.

## Architectural Constraints (Must Follow)

- Follow KHA-14 structure: dedicated Nest feature module + service + DTOs + role guards.
- Keep tenant scoping mandatory in every users query/mutation.
- Reuse `JwtAuthGuard` + `RolesGuard` with explicit `@Roles` decorators.
- Keep mutation endpoints audit-logged.
- Keep frontend API access centralized in `ApiService`.
- Preserve existing UX patterns and design tokens for dashboard pages.

## Deep Plan

## Phase 1: Planning & Validation Artifacts

1. Add deep plan document for KHA-15.
2. Add `validate-kha15-plan.agent.ts` with `baseline` and `target` checks.
3. Add npm scripts:
   - `validate:kha15:baseline`
   - `validate:kha15:target`
4. Run baseline validator before implementation.

## Phase 2: Backend Users Module

1. Create `apps/api/src/app/users/`:
   - `users.module.ts`
   - `users.controller.ts`
   - `users.service.ts`
   - `dto/invite-user.dto.ts`
   - `dto/update-user-role.dto.ts`
   - `dto/update-user-status.dto.ts`
   - `dto/index.ts`
2. Wire module into [`apps/api/src/app/app.module.ts`](/home/malek/projects/khana/apps/api/src/app/app.module.ts).
3. Use TypeORM repositories:
   - `User`
   - `AuditLog`
   - `RefreshToken`
   - `PasswordResetToken`

## Phase 3: Endpoint Implementation

1. `GET /v1/users` (OWNER/MANAGER):
   - Return tenant-scoped list of users.
2. `PATCH /v1/users/:id/role` (OWNER):
   - Change role for target user.
   - Restrict unsafe transitions (e.g., no OWNER assignment via this endpoint).
3. `PATCH /v1/users/:id/status` (OWNER):
   - Activate/deactivate user.
   - On deactivation, revoke active refresh tokens.
4. `POST /v1/users/invite` (OWNER):
   - Create invited user account (tenant-scoped).
   - Generate one-time reset/invite token.
   - Send invitation email.

## Phase 4: Security & Business Rules

1. Tenant isolation for all user operations.
2. Owner-only mutation protections:
   - Cannot demote/deactivate self.
   - Cannot mutate OWNER accounts via management endpoints.
3. Validate allowed role targets for invite/update.
4. Keep deactivated users blocked at login (already in auth; verify unchanged).

## Phase 5: Audit & Logging

1. Audit log for role/status/invite actions (`CREATE`/`UPDATE`).
2. Structured application logs for success/failure context.
3. Include actor user id, tenant id, and target entity ids.

## Phase 6: Notifications (Invite Flow)

1. Extend notifications interfaces/service with invite payload.
2. Add invite email template.
3. Send invite email with role + acceptance/reset URL.
4. Ensure email failure handling follows existing non-blocking pattern where appropriate.

## Phase 7: Shared DTOs + Frontend API Layer

1. Add shared DTO contracts for:
   - user list item
   - update role request
   - update status request
   - invite request/response
2. Extend dashboard `ApiService` with users endpoints.
3. Add/extend API service tests.

## Phase 8: Team Page UI (Manager Dashboard)

1. Replace current profile-only team page with team management layout:
   - team members table
   - role badges
   - role dropdown (OWNER only)
   - activate/deactivate action (OWNER only)
2. Add invite form:
   - email + role selection
   - OWNER only visibility
3. Keep MANAGER behavior read-only for list access.
4. Update i18n (EN/AR) for new Team UI copy.

## Phase 9: Tests

1. Backend unit tests for `UsersService`:
   - tenant scoping
   - role update restrictions
   - status update behavior
   - invite behavior and audit logging
2. Frontend tests:
   - Team component behavior by role
   - API service users endpoints
3. Optional notifications service tests for invite sender method.

## Phase 10: Validation Commands

```bash
npm run validate:kha15:baseline
npm run validate:kha15:target
npx jest --config apps/api/jest.config.js --runInBand --testPathPattern=users.service.spec.ts
npx jest --config apps/manager-dashboard/jest.config.cjs --runInBand --testPathPattern="team.component.spec.ts|api.service.spec.ts"
npx tsc -p apps/api/tsconfig.app.json --noEmit
npx tsc -p libs/shared-dtos/tsconfig.lib.json --noEmit
npx eslint <touched-files>
```

## Acceptance Criteria Mapping

- Owner can see all team members:
  - `GET /v1/users` + Team members table.
- Owner can promote STAFF to MANAGER:
  - `PATCH /v1/users/:id/role` + role dropdown.
- Owner can deactivate a user (blocks login):
  - `PATCH /v1/users/:id/status` sets `isActive=false` + login check remains enforced.
- Owner can invite new team members by email:
  - `POST /v1/users/invite` + invite form + invite email delivery.
