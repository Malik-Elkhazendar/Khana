# Phase 1 Authentication: Quick Reference Guide

**For**: Development team implementing PHASE_1_AUTH_IMPLEMENTATION_PROMPT.md
**Length**: ~30 min read
**Purpose**: File locations, command reference, key patterns, gotchas

---

## FILE STRUCTURE CHECKLIST

### Backend Files (NestJS)

```
apps/api/src/app/auth/
├── auth.module.ts                    # Module with imports
├── auth.service.ts                   # Core: register, login, refresh
├── auth.controller.ts                # Endpoints: /register, /login, /refresh
├── services/
│   ├── password.service.ts           # Bcrypt: hash(), verify()
│   └── jwt.service.ts                # JWT: generateTokenPair(), verify*()
├── strategies/
│   └── jwt.strategy.ts               # Passport JWT strategy
├── guards/
│   ├── jwt-auth.guard.ts             # @UseGuards(JwtAuthGuard)
│   ├── roles.guard.ts                # @UseGuards(RolesGuard)
│   └── optional-jwt.guard.ts         # For @Public() endpoints
├── decorators/
│   └── auth.decorators.ts            # @Public(), @Roles(), @CurrentUser()
├── dto/
│   └── auth.dto.ts                   # Request/response DTOs
└── __tests__/
    ├── auth.service.spec.ts
    ├── auth.controller.spec.ts
    └── guards.spec.ts

apps/api/src/migrations/
├── CreateUserTable.ts                # users table
├── CreateAuditLogTable.ts            # audit_logs table
└── AddUserToBooking.ts               # user_id FK to bookings
```

### Frontend Files (Angular)

```
apps/manager-dashboard/src/app/
├── state/auth/
│   └── auth.store.ts                 # SignalStore: user, tokens, isAuth
├── shared/
│   ├── services/
│   │   └── auth.service.ts           # HTTP: login(), logout(), refresh()
│   ├── interceptors/
│   │   └── auth.interceptor.ts       # Token injection + 401 refresh
│   └── guards/
│       ├── auth.guard.ts             # Route guard: @CanActivate
│       ├── public.guard.ts           # Redirect authed users away
│       └── role.guard.ts             # @CanActivate with role check
└── features/
    └── login/
        └── login.component.ts        # Standalone login form
```

### Database Files

```
libs/data-access/src/lib/
├── entities/
│   ├── user.entity.ts                # NEW: User with bcrypt
│   ├── audit-log.entity.ts           # NEW: Immutable audit trail
│   ├── booking.entity.ts             # MODIFY: Add user FK
│   └── tenant.entity.ts              # EXISTING
└── migrations/
    ├── CreateUserTable.ts
    ├── CreateAuditLogTable.ts
    └── AddUserToBooking.ts
```

---

## COMMAND REFERENCE

### Installation

```bash
npm install @nestjs/passport @nestjs/jwt passport passport-jwt bcrypt
npm install --save-dev @types/bcrypt @types/passport-jwt
```

### Database Migrations

```bash
npm run typeorm migration:create -- apps/api/src/migrations/CreateUserTable
npm run typeorm migration:run
npm run typeorm migration:revert
```

### Testing

```bash
npm test apps/api -- auth
npm test apps/manager-dashboard -- auth
npm test -- --coverage
```

---

## KEY PATTERNS

### Password Hashing

```typescript
const hashedPassword = await passwordService.hash(plaintext);
const isValid = await passwordService.verify(providedPassword, hashedPassword);
```

### JWT Token Generation

```typescript
const { accessToken, refreshToken } = jwtService.generateTokenPair(payload);
```

### Guard Decorator

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
async adminAction(@CurrentUser() user: User) { }
```

### Route Protection

```typescript
{
  path: 'dashboard',
  component: Dashboard,
  canActivate: [authGuard],
}
```

---

## SECURITY CHECKLIST

Backend:

- [ ] JWT_SECRET is strong (32+ chars)
- [ ] Passwords hashed (not plaintext)
- [ ] All routes have guards
- [ ] Roles checked
- [ ] Tenant ID in queries
- [ ] Error messages safe

Frontend:

- [ ] Tokens in sessionStorage
- [ ] No tokens in console logs
- [ ] Interceptor on 401
- [ ] Route guards

---

## PERFORMANCE TARGETS

| Operation  | Target |
| ---------- | ------ |
| Register   | <500ms |
| Login      | <500ms |
| Refresh    | <100ms |
| JWT Verify | <10ms  |

---

## COMMON ERRORS

| Error                                 | Fix                                  |
| ------------------------------------- | ------------------------------------ |
| Cannot find module '@nestjs/passport' | `npm install @nestjs/passport`       |
| Duplicate unique constraint           | Email exists, use different email    |
| CORS error on login                   | Add frontend URL to app.enableCors() |
| Token not in header                   | Check "Bearer <token>" format        |
| Interceptor not firing                | Verify HttpClientModule imported     |

---

## PHASE 1 DEFINITION OF DONE

✅ All backend files created
✅ All frontend files created
✅ 50+ backend tests passing
✅ End-to-end flow working
✅ Security audit passed
✅ No exposed secrets
✅ Database migrations executable
✅ Deployment guide ready

---

**Status**: Complete
**Document**: PHASE_1_AUTH_IMPLEMENTATION_PROMPT.md
**Ready**: Yes - Hand to team immediately
