import { EMPTY, Observable, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { LoginResponseDto, UserDto } from '@khana/shared-dtos';
import {
  AuthContextGuard,
  AuthServiceSharedLayer,
  STALE_AUTH_CONTEXT_ERROR,
} from './auth.service.shared';

/**
 * Session workflows coordinate refresh, logout, and session restoration.
 * They reuse the shared stale-context guard so background auth responses do not overwrite newer state.
 */
export abstract class AuthServiceSessionLayer extends AuthServiceSharedLayer {
  logout(): void {
    this.http
      .post(`${this.API_URL}/logout`, {}, { headers: this.getTenantHeaders() })
      .subscribe({
        next: () => {
          this.clearAuthState();
          this.router.navigate(['/login']);
        },
        error: () => {
          // Even if logout API fails, clear local state.
          this.clearAuthState();
          this.router.navigate(['/login']);
        },
      });
  }

  logoutAllDevices(): Observable<void> {
    return this.http.post<void>(
      `${this.API_URL}/logout-all-devices`,
      {},
      {
        headers: this.getTenantHeaders(),
      }
    );
  }

  refreshToken(): Observable<LoginResponseDto> {
    const refreshToken = this.getRefreshToken();
    const authContext = this.captureAuthContext({
      refreshToken,
    });

    if (!refreshToken) {
      this.clearAuthState();
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http
      .post<LoginResponseDto>(
        `${this.API_URL}/refresh`,
        { refreshToken },
        { headers: this.getTenantHeaders() }
      )
      .pipe(
        switchMap((response) => {
          if (!this.isAuthContextCurrent(authContext)) {
            this.logStaleAuthResponse('refresh', {
              hasRefreshToken: Boolean(refreshToken),
            });
            return throwError(() => new Error(STALE_AUTH_CONTEXT_ERROR));
          }

          this.storeTokens(response.accessToken, response.refreshToken);
          this.storeTenantId(response.user?.tenantId || response.tenant?.id);
          this.storeTenantTimeZone(response.tenant?.timezone);
          this.authStore.setAuthenticated(true);
          return of(response);
        }),
        catchError((error) => {
          if (
            this.isStaleAuthContextError(error) ||
            !this.isAuthContextCurrent(authContext)
          ) {
            this.logStaleAuthResponse('refresh_error', {
              hasRefreshToken: Boolean(refreshToken),
            });
            return throwError(() => error);
          }

          // Refresh failed, user needs to login again.
          this.clearAuthState();
          this.router.navigate(['/login']);
          return throwError(() => error);
        })
      );
  }

  getCurrentUser(authContext?: AuthContextGuard): Observable<UserDto> {
    return this.http
      .get<UserDto>(`${this.API_URL}/me`, { headers: this.getTenantHeaders() })
      .pipe(
        switchMap((user) => {
          if (authContext && !this.isAuthContextCurrent(authContext)) {
            this.logStaleAuthResponse('get_current_user', {
              userId: user.id,
            });
            return EMPTY;
          }

          this.storeTenantId(user.tenantId);
          this.authStore.setUser(user);
          this.authStore.setAuthenticated(true);
          return of(user);
        }),
        catchError((error) => {
          if (authContext && !this.isAuthContextCurrent(authContext)) {
            this.logStaleAuthResponse('get_current_user_error');
            return EMPTY;
          }

          this.clearAuthState();
          return throwError(() => error);
        })
      );
  }

  restoreSession(): void {
    const token = this.getAccessToken();

    if (!token) {
      return;
    }

    const authContext = this.captureAuthContext({ accessToken: token });

    // Mark as authenticated based on stored token.
    this.authStore.setAuthenticated(true);

    // Fetch current user info to validate token.
    this.getCurrentUser(authContext).subscribe();
  }

  beginAccountSwitch(): void {
    this.interactiveAuthRequestId += 1;
    sessionStorage.removeItem('returnUrl');
    this.clearAuthState();
  }
}
