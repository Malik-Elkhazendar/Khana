# ADR-0004 API Base URL Configuration

Status: PROPOSED

Context:

- ApiService uses a hardcoded base URL.
- No frontend environment config file was found.

Decision:

- API base URL must come from environment configuration, not hardcoded values.

Consequences:

- Different environments can set API base URL without code changes.
- ApiService must read from environment config once implemented.

Evidence:

- apps/manager-dashboard/src/app/shared/services/api.service.ts (baseUrl)
- rg "environment" in apps/manager-dashboard (no results)
- apps/api/src/main.ts (process.env.PORT)
