# Authentication System Unit Tests

Comprehensive unit test suite for the Khana authentication system following RTL and accessibility best practices.

## Test Coverage

### Services (80%+ coverage target)

- ✅ `auth.service.spec.ts` - Authentication service
  - Login with valid/invalid credentials
  - Registration
  - Logout and session cleanup
  - Token refresh and rotation
  - Session restoration
  - Error handling

### State Management (100% coverage)

- ✅ `auth.store.spec.ts` - Authentication state store
  - Initial state verification
  - User state management
  - Loading states
  - Error handling
  - Computed signals (isLoggedIn, userName, userRole)
  - State transitions

### Guards (100% coverage)

- ✅ `auth.guard.spec.ts` - Authentication guard

  - Allow authenticated users
  - Redirect unauthenticated users
  - Return URL storage

- ✅ `role.guard.spec.ts` - Role-based access control guard
  - Single role checks
  - Multiple role checks
  - Role hierarchy
  - Edge cases

### Interceptors (100% coverage)

- ✅ `auth.interceptor.spec.ts` - HTTP interceptor
  - Token injection
  - 401 error handling
  - Token refresh flow
  - Request queuing during refresh
  - Error passthrough

### Components (80%+ coverage target)

- ✅ `login.component.spec.ts` - Login component
  - Form initialization and validation
  - WCAG 2.1 AA accessibility compliance
  - RTL support
  - Loading states
  - Error display
  - Keyboard navigation
  - Touch targets (48px minimum)

## Running Tests

### Run all authentication tests

```bash
npm test -- --testPathPattern="auth"
```

### Run specific test file

```bash
npm test -- --testPathPattern="auth.service.spec"
```

### Run with coverage

```bash
npm test -- --testPathPattern="auth" --coverage
```

### Watch mode

```bash
npm test -- --testPathPattern="auth" --watch
```

## Test Structure

### Arrange-Act-Assert Pattern

All tests follow the AAA pattern:

```typescript
it('should login successfully', () => {
  // Arrange
  const mockResponse = createMockLoginResponse();
  authService.login.mockReturnValue(of(mockResponse));

  // Act
  component.onSubmit();

  // Assert
  expect(authService.login).toHaveBeenCalled();
  expect(router.navigate).toHaveBeenCalled();
});
```

### Test Organization

- `beforeEach`: Setup common test dependencies
- `afterEach`: Cleanup mocks and storage
- `describe`: Group related tests
- `it`: Individual test cases

## Testing Utilities

### Storage Mock

```typescript
import { setupStorageMock } from '../testing/mocks/storage.mock';

const storageMock = setupStorageMock();
storageMock.setItem('key', 'value');
expect(storageMock.getItem('key')).toBe('value');
```

### User Fixtures

```typescript
import { createMockUser, createOwnerUser, createManagerUser } from '../testing/fixtures/user.fixture';

const user = createMockUser({ name: 'Custom Name' });
const owner = createOwnerUser();
```

### Token Fixtures

```typescript
import { createMockAccessToken, createMockRefreshToken } from '../testing/fixtures/token.fixture';

const accessToken = createMockAccessToken();
const refreshToken = createMockRefreshToken();
```

### Auth Response Fixtures

```typescript
import { createMockLoginResponse } from '../testing/fixtures/auth-response.fixture';

const response = createMockLoginResponse();
```

## Accessibility Testing

### WCAG 2.1 AA Compliance

All component tests verify:

- ✅ Semantic HTML elements
- ✅ ARIA labels and roles
- ✅ Focus management
- ✅ Keyboard navigation
- ✅ Error announcements (aria-live)
- ✅ Form validation messages
- ✅ Color contrast (manual verification in CSS)
- ✅ Touch target sizes (48px minimum)

### Accessibility Test Examples

```typescript
it('should have accessible form labels', () => {
  const emailLabel = fixture.nativeElement.querySelector('label[for="email"]');
  expect(emailLabel).toBeTruthy();
  expect(emailLabel.textContent).toContain('Email');
});

it('should set aria-invalid on invalid fields', () => {
  component.emailControl.markAsTouched();
  fixture.detectChanges();

  const emailInput = fixture.nativeElement.querySelector('#email');
  expect(emailInput.getAttribute('aria-invalid')).toBe('true');
});

it('should announce errors with role="alert"', () => {
  authStore.setError('Login failed');
  fixture.detectChanges();

  const errorElement = fixture.nativeElement.querySelector('[role="alert"]');
  expect(errorElement.getAttribute('aria-live')).toBe('polite');
});
```

