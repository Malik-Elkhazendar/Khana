import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
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
export const publicGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const allowsAccountSwitch =
    route.routeConfig?.path === 'login' &&
    route.queryParamMap.get('switch') === '1';

  if (authStore.isAuthenticated() && !allowsAccountSwitch) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
