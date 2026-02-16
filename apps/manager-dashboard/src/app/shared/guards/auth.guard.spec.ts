import { TestBed } from '@angular/core/testing';
import {
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthStore } from '../state/auth.store';
import { setupStorageMock } from '../testing/mocks/storage.mock';

describe('authGuard', () => {
  let authStore: InstanceType<typeof AuthStore>;
  let router: Router;
  let storageMock: ReturnType<typeof setupStorageMock>;

  const mockRoute = {} as ActivatedRouteSnapshot;
  const createMockState = (url: string): RouterStateSnapshot =>
    ({ url } as RouterStateSnapshot);

  beforeEach(() => {
    storageMock = setupStorageMock();

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        {
          provide: Router,
          useValue: {
            navigate: jest.fn(),
            createUrlTree: jest.fn((commands: string[]) => commands),
          },
        },
      ],
    });

    authStore = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    storageMock.clear();
  });

  it('should allow navigation when user is authenticated', () => {
    authStore.setAuthenticated(true);
    const mockState = createMockState('/dashboard');

    const result = TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, mockState)
    );

    expect(result).toBe(true);
  });

  it('should redirect to login when user is not authenticated', () => {
    authStore.setAuthenticated(false);
    const mockState = createMockState('/dashboard');

    const result = TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, mockState)
    );

    expect(result).toEqual(['/login']);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('should store return URL in sessionStorage when redirecting', () => {
    authStore.setAuthenticated(false);
    const returnUrl = '/dashboard/bookings';
    const mockState = createMockState(returnUrl);

    TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(storageMock.getItem('returnUrl')).toBe(returnUrl);
  });

  it('should redirect to login for protected route', () => {
    authStore.setAuthenticated(false);
    const mockState = createMockState('/settings');

    const result = TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, mockState)
    );

    expect(result).not.toBe(true);
    expect(storageMock.getItem('returnUrl')).toBe('/settings');
  });

  it('should allow access to deep nested routes when authenticated', () => {
    authStore.setAuthenticated(true);
    const mockState = createMockState('/dashboard/bookings/123/edit');

    const result = TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, mockState)
    );

    expect(result).toBe(true);
  });

  it('should block access and store complex return URL', () => {
    authStore.setAuthenticated(false);
    const returnUrl = '/dashboard/bookings?status=confirmed&date=2024-01-15';
    const mockState = createMockState(returnUrl);

    TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(storageMock.getItem('returnUrl')).toBe(returnUrl);
  });
});