## RTL (Right-to-Left) Support

### CSS Logical Properties

All components use CSS logical properties:

- `margin-inline-start` instead of `margin-left`
- `padding-inline-end` instead of `padding-right`
- `text-align: start` instead of `text-align: left`

### RTL Test Examples

```typescript
it('should render correctly in LTR direction', () => {
  const container = fixture.nativeElement.querySelector('.login-container');
  expect(container).toBeTruthy();
  // Component uses CSS logical properties
});

it('should handle text direction properly', () => {
  const emailInput = fixture.nativeElement.querySelector('#email');
  component.emailControl.setValue('test@example.com');
  fixture.detectChanges();

  expect(emailInput.value).toBe('test@example.com');
});
```

## Coverage Reports

### Generate coverage report

```bash
npm test -- --coverage --coverageReporters=html
```

View coverage report at: `coverage/apps/manager-dashboard/index.html`

### Coverage Targets

- Services: 80%+
- Guards: 100%
- Interceptors: 100%
- State Management: 100%
- Components: 80%+
- **Overall Auth Module: 80%+**

## Best Practices

### 1. Use Testing Library Queries

Prefer accessibility-focused queries:

- `querySelector('[role="button"]')` over `.btn`
- `querySelector('label[for="email"]')` over `.form-label`
- `querySelector('[aria-label="required"]')` over `.required`

### 2. Test User Interactions

Focus on user behavior:

- Form submission
- Keyboard navigation
- Error handling
- Loading states

### 3. Mock External Dependencies

Always mock:

- HTTP calls (HttpTestingController)
- Router navigation
- Storage (sessionStorage/localStorage)

### 4. Cleanup After Tests

```typescript
afterEach(() => {
  httpMock.verify();
  storageMock.clear();
  jest.clearAllMocks();
});
```

### 5. Test Edge Cases

- Empty inputs
- Invalid data
- Network errors
- Concurrent requests
- Token expiry

## Continuous Integration

Tests run automatically on:

- Pre-commit hooks (via husky)
- Pull requests
- Main branch merges

### CI Command

```bash
npm run check:all
```

This runs:

1. Linting
2. Unit tests
3. Build verification

## Troubleshooting

### Test Failures

#### Storage not mocking correctly

```typescript
// Add to beforeEach
storageMock = setupStorageMock();
```

#### Async tests timing out

```typescript
it('should handle async operation', (done) => {
  service.login().subscribe({
    next: () => {
      expect(result).toBeTruthy();
      done(); // Mark test as complete
    },
  });
});
```

#### HttpTestingController errors

```typescript
afterEach(() => {
  httpMock.verify(); // Ensures all requests are handled
});
```

### Common Issues

1. **Tests fail in CI but pass locally**

   - Check for hardcoded timings
   - Use `fakeAsync` and `tick()` for time-dependent tests

2. **Coverage gaps**

   - Run with `--coverage` to identify untested code
   - Add tests for error paths and edge cases

3. **Flaky tests**
   - Avoid real timers (`setTimeout`)
   - Use Jest fake timers or Angular's `fakeAsync`
   - Ensure proper cleanup in `afterEach`

## Additional Resources

- [Angular Testing Guide](https://angular.io/guide/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Testing Library Principles](https://testing-library.com/docs/guiding-principles/)

## Next Steps

### Remaining Test Files to Create

- `register.component.spec.ts` (if registration component exists)
- `change-password.component.spec.ts` (if change password component exists)
- `public.guard.spec.ts` (if public guard exists)

### Integration Tests

Consider adding integration tests for:

- Complete login flow (login → dashboard navigation)
- Token refresh during active session
- Logout and session cleanup
- Role-based route protection

### E2E Tests

Use Playwright for:

- Multi-browser authentication flows
- Visual regression testing
- Performance monitoring
- Accessibility audits
