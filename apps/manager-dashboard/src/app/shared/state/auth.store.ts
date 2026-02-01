import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { UserDto } from '@khana/shared-dtos';

/**
 * AuthStore
 *
 * Manages authentication state using @ngrx/signals.
 * Follows LayoutStore pattern for consistency.
 *
 * Responsibilities:
 * - Store user and token information
 * - Track loading and error states
 * - Provide authentication status
 * - Manage token lifecycle
 */

type AuthState = {
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
};

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ user, isAuthenticated }) => ({
    // Computed: Is user logged in
    isLoggedIn: computed(() => isAuthenticated() && user() !== null),

    // Computed: User display name
    userName: computed(() => user()?.name || ''),

    // Computed: User role
    userRole: computed(() => user()?.role),
  })),
  withMethods((store) => ({
    /**
     * Set user data
     */
    setUser(user: UserDto | null): void {
      patchState(store, {
        user,
        isAuthenticated: user !== null,
        error: null,
      });
    },

    /**
     * Set loading state
     */
    setLoading(isLoading: boolean): void {
      patchState(store, { isLoading });
    },

    /**
     * Set error message
     */
    setError(error: string | null): void {
      patchState(store, { error });
    },

    /**
     * Mark user as authenticated
     */
    setAuthenticated(isAuthenticated: boolean): void {
      patchState(store, { isAuthenticated });
    },

    /**
     * Clear all auth state (logout)
     */
    clearAuth(): void {
      patchState(store, {
        user: null,
        isAuthenticated: false,
        error: null,
        isLoading: false,
      });
    },
  }))
);
