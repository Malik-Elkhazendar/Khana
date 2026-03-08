---
name: skills-audit
description: >
  Audit the .codex/skills/ directory for dead skills, missing SKILL.md files,
  stale documentation references, and opportunities to consolidate. Run periodically
  to keep the skill system healthy.
---

# Skills Audit

Perform a health check of the `.codex/skills/` directory and report findings.

## Steps

### 1. Inventory All Skills

Scan every subdirectory in `.codex/skills/`:

- List all directories
- For each directory, check if `SKILL.md` exists
- If `SKILL.md` is missing, flag as **BROKEN** (other filename is ignored by runtimes)

### 2. Validate Frontmatter

For each `SKILL.md`, read the file and verify:

- Has YAML frontmatter between `---` markers
- Contains a `name` field
- Contains a `description` field
- `description` is meaningful (not empty, not a placeholder)
- Flag as **INVALID** if frontmatter is missing or incomplete

### 3. Check for Stale References

Search each skill file for references to archived paths:

- `docs/authoritative/` → stale, should be `docs/current/` or `CLAUDE.md`
- Any path that no longer exists in the repo

For each stale reference, report the file, line number, and suggested replacement.

### 4. Check Skill Content Quality

For each `SKILL.md`:

- Line count — flag as **OVERSIZED** if > 500 lines (should move content to supporting files)
- Supporting files referenced in SKILL.md — verify they exist in the same directory
- Broken internal links — detect `[text](file.md)` where `file.md` doesn't exist

### 5. Detect Dead Skills

A skill is **potentially dead** if:

- It is a task skill (`disable-model-invocation: true`) and its content references
  features or modules that have been removed from the codebase
- Its description mentions concepts that no longer appear in `docs/current/`

Cross-check with `docs/current/api-modules.md` and `docs/current/frontend-modules.md`.

### 6. Detect Duplication with CLAUDE.md

Scan each skill for paragraphs that duplicate content already in `CLAUDE.md`.
Flag as **REDUNDANT** — duplicated content should be removed from the skill to keep the
single source of truth.

### 7. Report

Output a structured report:

```
SKILLS AUDIT REPORT
===================

BROKEN (missing SKILL.md):
  - .codex/skills/<dir>/   ← no SKILL.md found

INVALID (bad frontmatter):
  - .codex/skills/<name>/SKILL.md  ← missing: description

STALE REFERENCES:
  - .codex/skills/<name>/SKILL.md:12  docs/authoritative/design/rtl.md
    → replace with: docs/DESIGN_SYSTEM.md or CLAUDE.md

OVERSIZED (> 500 lines):
  - .codex/skills/<name>/SKILL.md  (623 lines)
    → move detail to <name>/reference.md

BROKEN SUPPORTING FILES:
  - .codex/skills/<name>/SKILL.md references missing.md (not found)

POTENTIALLY DEAD:
  - .codex/skills/<name>/  references removed module: <module>

REDUNDANT WITH CLAUDE.md:
  - .codex/skills/<name>/SKILL.md §3 duplicates CLAUDE.md §SignalStore pattern

HEALTHY:
  - .codex/skills/project-guardrails/  ✓
  - .codex/skills/project-index/       ✓
  ... (list all healthy skills)

SUMMARY: X broken, Y invalid, Z stale refs, W oversized, V healthy
```

### 8. Recommendations

After the report, suggest concrete actions:

- Which files to fix and how
- Which skills to consider deleting (if truly unused and not referenced anywhere)
- Whether any two skills should be consolidated

Do **not** make changes during the audit. Only report and recommend.
