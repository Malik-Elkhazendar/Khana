import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthStore } from '../state/auth.store';

/**
 * Auth Guard
 *
 * Functional route guard to protect authenticated routes.
 *
 * Logic:
 * 1. Check if user is authenticated
 * 2. If yes: Allow navigation
 * 3. If no: Redirect to /login with returnUrl
 *
 * Usage: canActivate: [authGuard]
 */
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return true;
  }

  // Store redirect URL for post-login navigation
  sessionStorage.setItem('returnUrl', state.url);
  return router.createUrlTree(['/login']);
};
