# Doc Update Policy

When to update:

- API surface changes (endpoints, DTOs, error format, base URL).
- State ownership or store changes that affect UI/data boundaries.
- New auth or payments work (or changes to gaps listed in UNKNOWN).
- New apps/libs or target changes in Nx project.json files.

PR checklist:

- Update relevant topic docs and ADRs.
- Update UNKNOWN.md if gaps are confirmed or expanded.
- Keep ROOT.md under 100 lines and only include summary rules.
- Ensure ROUTER tags still point to minimal files.

UNKNOWN resolution:

- Move items to CONFIRMED only with file evidence.
- If a decision is made without implementation, mark PROPOSED and add ADR.
