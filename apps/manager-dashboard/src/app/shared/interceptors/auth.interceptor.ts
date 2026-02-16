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
  BehaviorSubject,
  filter,
  take,
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

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

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
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap((response) => {
        isRefreshing = false;
        refreshTokenSubject.next(response.accessToken);
        return next(addTokenToRequest(req, response.accessToken));
      }),
      catchError((error) => {
        isRefreshing = false;
        // Refresh failed, service will logout
        return throwError(() => error);
      })
    );
  } else {
    // Wait for refresh to complete, then retry
    return refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => {
        return next(addTokenToRequest(req, token!));
      })
    );
  }
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
