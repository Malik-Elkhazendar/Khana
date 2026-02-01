import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '@khana/shared-dtos';
import { AuthStore } from '../state/auth.store';

/**
 * Role Guard Factory
 *
 * Functional route guard factory for role-based access control.
 *
 * Logic:
 * 1. Check if user is authenticated
 * 2. Check if user has required role
 * 3. If yes: Allow navigation
 * 4. If no: Redirect to /403 (forbidden)
 *
 * Usage: canActivate: [roleGuard([UserRole.OWNER, UserRole.MANAGER])]
 */
export function roleGuard(allowedRoles: UserRole[]): CanActivateFn {
  return () => {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    const user = authStore.user();

    if (!user) {
      return router.createUrlTree(['/login']);
    }

    if (allowedRoles.includes(user.role)) {
      return true;
    }

    // User doesn't have required role
    return router.createUrlTree(['/403']);
  };
}
