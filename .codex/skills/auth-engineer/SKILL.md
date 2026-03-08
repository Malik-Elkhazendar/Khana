---
name: auth-engineer
description: >
  Authentication system implementation for Khana: JWT strategy, guards, decorators,
  Angular auth flow, interceptors, and route guards. Use when modifying or extending
  the authentication and authorization system.
---

# Auth Engineer — Authentication System

Implement and extend the Khana authentication system.

## Key References

- Architecture rules: `CLAUDE.md`
- Auth module: `apps/api/src/app/auth/`
- Security rules: `docs/security-secrets.md`
- Auth guards and decorators location: `apps/api/src/app/auth/decorators/`, `apps/api/src/app/auth/guards/`

---

## Backend Auth Architecture

### Auth Endpoints

```
POST /api/v1/auth/login
POST /api/v1/auth/register
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/change-password
POST /api/v1/auth/request-password-reset
POST /api/v1/auth/reset-password
```

### JWT Strategy

- **Access token:** 15 minutes
- **Refresh token:** 7 days
- **Algorithm:** HS256
- Secret from env (`JWT_SECRET`) — resolved via `apps/api/src/app/config/env-files.ts`

### Guard Usage Pattern

```ts
// Protect all routes in a controller:
@UseGuards(JwtAuthGuard)
@Controller({ path: 'resource', version: '1' })
export class ResourceController {}

// Role-restricted endpoint:
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER)
@Delete(':id')
remove(@Param('id') id: string) {}

// Public endpoint (no auth):
@Public()
@Post('login')
login(@Body() dto: LoginDto) {}
```

### Parameter Decorators

```ts
// Inject authenticated user:
@CurrentUser() user: User

// Inject tenant ID (from JWT or header):
@TenantId() tenantId: string
```

---

## Security Rules (Never Break)

- **Never** store passwords in plain text — use bcrypt, 12 rounds minimum
- **Never** log tokens, passwords, or raw secrets
- **Never** expose `passwordHash` in API responses
- **Always** validate JWT on every protected request
- **Always** scope data by `tenantId` after auth passes

---

## Frontend Auth Architecture

### File Locations

| Concern                  | Path                                                      |
| ------------------------ | --------------------------------------------------------- |
| Auth service             | `shared/services/auth.service.ts` (or `shared/services/`) |
| Auth store (SignalStore) | `shared/state/auth.store.ts`                              |
| Auth guard               | `shared/guards/auth.guard.ts`                             |
| Role guard               | `shared/guards/role.guard.ts`                             |
| Auth interceptor         | `shared/interceptors/`                                    |
| Login feature            | `features/auth/`                                          |

### Auth Interceptor Pattern

The interceptor attaches the JWT Bearer token to all API requests and handles 401 responses by redirecting to login.

### Auth Store Pattern

```ts
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    error: null,
  }),
  withMethods((store, authService = inject(AuthService)) => ({
    login: async (credentials: LoginDto): Promise<boolean> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(authService.login(credentials));
        patchState(store, { user: response.user, token: response.token, isAuthenticated: true });
        return true;
      } catch (err) {
        patchState(store, { error: resolveError(err) });
        return false;
      } finally {
        patchState(store, { loading: false });
      }
    },
    logout: () => {
      patchState(store, { user: null, token: null, isAuthenticated: false });
    },
  }))
);
```

---

## Implementation Checklist

### Backend Changes

- [ ] Modify `apps/api/src/app/auth/auth.service.ts`
- [ ] Update guards in `apps/api/src/app/auth/guards/`
- [ ] Update decorators in `apps/api/src/app/auth/decorators/`
- [ ] Add/update DTOs in `libs/shared-dtos/src/lib/dtos/`
- [ ] Unit test in `auth.service.spec.ts`

### Frontend Changes

- [ ] Modify `shared/services/auth.service.ts`
- [ ] Update `shared/state/auth.store.ts`
- [ ] Update guards if route protection changes
- [ ] Update interceptor if token handling changes
- [ ] Unit test store and service

---

## Start

Tell me what auth feature to implement or modify (e.g., "add invite-based registration", "extend role to include VIEWER", "implement refresh token rotation").
