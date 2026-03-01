import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '@khana/shared-dtos';
import { catchError, map, of } from 'rxjs';
import { AuthStore } from '../state/auth.store';
import { AuthService } from '../services/auth.service';

type OnboardingGuardMode = 'requireIncomplete' | 'requireComplete';

function resolveNavigation(
  mode: OnboardingGuardMode,
  user: { role: UserRole; onboardingCompleted: boolean },
  router: Router
) {
  const isOwner = user.role === UserRole.OWNER;
  const isCompleted = user.onboardingCompleted;

  if (mode === 'requireIncomplete') {
    if (!isOwner || isCompleted) {
      return router.createUrlTree(['/dashboard']);
    }
    return true;
  }

  if (isOwner && !isCompleted) {
    return router.createUrlTree(['/onboarding']);
  }
  return true;
}

export function onboardingGuard(mode: OnboardingGuardMode): CanActivateFn {
  return () => {
    const authStore = inject(AuthStore);
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authStore.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }

    const user = authStore.user();
    if (user) {
      return resolveNavigation(mode, user, router);
    }

    return authService.getCurrentUser().pipe(
      map((currentUser) => resolveNavigation(mode, currentUser, router)),
      catchError(() => of(router.createUrlTree(['/login'])))
    );
  };
}
