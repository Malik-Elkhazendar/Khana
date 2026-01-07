# Environment Configuration

Policy:

- No hardcoded API base URLs in frontend code.
- Environment-specific values must live in configuration files.

Current implementation (observed):

- ApiService uses a hardcoded base URL.
- Backend reads PORT and DATABASE_URL from environment variables.

Required target (proposed):

- Frontend base URL must be injected via environment config.
- Backend continues using process.env for port and database settings.

Evidence:

- apps/manager-dashboard/src/app/shared/services/api.service.ts (baseUrl)
- apps/api/src/main.ts (process.env.PORT)
- apps/api/src/app/app.module.ts (process.env.DATABASE_URL)
