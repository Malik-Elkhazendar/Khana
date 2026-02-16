import { TestBed } from '@angular/core/testing';
import { AuthStore } from './auth.store';
import {
  createMockUser,
  createOwnerUser,
  createStaffUser,
} from '../testing/fixtures/user.fixture';
import { UserRole } from '@khana/shared-dtos';

describe('AuthStore', () => {
  let store: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthStore],
    });

    store = TestBed.inject(AuthStore);
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      expect(store.user()).toBeNull();
      expect(store.isAuthenticated()).toBe(false);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
    });

    it('should compute isLoggedIn as false initially', () => {
      expect(store.isLoggedIn()).toBe(false);
    });

    it('should compute userName as empty string initially', () => {
      expect(store.userName()).toBe('');
    });

    it('should compute userRole as undefined initially', () => {
      expect(store.userRole()).toBeUndefined();
    });
  });

  describe('setUser', () => {
    it('should set user and mark as authenticated', () => {
      const mockUser = createMockUser();

      store.setUser(mockUser);

      expect(store.user()).toEqual(mockUser);
      expect(store.isAuthenticated()).toBe(true);
      expect(store.error()).toBeNull();
    });

    it('should clear user when set to null', () => {
      store.setUser(createMockUser());
      expect(store.user()).not.toBeNull();

      store.setUser(null);

      expect(store.user()).toBeNull();
      expect(store.isAuthenticated()).toBe(false);
    });

    it('should update computed userName', () => {
      const mockUser = createMockUser({ name: 'John Doe' });

      store.setUser(mockUser);

      expect(store.userName()).toBe('John Doe');
    });

    it('should update computed userRole', () => {
      const ownerUser = createOwnerUser();

      store.setUser(ownerUser);

      expect(store.userRole()).toBe(UserRole.OWNER);
    });

    it('should update computed isLoggedIn', () => {
      expect(store.isLoggedIn()).toBe(false);

      store.setUser(createMockUser());

      expect(store.isLoggedIn()).toBe(true);
    });
  });

  describe('setLoading', () => {
    it('should set loading to true', () => {
      store.setLoading(true);

      expect(store.isLoading()).toBe(true);
    });

    it('should set loading to false', () => {
      store.setLoading(true);
      store.setLoading(false);

      expect(store.isLoading()).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      const errorMessage = 'Authentication failed';

      store.setError(errorMessage);

      expect(store.error()).toBe(errorMessage);
    });

    it('should clear error message', () => {
      store.setError('Error');
      store.setError(null);

      expect(store.error()).toBeNull();
    });
  });

  describe('setAuthenticated', () => {
    it('should set authenticated to true', () => {
      store.setAuthenticated(true);

      expect(store.isAuthenticated()).toBe(true);
    });

    it('should set authenticated to false', () => {
      store.setAuthenticated(true);
      store.setAuthenticated(false);

      expect(store.isAuthenticated()).toBe(false);
    });
  });

  describe('clearAuth', () => {
    it('should reset all state to initial values', () => {
      // Set up some state
      store.setUser(createMockUser());
      store.setAuthenticated(true);
      store.setLoading(true);
      store.setError('Some error');

      // Clear auth
      store.clearAuth();

      // Verify all state is reset
      expect(store.user()).toBeNull();
      expect(store.isAuthenticated()).toBe(false);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
    });

    it('should update computed values after clear', () => {
      store.setUser(createMockUser());

      store.clearAuth();

      expect(store.isLoggedIn()).toBe(false);
      expect(store.userName()).toBe('');
      expect(store.userRole()).toBeUndefined();
    });
  });

  describe('computed signals', () => {
    describe('isLoggedIn', () => {
      it('should be true when user exists and authenticated', () => {
        store.setUser(createMockUser());
        store.setAuthenticated(true);

        expect(store.isLoggedIn()).toBe(true);
      });

      it('should be false when user exists but not authenticated', () => {
        store.setUser(createMockUser());
        store.setAuthenticated(false);

        expect(store.isLoggedIn()).toBe(false);
      });

      it('should be false when authenticated but no user', () => {
        store.setUser(null);
        store.setAuthenticated(true);

        expect(store.isLoggedIn()).toBe(false);
      });
    });

    describe('userName', () => {
      it('should return user name when user exists', () => {
        store.setUser(createMockUser({ name: 'Test User' }));

        expect(store.userName()).toBe('Test User');
      });

      it('should return empty string when user is null', () => {
        store.setUser(null);

        expect(store.userName()).toBe('');
      });
    });

    describe('userRole', () => {
      it('should return OWNER role', () => {
        store.setUser(createOwnerUser());

        expect(store.userRole()).toBe(UserRole.OWNER);
      });

      it('should return STAFF role', () => {
        store.setUser(createStaffUser());

        expect(store.userRole()).toBe(UserRole.STAFF);
      });

      it('should return undefined when user is null', () => {
        store.setUser(null);

        expect(store.userRole()).toBeUndefined();
      });
    });
  });

  describe('state transitions', () => {
    it('should handle login flow', () => {
      // Initial state
      expect(store.isLoggedIn()).toBe(false);

      // Start loading
      store.setLoading(true);
      expect(store.isLoading()).toBe(true);

      // Successful login
      store.setUser(createMockUser());
      store.setAuthenticated(true);
      store.setLoading(false);

      expect(store.isLoggedIn()).toBe(true);
      expect(store.isLoading()).toBe(false);
    });

    it('should handle logout flow', () => {
      // Setup authenticated state
      store.setUser(createMockUser());
      store.setAuthenticated(true);
      expect(store.isLoggedIn()).toBe(true);

      // Logout
      store.clearAuth();

      expect(store.isLoggedIn()).toBe(false);
      expect(store.user()).toBeNull();
    });

    it('should handle error flow', () => {
      // Start loading
      store.setLoading(true);

      // Error occurs
      store.setError('Login failed');
      store.setLoading(false);

      expect(store.error()).toBe('Login failed');
      expect(store.isLoading()).toBe(false);
      expect(store.isLoggedIn()).toBe(false);
    });
  });
});
