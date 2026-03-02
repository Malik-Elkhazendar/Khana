# Khana Authoritative Sources (ROOT)

Purpose: Single source of truth for Khana. This is the only always-loaded file.
Use ROUTER tags to load topic docs on demand.

Project summary (evidence-based):
Khana is an Nx monorepo with an Angular manager-dashboard frontend, a NestJS API
backend, and shared libs for booking-engine, data-access, shared-dtos, and
shared-utils.

## CRITICAL: Decision-Making Framework

**BEFORE making ANY recommendation, the agent MUST:**

1. Load `strategic` tag to get DECISION_FRAMEWORK.md, ROADMAP.md, BLOCKERS.md
2. Check BLOCKERS.md for unresolved blockers
3. Apply DECISION_FRAMEWORK.md constraints (No Auth = No Production)
4. Reference ROADMAP.md for phase-appropriate recommendations

**Core Constraints (BLOCKING RULES):**

- Constraint 1: No Auth = No Production (BLOCKER 1 must resolve first)
- Constraint 2: No User ID = No Multi-Tenant Safety
- Constraint 3: No Permissions = No Role-Based Access
- Constraint 4: No Audit Trail = No Production (Compliance)

**Phase Gate System:**

- Phase 1 (Foundation): Auth, User DB, Permissions, Audit - MUST complete first
- Phase 2 (Features): booking-calendar/preview/list with auth integration
- Phase 3 (Advanced): Payments, Notifications, Analytics

Hard rules:

- Every factual statement must cite evidence (doc or code path). Otherwise mark
  UNKNOWN or PROPOSED.
- Do not assume auth, payments, or providers without code evidence.
- ROOT is the only always-loaded file. All other docs are pulled via ROUTER tags.
- If a conflict is found, record it in UNKNOWN and resolve via conflict order.
- NEVER recommend shipping features without checking BLOCKERS.md first.
- ALL recommendations must include blocker status and phase appropriateness.

Conflict resolution order:
Code evidence overrides docs when a mismatch exists. Any mismatch must be
recorded in UNKNOWN.md as STALE_DOC.

Router summary:
Use docs/authoritative/ROUTER.md. Core tags include api-client, env-config,
testing, state-store, auth, payments, booking-engine, dtos.
NEW: Strategic tags include decision-framework, roadmap, blockers, strategic.

Evidence:

- nx.json
- apps/manager-dashboard/project.json
- apps/api/project.json
- libs/booking-engine/project.json
- libs/data-access/project.json
- libs/shared-dtos/project.json
- libs/shared-utils/project.json
- docs/authoritative/DECISION_FRAMEWORK.md
- docs/authoritative/ROADMAP.md
- docs/authoritative/BLOCKERS.md
