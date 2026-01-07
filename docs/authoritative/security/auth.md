# Authentication (NOT IMPLEMENTED)

Current evidence:

- DTOs exist for user and login payloads.
- No guards or interceptors were found in the apps.
- No token storage usage was found in frontend code.

Auth Implementation Gate (must be complete before claiming auth works):

- Backend auth module with guards.
- JWT validation and refresh flow.
- Frontend interceptor for auth headers.
- Token storage strategy (secure storage + rotation).
- Integration tests for login and protected routes.

Evidence:

- libs/shared-dtos/src/lib/dtos/user.dto.ts (LoginDto, LoginResponseDto)
- libs/shared-dtos/src/lib/enums/user-role.enum.ts
- rg "guard|interceptor" in apps (no results)
- rg "localStorage|sessionStorage" in apps (no results)
