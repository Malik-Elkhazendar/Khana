---
name: update-project-docs
description: >
  Sync docs/current/ with the actual state of the codebase. Run after adding new
  features, modules, or performing major refactors to prevent documentation drift.
# Claude Code extensions:
disable-model-invocation: true # must be triggered manually with /update-project-docs
allowed-tools: Read, Glob, Grep, Edit
---

# Update Project Docs

Synchronize `docs/current/` with the real codebase state. Make only accurate,
evidence-based updates — do not infer or guess.

## Steps

### 1. Sync api-modules.md

**Target file:** `docs/current/api-modules.md`

Scan `apps/api/src/app/` for directories. For each directory:

- Read the `*.module.ts` file inside it to understand its purpose
- Check whether it appears in the current `api-modules.md`
- Add entries for new modules; remove entries for deleted modules
- Keep descriptions accurate (1 line per module)

Also update the **Cross-Cutting** and **Data Layer Dependencies** sections if any
new library (`@khana/*`) has been added to API imports.

### 2. Sync frontend-modules.md

**Target file:** `docs/current/frontend-modules.md`

Scan:

- `apps/manager-dashboard/src/app/features/` → update **Feature Areas**
- `apps/manager-dashboard/src/app/state/` → update **State Management**
- `apps/manager-dashboard/src/app/shared/` → update **Shared Infrastructure** if structure changed

For each directory found, verify it is listed. Add missing, remove deleted.

### 3. Sync repository-map.md

**Target file:** `docs/current/repository-map.md`

Check:

- `apps/` directory list — are all apps still present?
- `libs/` directory list — any new or removed libraries?
- Root config files section — any new root-level config files?

Update only what has changed.

### 4. Sync project-index skill

**Target file:** `.claude/skills/project-index/SKILL.md`

This skill is a navigation index. After updating `docs/current/`, check if any new
feature directories, state stores, entities, or DTOs have been added that are not
yet listed in `project-index/SKILL.md`.

Add entries for new items. Remove entries for deleted ones.

### 5. Verify Skill Descriptions Are Current

Read `.claude/skills/*/SKILL.md` for every skill. Check that the `description` field
still accurately matches what the skill does. If a skill was modified and its description
is stale, update the description in the frontmatter.

### 6. Report Changes Made

After completing edits, output a summary:

```
DOCS UPDATE COMPLETE
====================

api-modules.md:
  + Added: goals, customers, settings, dashboard
  ~ Updated: bookings description
  - Removed: (none)

frontend-modules.md:
  + Added: features/waitlist, state/dashboard
  ~ Updated: (none)
  - Removed: (none)

repository-map.md:
  (no changes needed)

project-index/SKILL.md:
  + Added: goal-milestone.entity.ts, customer.entity.ts
  (no other changes)

Skill descriptions:
  ~ feature-strategist: description updated
  (5 skills: no changes needed)
```

If a section had no changes, still mention it so the user knows it was checked.
