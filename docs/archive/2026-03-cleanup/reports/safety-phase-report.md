# Safety Phase Report - 2026-03-02

## Baseline

- Worktree had active in-progress feature changes before cleanup.
- Root inventory and dependency baseline captured.

## SAFE TO DELETE

- `.agent/**`
  - Evidence: project runtime/scripts do not reference this folder.
- `.claude/settings.json`
  - Evidence: keep-only scope is `.claude/agents/**` and `.claude/skills/**`.
- `.claude_settings.json`
  - Evidence: no runtime references.
- `.playwright-mcp/**`
  - Evidence: reference scan returned zero usage outside folder.
- `build.log`, `build2.log`
  - Evidence: no repo references; historical local logs.
- `test-lint.ts`
  - Evidence: intentional lint violation test file, not wired to scripts.
- `.env-debug-backup/**`
  - Evidence: local backup folder, not referenced by runtime/scripts.
- `apps/manager-dashboard/src/assets/task_backup.md`
  - Evidence: local task scratch file, not referenced.
- `apps/manager-dashboard/public/assets/images/landing/hero_dashboard_mockup.png`
  - Evidence: zero references in source/docs.
- `apps/manager-dashboard/public/assets/images/landing/problem_solution_comparison.png`
  - Evidence: zero references in source/docs.
- Local cache/build outputs: `.nx/`, `.angular/`, `dist/`, `coverage/`, `tmp/`
  - Evidence: generated artifacts/caches.

## NEED CONFIRMATION (archive path chosen)

- `docs/authoritative/**`
- `docs/plans/**`
- `docs/PHASE_1_*`
- `PHASE_1_QUICK_REFERENCE.md`

Decision used for this execution:

- Archive these under `docs/archive/2026-03-cleanup/` and remove original locations.

## KEEP

- `.claude/agents/**`
- `.claude/skills/**`
- Runtime source under `apps/**` and `libs/**` (except explicit safe-delete assets above)

## Dependency / Script Cleanup Scope

- Remove agent scripts from `package.json`: `staff-engineer`, all `validate:kha*`.
- Remove agent-only packages: `@openai/agents`, `@swc-node/register`, `@swc/core`, `@swc/helpers`.
- Ensure direct declarations for used runtime/script packages: `express`, `ms`, `rimraf`.
