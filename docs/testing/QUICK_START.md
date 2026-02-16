# Authentication Tests - Quick Start Guide

## Run All Auth Tests

```bash
npm test -- --testPathPattern="auth"
```

## Run Specific Test File

```bash
# Service tests
npm test -- --testPathPattern="auth.service.spec"

# Store tests
npm test -- --testPathPattern="auth.store.spec"

# Guard tests
npm test -- --testPathPattern="auth.guard.spec"
npm test -- --testPathPattern="role.guard.spec"

# Interceptor tests
npm test -- --testPathPattern="auth.interceptor.spec"

# Component tests
npm test -- --testPathPattern="login.component.spec"
```

## Coverage Report

```bash
npm test -- --testPathPattern="auth" --coverage
```

View at: `coverage/apps/manager-dashboard/index.html`

## Watch Mode (Development)

```bash
npm test -- --testPathPattern="auth" --watch
```

## CI/CD Pipeline

```bash
npm run check:all
```

## Test Statistics

- **Total Tests**: 113
- **Test Files**: 7
- **Coverage Target**: 80%+

## File Locations

```
apps/manager-dashboard/src/app/
├── shared/
│   ├── services/auth.service.spec.ts
│   ├── state/auth.store.spec.ts
│   ├── guards/
│   │   ├── auth.guard.spec.ts
│   │   └── role.guard.spec.ts
│   └── interceptors/auth.interceptor.spec.ts
└── features/auth/login/login.component.spec.ts
```

## Need Help?

See full documentation: `docs/testing/AUTH_TESTS_README.md`
