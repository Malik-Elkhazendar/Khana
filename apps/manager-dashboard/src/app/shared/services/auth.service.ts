import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import {
  tap,
  catchError,
  finalize,
  map,
  shareReplay,
  switchMap,
} from 'rxjs/operators';
import {
  LoginDto,
  LoginResponseDto,
  CreateUserDto,
  UserDto,
  ChangePasswordDto,
} from '@khana/shared-dtos';
import { AuthStore } from '../state/auth.store';
import { environment } from '../../../environments/environment';

type ForgotPasswordResponse = {
  message: string;
};

type ResetPasswordResponse = {
  message: string;
};

type TenantContextResponse = {
  id: string;
  name: string;
};

/**
 * AuthService
 *
 * Handles all authentication-related HTTP operations.
 * Integrates with AuthStore for state management.
 * Manages token storage in sessionStorage.
 *
 * Token Storage:
 * - Access token: Short-lived (15 min), stored in sessionStorage
 * - Refresh token: Long-lived (7 days), stored in sessionStorage
 * - Cleared on browser close for security
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  private readonly API_BASE_URL = environment.apiBaseUrl.replace(/\/+$/, '');
  private readonly API_URL = `${this.API_BASE_URL}/v1/auth`;
  private readonly TOKEN_KEY = 'khana_access_token';
  private readonly REFRESH_TOKEN_KEY = 'khana_refresh_token';
  private readonly TENANT_KEY = 'khana_tenant_id';
  private readonly TENANT_HEADER = 'x-tenant-id';
  private readonly UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  private tenantContextRequest$?: Observable<string>;

  /**
   * Login with email and password
   */
  login(email: string, password: string): Observable<LoginResponseDto> {
    const dto: LoginDto = { email, password };

    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.resolveTenantHeaders().pipe(
      switchMap((headers) =>
        this.http.post<LoginResponseDto>(`${this.API_URL}/login`, dto, {
          headers,
        })
      ),
      tap((response) => {
        this.storeTokens(response.accessToken, response.refreshToken);
        this.storeTenantId(response.user?.tenantId);
        this.authStore.setUser(response.user);
        this.authStore.setAuthenticated(true);
        this.authStore.setLoading(false);
      }),
      catchError((error) => {
        const message = error.error?.message || 'Login failed';
        this.authStore.setError(message);
        this.authStore.setLoading(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Register a new user
   */
  register(dto: CreateUserDto): Observable<LoginResponseDto> {
    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.resolveTenantHeaders().pipe(
      switchMap((headers) =>
        this.http.post<LoginResponseDto>(`${this.API_URL}/register`, dto, {
          headers,
        })
      ),
      tap((response) => {
        this.storeTokens(response.accessToken, response.refreshToken);
        this.storeTenantId(response.user?.tenantId);
        this.authStore.setUser(response.user);
        this.authStore.setAuthenticated(true);
        this.authStore.setLoading(false);
      }),
      catchError((error) => {
        const message = error.error?.message || 'Registration failed';
        this.authStore.setError(message);
        this.authStore.setLoading(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Logout (invalidate tokens)
   */
  logout(): void {
    this.http
      .post(`${this.API_URL}/logout`, {}, { headers: this.getTenantHeaders() })
      .subscribe({
        next: () => {
          this.clearAuthState();
          this.router.navigate(['/login']);
        },
        error: () => {
          // Even if logout API fails, clear local state
          this.clearAuthState();
          this.router.navigate(['/login']);
        },
      });
  }

  /**
   * Refresh access token using refresh token
   */
  refreshToken(): Observable<LoginResponseDto> {
    const refreshToken = this.getRefreshToken();

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
        tap((response) => {
          this.storeTokens(response.accessToken, response.refreshToken);
          this.authStore.setAuthenticated(true);
        }),
        catchError((error) => {
          // Refresh failed, user needs to login again
          this.clearAuthState();
          this.router.navigate(['/login']);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get current user info
   */
  getCurrentUser(): Observable<UserDto> {
    return this.http
      .get<UserDto>(`${this.API_URL}/me`, { headers: this.getTenantHeaders() })
      .pipe(
        tap((user) => {
          this.storeTenantId(user.tenantId);
          this.authStore.setUser(user);
          this.authStore.setAuthenticated(true);
        }),
        catchError((error) => {
          this.clearAuthState();
          return throwError(() => error);
        })
      );
  }

  /**
   * Change password
   */
  changePassword(dto: ChangePasswordDto): Observable<void> {
    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.http
      .post<void>(`${this.API_URL}/change-password`, dto, {
        headers: this.getTenantHeaders(),
      })
      .pipe(
        tap(() => {
          this.authStore.setLoading(false);
        }),
        catchError((error) => {
          const message = error.error?.message || 'Password change failed';
          this.authStore.setError(message);
          this.authStore.setLoading(false);
          return throwError(() => error);
        })
      );
  }

  /**
   * Request password reset token.
   * Always returns a generic message for security.
   */
  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.resolveTenantHeaders().pipe(
      switchMap((headers) =>
        this.http.post<ForgotPasswordResponse>(
          `${this.API_URL}/forgot-password`,
          {
            email: email.trim(),
          },
          {
            headers,
          }
        )
      ),
      tap(() => {
        this.authStore.setLoading(false);
      }),
      catchError((error) => {
        const message = error.error?.message || 'Password reset request failed';
        this.authStore.setError(message);
        this.authStore.setLoading(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Reset password with one-time token.
   */
  resetPassword(
    token: string,
    newPassword: string
  ): Observable<ResetPasswordResponse> {
    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.resolveTenantHeaders().pipe(
      switchMap((headers) =>
        this.http.post<ResetPasswordResponse>(
          `${this.API_URL}/reset-password`,
          {
            token: token.trim(),
            newPassword,
          },
          {
            headers,
          }
        )
      ),
      tap(() => {
        this.authStore.setLoading(false);
      }),
      catchError((error) => {
        const message = error.error?.message || 'Password reset failed';
        this.authStore.setError(message);
        this.authStore.setLoading(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Restore session from stored tokens
   */
  restoreSession(): void {
    const token = this.getAccessToken();

    if (!token) {
      return;
    }

    // Mark as authenticated based on stored token
    this.authStore.setAuthenticated(true);

    // Fetch current user info to validate token
    this.getCurrentUser().subscribe({
      error: () => {
        // Token invalid, clear auth
        this.clearAuthState();
      },
    });
  }

  /**
   * Check if user is authenticated (has valid token)
   */
  isAuthenticated(): boolean {
    return this.authStore.isAuthenticated();
  }

  /**
   * Get access token from storage
   */
  getAccessToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Get refresh token from storage
   */
  getRefreshToken(): string | null {
    return sessionStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  // Private methods

  /**
   * Store tokens in sessionStorage
   */
  private storeTokens(accessToken: string, refreshToken: string): void {
    sessionStorage.setItem(this.TOKEN_KEY, accessToken);
    sessionStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  private resolveTenantHeaders(): Observable<HttpHeaders> {
    const tenantId = this.resolveTenantId();
    if (tenantId) {
      return of(this.buildTenantHeaders(tenantId));
    }

    return this.fetchTenantContext().pipe(
      map((resolvedTenantId) => this.buildTenantHeaders(resolvedTenantId))
    );
  }

  private getTenantHeaders(): HttpHeaders {
    const tenantId = this.resolveTenantId();

    if (!tenantId) {
      return new HttpHeaders();
    }

    return this.buildTenantHeaders(tenantId);
  }

  private buildTenantHeaders(tenantId: string): HttpHeaders {
    return new HttpHeaders({
      [this.TENANT_HEADER]: tenantId,
    });
  }

  private fetchTenantContext(): Observable<string> {
    if (this.tenantContextRequest$) {
      return this.tenantContextRequest$;
    }

    this.tenantContextRequest$ = this.http
      .get<TenantContextResponse>(`${this.API_URL}/tenant`)
      .pipe(
        map((tenant) => tenant?.id?.trim() ?? ''),
        map((tenantId) => {
          if (!this.isUuid(tenantId)) {
            throw new Error('Invalid tenant context received from API');
          }
          return tenantId;
        }),
        tap((tenantId) => {
          this.storeTenantId(tenantId);
        }),
        finalize(() => {
          this.tenantContextRequest$ = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );

    return this.tenantContextRequest$;
  }

  private resolveTenantId(): string {
    const fromStorage = sessionStorage.getItem(this.TENANT_KEY)?.trim() ?? '';
    if (this.isUuid(fromStorage)) {
      return fromStorage;
    }

    const fromEnv = environment.auth.tenantId?.trim() ?? '';
    if (this.isUuid(fromEnv)) {
      this.storeTenantId(fromEnv);
      return fromEnv;
    }

    const fromQuery = this.getTenantIdFromQueryParam();
    if (this.isUuid(fromQuery)) {
      this.storeTenantId(fromQuery);
      return fromQuery;
    }

    const fromHostname = this.getTenantIdFromHostname();
    if (this.isUuid(fromHostname)) {
      this.storeTenantId(fromHostname);
      return fromHostname;
    }

    return '';
  }

  private getTenantIdFromQueryParam(): string {
    const tenantId = new URLSearchParams(window.location.search).get(
      'tenantId'
    );
    return tenantId?.trim() ?? '';
  }

  private getTenantIdFromHostname(): string {
    const [subdomain] = window.location.hostname.split('.');
    return subdomain?.trim() ?? '';
  }

  private isUuid(value: string): boolean {
    return this.UUID_PATTERN.test(value);
  }

  private storeTenantId(tenantId?: string | null): void {
    const normalizedTenantId = tenantId?.trim() ?? '';
    if (!normalizedTenantId) {
      sessionStorage.removeItem(this.TENANT_KEY);
      return;
    }
    sessionStorage.setItem(this.TENANT_KEY, normalizedTenantId);
  }

  /**
   * Clear all auth state and storage
   */
  private clearAuthState(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(this.TENANT_KEY);
    this.tenantContextRequest$ = undefined;
    this.authStore.clearAuth();
  }
}
