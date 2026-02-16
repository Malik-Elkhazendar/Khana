import { TestBed } from '@angular/core/testing';
import {
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthStore } from '../state/auth.store';
import { UserRole } from '@khana/shared-dtos';
import {
  createOwnerUser,
  createManagerUser,
  createStaffUser,
  createViewerUser,
} from '../testing/fixtures/user.fixture';

describe('roleGuard', () => {
  let authStore: InstanceType<typeof AuthStore>;
  let router: Router;

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = {} as RouterStateSnapshot;

  beforeEach(() => {
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

  describe('single role check', () => {
    it('should allow access when user has required role', () => {
      const ownerUser = createOwnerUser();
      authStore.setUser(ownerUser);

      const guard = roleGuard([UserRole.OWNER]);
      const result = TestBed.runInInjectionContext(() =>
        guard(mockRoute, mockState)
      );

      expect(result).toBe(true);
    });

    it('should deny access when user does not have required role', () => {
      const staffUser = createStaffUser();
      authStore.setUser(staffUser);

      const guard = roleGuard([UserRole.OWNER]);
      const result = TestBed.runInInjectionContext(() =>
        guard(mockRoute, mockState)
      );

      expect(result).toEqual(['/403']);
      expect(router.createUrlTree).toHaveBeenCalledWith(['/403']);
    });

    it('should redirect to login when no user exists', () => {
      authStore.setUser(null);

      const guard = roleGuard([UserRole.OWNER]);
      const result = TestBed.runInInjectionContext(() =>
        guard(mockRoute, mockState)
      );

      expect(result).toEqual(['/login']);
      expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('multiple roles check', () => {
    it('should allow access when user has one of multiple required roles', () => {
      const managerUser = createManagerUser();
      authStore.setUser(managerUser);

      const guard = roleGuard([UserRole.OWNER, UserRole.MANAGER]);
      const result = TestBed.runInInjectionContext(() =>
        guard(mockRoute, mockState)
      );

      expect(result).toBe(true);
    });

    it('should allow OWNER access to OWNER or MANAGER route', () => {
      const ownerUser = createOwnerUser();
      authStore.setUser(ownerUser);

      const guard = roleGuard([UserRole.OWNER, UserRole.MANAGER]);
      const result = TestBed.runInInjectionContext(() =>
        guard(mockRoute, mockState)
      );

      expect(result).toBe(true);
    });

    it('should deny STAFF access to OWNER or MANAGER only route', () => {
      const staffUser = createStaffUser();
      authStore.setUser(staffUser);

      const guard = roleGuard([UserRole.OWNER, UserRole.MANAGER]);
      const result = TestBed.runInInjectionContext(() =>
        guard(mockRoute, mockState)
      );

      expect(result).toEqual(['/403']);
    });

    it('should deny VIEWER access to all action routes', () => {
      const viewerUser = createViewerUser();
      authStore.setUser(viewerUser);

      const guard = roleGuard([
        UserRole.OWNER,
        UserRole.MANAGER,
        UserRole.STAFF,
      ]);
      const result = TestBed.runInInjectionContext(() =>
        guard(mockRoute, mockState)
      );

      expect(result).toEqual(['/403']);
    });
  });

  describe('all roles check', () => {
    it('should allow any authenticated user when all roles are allowed', () => {
      const staffUser = createStaffUser();
      authStore.setUser(staffUser);

      const guard = roleGuard([
        UserRole.OWNER,
        UserRole.MANAGER,
        UserRole.STAFF,
        UserRole.VIEWER,
      ]);
      const result = TestBed.runInInjectionContext(() =>
        guard(mockRoute, mockState)
      );

      expect(result).toBe(true);
    });
  });

  describe('role hierarchy scenarios', () => {
    it('should allow OWNER access to all routes', () => {
      const ownerUser = createOwnerUser();
      authStore.setUser(ownerUser);

      const testCases = [
        [UserRole.OWNER],
        [UserRole.MANAGER],
        [UserRole.STAFF],
        [UserRole.VIEWER],
        [UserRole.OWNER, UserRole.MANAGER],
      ];

      testCases.forEach((roles) => {
        const guard = roleGuard(roles);
        const result = TestBed.runInInjectionContext(() =>
          guard(mockRoute, mockState)
        );

        expect(result).toBe(true);
      });
    });

    it('should restrict VIEWER to viewer-only routes', () => {
      const viewerUser = createViewerUser();
      authStore.setUser(viewerUser);

      // Should pass viewer check
      const viewerGuard = roleGuard([UserRole.VIEWER]);
      const viewerResult = TestBed.runInInjectionContext(() =>
        viewerGuard(mockRoute, mockState)
      );
      expect(viewerResult).toBe(true);

      // Should fail other role checks
      const managerGuard = roleGuard([UserRole.MANAGER]);
      const managerResult = TestBed.runInInjectionContext(() =>
        managerGuard(mockRoute, mockState)
      );
      expect(managerResult).toEqual(['/403']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty roles array', () => {
      const ownerUser = createOwnerUser();
      authStore.setUser(ownerUser);

      const guard = roleGuard([]);
      const result = TestBed.runInInjectionContext(() =>
        guard(mockRoute, mockState)
      );

      expect(result).toEqual(['/403']);
    });

    it('should redirect to login when user becomes null', () => {
      authStore.setUser(createOwnerUser());
      authStore.setUser(null);

      const guard = roleGuard([UserRole.OWNER]);
      const result = TestBed.runInInjectionContext(() =>
        guard(mockRoute, mockState)
      );

      expect(result).toEqual(['/login']);
    });
  });
});
