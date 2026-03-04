---
name: feature-strategist
description: >
  Analyze the current Khana codebase and recommend the next feature to implement.
  Scans routes, features, state, and docs to assess what is complete, what is missing,
  and what should be built next with risk scoring and agent assignment.
# Claude Code extension:
disable-model-invocation: true
---

# Feature Strategist — What to Build Next

Analyze the codebase and produce a prioritized feature recommendation.

## Execution Steps

### 1. Scan Current Implementation

Read the following to understand what exists:

- `apps/manager-dashboard/src/app/app.routes.ts` — registered routes
- `apps/manager-dashboard/src/app/features/` — implemented feature components
- `apps/manager-dashboard/src/app/state/` — state stores
- `apps/api/src/app/` — backend modules
- `docs/current/api-modules.md` — current API module list
- `docs/current/frontend-modules.md` — current frontend module list

### 2. Identify Gaps

Compare what is implemented against what a booking SaaS platform needs:

- Auth and onboarding completeness
- Booking CRUD completeness
- Reporting and analytics depth
- Customer management
- Team/role management
- Settings and configuration
- Mobile/RTL readiness

### 3. Assess Risks

Score each candidate feature on these risk dimensions (higher weight = more caution):

| Risk Domain                         | Weight |
| ----------------------------------- | ------ |
| Authentication / Authorization      | 10     |
| Data integrity / Transactions       | 9      |
| Multi-tenancy isolation             | 9      |
| Security (XSS, injection, exposure) | 8      |
| Accessibility (RTL, WCAG)           | 7      |
| Performance / N+1 queries           | 5      |
| i18n completeness                   | 4      |

### 4. Output Recommendation

```yaml
recommendation:
  feature: '<Feature Name>'
  priority: HIGH | MEDIUM | LOW
  business_value: <1–10>
  technical_readiness: <1–10>

  current_state:
    implemented:
      - <list completed features>
    missing:
      - <list gaps>

  risks:
    - domain: '<Risk Domain>'
      level: HIGH | MEDIUM | LOW
      reason: '<Why this is a risk>'

  agent_assignment:
    primary: '/frontend-engineer or /api-engineer or /database-architect'
    supporting:
      - '/qa-engineer'
      - '<other if needed>'

  estimated_effort: '<S / M / L>' # S=hours, M=1-2 days, L=several days

  next_steps: 1. "<Concrete first action>"
    2. "<Second action>"
    3. "<Third action>"
```

### 5. Provide Alternatives

After the primary recommendation, list 2–3 alternative features with brief rationale for why they ranked lower.

---

## Available Skills to Assign

| Skill                 | When to assign                              |
| --------------------- | ------------------------------------------- |
| `/api-engineer`       | New endpoints, DTOs, service logic          |
| `/auth-engineer`      | Auth changes, role additions, guard updates |
| `/database-architect` | New entities, migrations, schema changes    |
| `/frontend-engineer`  | New components, pages, stores               |
| `/qa-engineer`        | Test coverage, E2E test plan                |

---

## Execute Now

Start by scanning the files listed in Step 1, then produce the recommendation.
