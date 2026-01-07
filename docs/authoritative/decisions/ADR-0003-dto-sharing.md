# ADR-0003 DTO Sharing (Frontend and Backend)

Status: ACCEPTED

Context:

- Both frontend and backend import DTOs and enums from shared-dtos.

Decision:

- DTOs and enums live in libs/shared-dtos and are shared across apps.

Consequences:

- Single source of truth for API types.
- Fewer mismatches between client and server payloads.

Evidence:

- apps/manager-dashboard/src/app/shared/services/api.service.ts (@khana/shared-dtos)
- apps/api/src/app/bookings/dto/\*.ts (@khana/shared-dtos)
