import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  convertToParamMap,
} from '@angular/router';
import { publicGuard } from './public.guard';
import { AuthStore } from '../state/auth.store';

describe('publicGuard', () => {
  let authStore: InstanceType<typeof AuthStore>;
  let router: Router;

  const createRoute = (
    path: string,
    queryParams: Record<string, string> = {}
  ): ActivatedRouteSnapshot =>
    ({
      routeConfig: { path },
      queryParamMap: convertToParamMap(queryParams),
    } as ActivatedRouteSnapshot);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        {
          provide: Router,
          useValue: {
            createUrlTree: jest.fn((commands: string[]) => commands),
          },
        },
      ],
    });

    authStore = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('redirects authenticated users away from public pages by default', () => {
    authStore.setAuthenticated(true);

    const result = TestBed.runInInjectionContext(() =>
      publicGuard(createRoute('login'))
    );

    expect(result).toEqual(['/dashboard']);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
  });

  it('allows login route in switch-account mode even when authenticated', () => {
    authStore.setAuthenticated(true);

    const result = TestBed.runInInjectionContext(() =>
      publicGuard(createRoute('login', { switch: '1' }))
    );

    expect(result).toBe(true);
  });

  it('still redirects authenticated users on non-login public routes', () => {
    authStore.setAuthenticated(true);

    const result = TestBed.runInInjectionContext(() =>
      publicGuard(createRoute('register', { switch: '1' }))
    );

    expect(result).toEqual(['/dashboard']);
  });

  it('allows unauthenticated users to access public routes', () => {
    authStore.setAuthenticated(false);

    const result = TestBed.runInInjectionContext(() =>
      publicGuard(createRoute('login'))
    );

    expect(result).toBe(true);
  });
});
