# UNKNOWN Registry

- id: FRONTEND_ENV_CONFIG
  status: UNKNOWN
  evidence_searched:

  - rg "environment" in apps/manager-dashboard (no results)
    next_action:
  - Check for src/environments/\* folder
  - Check Angular fileReplacements in project config

- id: API_BASE_URL_CONFIG
  status: PARTIAL
  evidence_searched:

  - apps/manager-dashboard/src/app/shared/services/api.service.ts (baseUrl)
    next_action: move base URL to environment config (see ADR-0004)

- id: AUTH_IMPLEMENTATION
  status: PARTIAL
  evidence_searched:

  - libs/shared-dtos/src/lib/dtos/user.dto.ts (LoginDto, LoginResponseDto)
  - libs/shared-dtos/src/lib/enums/user-role.enum.ts
  - rg "guard|interceptor" in apps (no results)
    next_action: confirm auth module, guards, interceptors, and token storage

- id: OPENAPI_SPEC
  status: UNKNOWN
  evidence_searched:

  - rg "@nestjs/swagger|Swagger" in apps (no results)
    next_action: confirm if an OpenAPI spec exists or generate one

- id: PAYMENT_PROVIDER
  status: PARTIAL
  evidence_searched:
  - libs/shared-dtos/src/lib/enums/payment-status.enum.ts
  - apps/api/src/app/bookings/bookings.service.ts (refund TODO)
    next_action: define provider and refund flow before enabling paid cancellations
