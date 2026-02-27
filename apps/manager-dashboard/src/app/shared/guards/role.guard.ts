import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '@khana/shared-dtos';
import { catchError, map, of } from 'rxjs';
import { AuthStore } from '../state/auth.store';
import { AuthService } from '../services/auth.service';

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
    const authService = inject(AuthService);
    const router = inject(Router);

    const user = authStore.user();

    if (!user && !authStore.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }

    if (user) {
      if (allowedRoles.includes(user.role)) {
        return true;
      }

      // User doesn't have required role
      return router.createUrlTree(['/403']);
    }

    // User is authenticated but user profile is not hydrated yet
    return authService.getCurrentUser().pipe(
      map((currentUser) => {
        if (allowedRoles.includes(currentUser.role)) {
          return true;
        }

        return router.createUrlTree(['/403']);
      }),
      catchError(() => of(router.createUrlTree(['/login'])))
    );
  };
}
