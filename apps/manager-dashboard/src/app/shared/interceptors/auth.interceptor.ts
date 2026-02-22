import {
  HttpInterceptorFn,
  HttpErrorResponse,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
  Observable,
  catchError,
  switchMap,
  throwError,
  finalize,
  map,
  shareReplay,
} from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Auth Interceptor
 *
 * Functional HTTP interceptor for JWT token management.
 *
 * Responsibilities:
 * 1. Inject Authorization header with Bearer token
 * 2. Handle 401 errors by refreshing token
 * 3. Prevent multiple simultaneous refresh requests
 * 4. Skip public auth endpoints (login, register, refresh, forgot/reset password)
 *
 * Pattern: Token Rotation
 * - Access token expires after 15 min
 * - Refresh token used to get new access token
 * - If refresh fails, logout and redirect to login
 */

let refreshTokenInFlight$: Observable<string> | null = null;

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);

  // Skip auth endpoints
  if (isAuthEndpoint(req.url)) {
    return next(req);
  }

  // Add Authorization header if token exists
  const token = authService.getAccessToken();
  if (token) {
    req = addTokenToRequest(req, token);
  }

  return next(req).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return handle401Error(req, next, authService);
      }

      return throwError(() => error);
    })
  );
};

/**
 * Handle 401 Unauthorized error with token refresh
 */
function handle401Error(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService
): Observable<HttpEvent<unknown>> {
  return getRefreshTokenInFlight(authService).pipe(
    switchMap((token) => next(addTokenToRequest(req, token))),
    catchError((error) => {
      // Refresh failed, service will logout and pending requests fail fast.
      return throwError(() => error);
    })
  );
}

function getRefreshTokenInFlight(authService: AuthService): Observable<string> {
  if (!refreshTokenInFlight$) {
    refreshTokenInFlight$ = authService.refreshToken().pipe(
      map((response) => response.accessToken),
      finalize(() => {
        refreshTokenInFlight$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
  }

  return refreshTokenInFlight$;
}

/**
 * Add Authorization header to request
 */
function addTokenToRequest(
  req: HttpRequest<unknown>,
  token: string
): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Check if URL is an auth endpoint (skip token injection)
 */
function isAuthEndpoint(url: string): boolean {
  const authEndpoints = [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];
  return authEndpoints.some((endpoint) => url.includes(endpoint));
}
