import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../state/auth.store';

/**
 * Public Guard
 *
 * Functional route guard for public pages (login, register).
 * Redirects authenticated users away from these pages.
 *
 * Logic:
 * 1. Check if user is authenticated
 * 2. If yes: Redirect to /dashboard
 * 3. If no: Allow navigation
 *
 * Usage: canActivate: [publicGuard]
 */
export const publicGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
