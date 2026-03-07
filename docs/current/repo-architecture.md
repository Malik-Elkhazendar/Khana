# Repo Architecture

## Purpose

This document defines where code belongs in the Khana monorepo and how structure
should be enforced. It complements `docs/current/repository-map.md`, which is a
navigation snapshot, not a placement guide.

## Architecture Principles

- Organize app code by feature ownership first.
- Keep shared code small and intentional.
- Prefer information hiding over broad utility buckets.
- Keep framework-neutral logic in libraries.
- Keep app-specific infrastructure inside the owning app.
- Make boundaries enforceable with Nx tags and dependency constraints.

## Monorepo Layers

### Apps

- `apps/manager-dashboard`: Angular web application and route-owned UI.
- `apps/api`: NestJS backend application and API-only infrastructure.
- `apps/*-e2e`: end-to-end test projects.

Apps own orchestration, route composition, and app-specific integration code.

### Shared Libraries

- `libs/shared-dtos`: shared contracts, enums, interfaces.
- `libs/shared-utils`: framework-neutral utility functions only.
- `libs/booking-engine`: pure booking domain logic.
- `libs/data-access`: entities and persistence-oriented types.
- `libs/notifications`: notification delivery integrations.

Libraries must have a clear responsibility. Shared libraries must stay safe for
every project that imports them.

## Frontend Placement Matrix

### Features

- Route-owned pages live in `apps/manager-dashboard/src/app/features/<feature>/`.
- Feature-local child components live in `features/<feature>/components/`.
- Feature-local helpers, constants, view models, and adapters stay within the
  same feature folder.
- If only one feature uses a piece of code, keep it inside that feature.

### Shared

- `shared/components/ui/`: primitives such as icons, badges, toasts.
- `shared/components/navigation/`: shell and navigation components.
- `shared/components/dialogs/`: generic dialogs.
- `shared/components/booking/`: reusable booking-specific composite components.
- `shared/services/`: cross-cutting infrastructure services.
- `shared/state/`: app-global context and layout state.
- `shared/interceptors/`, `shared/guards/`, `shared/pipes/`: app-wide infrastructure.
- `shared/styles/`: shared style partials and theme helpers.

Shared code must justify reuse across multiple features. Avoid adding feature-only
code to `shared/` for convenience.

### State

- `state/<domain>/`: cross-feature domain stores, such as bookings or analytics.
- `shared/state/`: app-global context stores, such as auth, layout, and facility context.

## Backend Placement Matrix

- Domain modules live under `apps/api/src/app/<domain>/`.
- Controllers, services, DTOs, and validators stay with the owning domain.
- Nested subdomains are allowed only when owned by the parent domain lifecycle,
  such as `bookings/waitlist/`.
- API-only helpers such as bootstrap config and HTTP filters stay in the API app,
  not in frontend-safe shared libraries.

## Structural Rules

- Do not keep dead folders. Remove empty or stale directories once unused.
- Do not duplicate entire locale-specific feature trees for behavior. Use shared
  implementation with localized wrappers or content sources.
- Avoid mirrored files when only text, direction, or labels differ.
- Keep one primary responsibility per file. When a file grows into multiple
  concerns, extract colocated pieces before moving code into `shared/`.
- If a feature or module grows to 3 or more private collaborator/helper files,
  group them under an `internal/` folder instead of leaving them flat at the root.
- Do not use `providers/` for plain TypeScript helper modules. Reserve that name
  for actual injectable provider semantics.

## Nx Boundary Enforcement

Every project must have non-empty tags. Dependency constraints should encode:

- platform boundaries (`platform:web`, `platform:api`, `platform:shared`)
- project roles (`type:app`, `type:e2e`, `type:dto`, `type:util`,
  `type:engine`, `type:data-access`, `type:notifications`)

Wildcard-only constraints are not considered governance.

## Review Checklist

- Does the file live with the feature or module that owns it?
- Is this genuinely shared, or just convenient to place in `shared/`?
- Would this code be safe for every current importer of its library?
- Does the structure avoid mirrored locale implementations?
- Are Nx tags and constraints enforcing the intended boundary?
- Is there a dead folder or stale doc entry that should be removed?
