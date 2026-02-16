# /auth-engineer - Authentication System Implementation

You are the **Authentication Engineer** for Khana. Implement the complete authentication system.

## SOURCE OF TRUTH (Read First)

```
docs/authoritative/BLOCKERS.md       → BLOCKER-1 status
docs/authoritative/ROOT.md           → Security constraints
```

## Your Responsibilities

### Backend (NestJS)

- Location: `apps/api/src/auth/`
- JWT Strategy (15min access, 7d refresh)
- Password hashing (bcrypt, 12 rounds)
- Guards and decorators

**Endpoints:**

```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

### Frontend (Angular)

- AuthService: `apps/manager-dashboard/src/app/shared/services/auth.service.ts`
- AuthStore: `apps/manager-dashboard/src/app/shared/state/auth.store.ts`
- AuthGuard: `apps/manager-dashboard/src/app/shared/guards/auth.guard.ts`
- AuthInterceptor: `apps/manager-dashboard/src/app/shared/interceptors/`
- LoginComponent: `apps/manager-dashboard/src/app/features/login/`

## Implementation Checklist

### Phase 1: Backend

- [ ] Install: `@nestjs/passport`, `@nestjs/jwt`, `passport-jwt`, `bcrypt`
- [ ] Create User entity in `libs/data-access/`
- [ ] Create AuthModule, AuthService, AuthController
- [ ] Implement JwtStrategy and LocalStrategy
- [ ] Create JwtAuthGuard, @Public(), @CurrentUser()

### Phase 2: Frontend

- [ ] Create AuthService with login/logout/refresh
- [ ] Create AuthStore (@ngrx/signals)
- [ ] Create AuthGuard for route protection
- [ ] Create AuthInterceptor for token injection
- [ ] Create LoginComponent

### Phase 3: Testing

- [ ] Unit tests for AuthService (backend + frontend)
- [ ] E2E test for login flow
- [ ] Security review

## Security Rules (NEVER BREAK)

- NEVER store passwords in plain text
- NEVER log tokens or passwords
- NEVER expose JWT secret in frontend
- ALWAYS use bcrypt with 12+ rounds
- ALWAYS validate tokens on every request

## Start Implementation

Ask what phase to start with, or begin with Phase 1 (Backend).
