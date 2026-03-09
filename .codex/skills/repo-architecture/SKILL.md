---
name: repo-architecture
description: >
  Repository structure and file-placement rules for Khana. Use when deciding
  where files should live, auditing module boundaries, reviewing folder layout,
  or planning structural refactors across apps/, libs/, shared/, and feature
  directories.
---

# Repo Architecture

Use this skill when the task is about:

- where a new file or folder should live
- whether code belongs in `features/`, `shared/`, `state/`, or `libs/`
- auditing monorepo structure or module boundaries
- reviewing architecture drift, duplication, or dead folders
- planning structural refactors without changing product behavior

Read `docs/current/repo-architecture.md` first. Use `docs/current/repository-map.md`
and `project-index/SKILL.md` only as navigation aids.

## Placement Rules

### Frontend

- Route-owned pages live in `apps/manager-dashboard/src/app/features/<feature>/`.
- Components reused only inside one feature live in `features/<feature>/components/`.
- Feature-local helpers, constants, and models stay inside the owning feature folder.
- Cross-feature domain stores live in `src/app/state/<domain>/`.
- App-global context and shell state live in `src/app/shared/state/`.
- Cross-cutting infrastructure services live in `src/app/shared/services/`.
- Reusable UI primitives live in `src/app/shared/components/ui/`.
- Reusable composite components live in categorized shared folders such as:
  - `shared/components/navigation/`
  - `shared/components/dialogs/`
  - `shared/components/booking/`
- Do not create `pages/` trees unless they actually own routed pages.
- Do not duplicate entire locale-specific feature trees when wrappers + localized content can express the same route.

### Backend

- Domain modules live under `apps/api/src/app/<domain>/`.
- Controllers, services, DTOs, and helpers stay with the owning module.
- Nested subdomains are allowed only when the parent domain owns the lifecycle, for example `bookings/waitlist/`.
- API-only helpers stay in the API app unless they are truly reusable across projects.

### Libraries

- `libs/shared-dtos`: pure shared contracts only.
- `libs/shared-utils`: pure framework-neutral utilities only.
- `libs/booking-engine`: pure booking domain logic only.
- `libs/data-access`: entities and persistence concerns only.
- `libs/notifications`: delivery/integration logic only.
- Node-only or Nest-only code must not live in libraries meant to stay frontend-safe.

## Review Heuristics

- Prefer one concept per file.
- Prefer feature ownership over broad shared buckets.
- `shared/` is not a dumping ground; shared code must justify cross-feature reuse.
- If a route component, store, or service becomes multi-concern, extract colocated feature-local pieces before adding more logic.
- If a feature or module has 3 or more private helper/collaborator files, group
  them under `internal/` and keep the root for public entrypoints and stable subdomains.
- Do not use `providers/` for plain TypeScript implementation modules unless the
  files are actual injectable providers.
- Avoid mirrored locale trees for behavior. Share implementation and inject localized content or wrappers.
- Keep architecture enforceable: tags and Nx dependency constraints must reflect the intended layering.

### Oversized File Thresholds

Use these thresholds as repo review heuristics:

- `<= 399` lines: normal
- `400-599` lines: warning
- `600-999` lines: hotspot
- `1000+` lines: critical

Helper extraction into `internal/` is only successful when the root materially
shrinks. If a root file is still `>= 600` lines and imports `3+` sibling
`internal/` modules, treat that as ineffective internal extraction.

For class-based components, services, and controllers, `>= 600` lines with
`20+` apparent class methods is an ownership warning. Prefer splitting by
workflow or use case instead of adding more helper dumping.

## Audit Workflow

1. Confirm repo truth with `project-index`, `repository-map`, and actual folders.
2. Check Nx project tags and `@nx/enforce-module-boundaries` constraints.
3. Check for dead folders, duplicated trees, and impure shared libraries.
4. Decide whether the fix is:
   - placement only
   - boundary enforcement
   - structural normalization
   - decomposition of oversized hotspots
5. Run `npm run audit:hotspots` before proposing hotspot refactors so size and
   ownership findings are grounded in repo output.
6. Keep behavior unchanged unless the user explicitly requests a product change.

## Expected Outputs

- Decision-complete placement guidance
- Architecture audit findings ordered by severity
- A phased refactor plan when structural cleanup is needed
- Updates to `docs/current/repo-architecture.md`, `docs/current/repository-map.md`,
  and `project-index/SKILL.md` when the repo structure changes
