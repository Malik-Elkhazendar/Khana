import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { EMPTY, Observable, of, throwError } from 'rxjs';
import {
  tap,
  catchError,
  finalize,
  map,
  shareReplay,
  switchMap,
} from 'rxjs/operators';
import {
  DEFAULT_TENANT_TIMEZONE,
  LoginDto,
  LoginResponseDto,
  CreateUserDto,
  OwnerSignupDto,
  TenantResolveResponseDto,
  normalizeIanaTimeZone,
  UserDto,
  ChangePasswordDto,
} from '@khana/shared-dtos';
import { AuthStore } from '../state/auth.store';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';
import { FacilityContextStore } from '../state';
import { AnalyticsStore } from '../../state/analytics/analytics.store';
import { BookingStore } from '../../state/bookings/booking.store';
import { DashboardStore } from '../../state/dashboard/dashboard.store';

type ForgotPasswordResponse = {
  message: string;
};

type ResetPasswordResponse = {
  message: string;
};

type TenantContextResponse = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

type AuthContextGuard = {
  accessToken?: string | null;
  refreshToken?: string | null;
  version: number;
};

const STALE_AUTH_CONTEXT_ERROR = 'STALE_AUTH_CONTEXT';

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
  private readonly logger = inject(LoggerService, { optional: true });
  private readonly facilityContext = inject(FacilityContextStore, {
    optional: true,
  });
  private readonly analyticsStore = inject(AnalyticsStore, { optional: true });
  private readonly bookingStore = inject(BookingStore, { optional: true });
  private readonly dashboardStore = inject(DashboardStore, { optional: true });

  private readonly API_BASE_URL = environment.apiBaseUrl.replace(/\/+$/, '');
  private readonly API_URL = `${this.API_BASE_URL}/v1/auth`;
  private readonly TOKEN_KEY = 'khana_access_token';
  private readonly REFRESH_TOKEN_KEY = 'khana_refresh_token';
  private readonly TENANT_KEY = 'khana_tenant_id';
  private readonly TENANT_TIMEZONE_KEY = 'khana_tenant_timezone';
  private readonly TENANT_HEADER = 'x-tenant-id';
  private readonly WORKSPACE_QUERY_PARAM = 'workspace';
  private readonly UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  private readonly WORKSPACE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  private tenantContextRequest$?: Observable<string>;
  private authContextVersion = 0;
  private interactiveAuthRequestId = 0;
  readonly tenantTimeZone = signal(this.readTenantTimeZoneFromStorage());

  /**
   * Login with email and password
   */
  login(email: string, password: string): Observable<LoginResponseDto> {
    const dto: LoginDto = { email, password };
    const requestId = this.beginInteractiveAuthRequest();

    return this.resolveLoginHeaders().pipe(
      switchMap((headers) =>
        this.http.post<LoginResponseDto>(`${this.API_URL}/login`, dto, {
          headers,
        })
      ),
      switchMap((response) => {
        if (!this.isLatestInteractiveAuthRequest(requestId)) {
          this.logStaleAuthResponse('login', {
            requestId,
            email,
          });
          return EMPTY;
        }

        this.storeTokens(response.accessToken, response.refreshToken);
        this.storeTenantId(response.user?.tenantId);
        this.storeTenantTimeZone(response.tenant?.timezone);
        this.authStore.setUser(response.user);
        this.authStore.setAuthenticated(true);
        this.authStore.setLoading(false);
        return of(response);
      }),
      catchError((error) => {
        if (!this.isLatestInteractiveAuthRequest(requestId)) {
          this.logStaleAuthResponse('login_error', {
            requestId,
            email,
          });
          return EMPTY;
        }

        const backendMessage = error.error?.message;
        const message =
          backendMessage === 'Tenant ID is required'
            ? 'Workspace is required. Please use your workspace login link.'
            : backendMessage || 'Login failed';
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
    const requestId = this.beginInteractiveAuthRequest();

    return this.resolveTenantHeaders().pipe(
      switchMap((headers) =>
        this.http.post<LoginResponseDto>(`${this.API_URL}/register`, dto, {
          headers,
        })
      ),
      switchMap((response) => {
        if (!this.isLatestInteractiveAuthRequest(requestId)) {
          this.logStaleAuthResponse('register', {
            requestId,
            email: dto.email,
          });
          return EMPTY;
        }

        this.storeTokens(response.accessToken, response.refreshToken);
        this.storeTenantId(response.user?.tenantId);
        this.storeTenantTimeZone(response.tenant?.timezone);
        this.authStore.setUser(response.user);
        this.authStore.setAuthenticated(true);
        this.authStore.setLoading(false);
        return of(response);
      }),
      catchError((error) => {
        if (!this.isLatestInteractiveAuthRequest(requestId)) {
          this.logStaleAuthResponse('register_error', {
            requestId,
            email: dto.email,
          });
          return EMPTY;
        }

        const message = error.error?.message || 'Registration failed';
        this.authStore.setError(message);
        this.authStore.setLoading(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Create a new workspace and bootstrap the owner account.
   */
  signupOwner(dto: OwnerSignupDto): Observable<LoginResponseDto> {
    const requestId = this.beginInteractiveAuthRequest();

    return this.http
      .post<LoginResponseDto>(`${this.API_URL}/signup-owner`, dto)
      .pipe(
        switchMap((response) => {
          if (!this.isLatestInteractiveAuthRequest(requestId)) {
            this.logStaleAuthResponse('signup_owner', {
              requestId,
              email: dto.email,
            });
            return EMPTY;
          }

          this.storeTokens(response.accessToken, response.refreshToken);
          this.storeTenantId(response.user?.tenantId || response.tenant?.id);
          this.storeTenantTimeZone(response.tenant?.timezone);
          this.authStore.setUser(response.user);
          this.authStore.setAuthenticated(true);
          this.authStore.setLoading(false);
          return of(response);
        }),
        catchError((error) => {
          if (!this.isLatestInteractiveAuthRequest(requestId)) {
            this.logStaleAuthResponse('signup_owner_error', {
              requestId,
              email: dto.email,
            });
            return EMPTY;
          }

          const message = error.error?.message || 'Workspace signup failed';
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
   * Logout all other devices for the current user.
   */
  logoutAllDevices(): Observable<void> {
    return this.http.post<void>(
      `${this.API_URL}/logout-all-devices`,
      {},
      {
        headers: this.getTenantHeaders(),
      }
    );
  }

  /**
   * Refresh access token using refresh token
   */
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

  /**
   * Resolve tenant context from API.
   */
  getTenantContext(): Observable<TenantContextResponse> {
    return this.http
      .get<TenantContextResponse>(`${this.API_URL}/tenant`, {
        headers: this.getTenantHeaders(),
      })
      .pipe(
        tap((tenant) => {
          this.storeTenantId(tenant?.id);
          this.storeTenantTimeZone(tenant?.timezone);
        })
      );
  }

  getTenantTimeZone(): string {
    const fromStorage = this.readTenantTimeZoneFromStorage();
    if (fromStorage !== this.tenantTimeZone()) {
      this.tenantTimeZone.set(fromStorage);
    }
    return this.tenantTimeZone();
  }

  setTenantTimeZone(timeZone?: string | null): void {
    this.storeTenantTimeZone(timeZone);
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

    const authContext = this.captureAuthContext({ accessToken: token });

    // Mark as authenticated based on stored token
    this.authStore.setAuthenticated(true);

    // Fetch current user info to validate token
    this.getCurrentUser(authContext).subscribe();
  }

  beginAccountSwitch(): void {
    this.interactiveAuthRequestId += 1;
    sessionStorage.removeItem('returnUrl');
    this.clearAuthState();
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
    this.authContextVersion += 1;
    sessionStorage.setItem(this.TOKEN_KEY, accessToken);
    sessionStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  private resolveTenantHeaders(): Observable<HttpHeaders> {
    const tenantId = this.getTenantIdFromStorage();
    if (tenantId) {
      return of(this.buildTenantHeaders(tenantId));
    }

    return this.resolveTenantId().pipe(
      map((resolvedTenantId) => this.buildTenantHeaders(resolvedTenantId))
    );
  }

  private resolveLoginHeaders(): Observable<HttpHeaders> {
    const workspaceSlug = this.getWorkspaceSlugFromQueryParam();
    if (this.isWorkspaceSlug(workspaceSlug)) {
      return this.resolveTenantByWorkspaceSlug(workspaceSlug).pipe(
        map((resolvedTenantId) => this.buildTenantHeaders(resolvedTenantId))
      );
    }

    // Allow backend email-based tenant resolution on login when no tenant hints exist.
    return of(new HttpHeaders());
  }

  private getTenantHeaders(): HttpHeaders {
    const tenantId = this.getTenantIdFromStorage();

    if (!tenantId) {
      return new HttpHeaders();
    }

    return this.buildTenantHeaders(tenantId);
  }

  private resolveTenantId(): Observable<string> {
    const fromStorage = this.getTenantIdFromStorage();
    if (fromStorage) {
      return of(fromStorage);
    }

    const workspaceSlug = this.getWorkspaceSlugFromQueryParam();
    if (this.isWorkspaceSlug(workspaceSlug)) {
      return this.resolveTenantByWorkspaceSlug(workspaceSlug);
    }

    const fromLegacyHints = this.resolveTenantIdFromLegacyHints();
    if (fromLegacyHints) {
      this.storeTenantId(fromLegacyHints);
      return of(fromLegacyHints);
    }

    return this.fetchTenantContext();
  }

  private resolveTenantByWorkspaceSlug(
    workspaceSlug: string
  ): Observable<string> {
    const normalizedWorkspace = workspaceSlug.trim().toLowerCase();

    return this.http
      .get<TenantResolveResponseDto>(`${this.API_URL}/tenant/resolve`, {
        params: { slug: normalizedWorkspace },
      })
      .pipe(
        tap((tenant) => {
          this.storeTenantTimeZone(tenant?.timezone);
        }),
        map((tenant) => tenant?.id?.trim() ?? ''),
        map((tenantId) => {
          if (!this.isUuid(tenantId)) {
            throw new Error('Invalid tenant context received from API');
          }
          return tenantId;
        }),
        tap((tenantId) => {
          this.storeTenantId(tenantId);
        })
      );
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
        tap((tenant) => {
          this.storeTenantTimeZone(tenant?.timezone);
        }),
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

  private getTenantIdFromStorage(): string {
    const fromStorage = sessionStorage.getItem(this.TENANT_KEY)?.trim() ?? '';
    if (this.isUuid(fromStorage)) {
      return fromStorage;
    }
    return '';
  }

  private resolveTenantIdFromLegacyHints(): string {
    const fromEnv = environment.auth.tenantId?.trim() ?? '';
    if (this.isUuid(fromEnv)) {
      return fromEnv;
    }

    const fromQuery = this.getTenantIdFromQueryParam();
    if (this.isUuid(fromQuery)) {
      this.storeTenantId(fromQuery);
      return fromQuery;
    }

    const fromHostname = this.getTenantIdFromHostname();
    if (this.isUuid(fromHostname)) {
      return fromHostname;
    }

    return '';
  }

  private getWorkspaceSlugFromQueryParam(): string {
    const workspace = new URLSearchParams(window.location.search).get(
      this.WORKSPACE_QUERY_PARAM
    );
    return workspace?.trim().toLowerCase() ?? '';
  }

  private isWorkspaceSlug(value: string): boolean {
    return this.WORKSPACE_SLUG_PATTERN.test(value);
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

  private readTenantTimeZoneFromStorage(): string {
    const raw = sessionStorage.getItem(this.TENANT_TIMEZONE_KEY)?.trim() ?? '';
    return raw ? normalizeIanaTimeZone(raw) : DEFAULT_TENANT_TIMEZONE;
  }

  private storeTenantTimeZone(timeZone?: string | null): void {
    const normalized = normalizeIanaTimeZone(timeZone);
    sessionStorage.setItem(this.TENANT_TIMEZONE_KEY, normalized);
    if (normalized !== this.tenantTimeZone()) {
      this.tenantTimeZone.set(normalized);
    }
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
    this.authContextVersion += 1;
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(this.TENANT_KEY);
    sessionStorage.removeItem(this.TENANT_TIMEZONE_KEY);
    this.tenantTimeZone.set(DEFAULT_TENANT_TIMEZONE);
    this.tenantContextRequest$ = undefined;
    this.resetSessionScopedState();
    this.authStore.clearAuth();
  }

  private beginInteractiveAuthRequest(): number {
    const requestId = ++this.interactiveAuthRequestId;
    this.authStore.setLoading(true);
    this.authStore.setError(null);
    return requestId;
  }

  private isLatestInteractiveAuthRequest(requestId: number): boolean {
    return requestId === this.interactiveAuthRequestId;
  }

  private captureAuthContext(
    overrides: Partial<AuthContextGuard> = {}
  ): AuthContextGuard {
    return {
      accessToken: overrides.accessToken,
      refreshToken: overrides.refreshToken,
      version: this.authContextVersion,
    };
  }

  private isAuthContextCurrent(expected: AuthContextGuard): boolean {
    if (expected.version !== this.authContextVersion) {
      return false;
    }

    if (
      expected.accessToken !== undefined &&
      expected.accessToken !== this.getAccessToken()
    ) {
      return false;
    }

    if (
      expected.refreshToken !== undefined &&
      expected.refreshToken !== this.getRefreshToken()
    ) {
      return false;
    }

    return true;
  }

  private isStaleAuthContextError(error: unknown): boolean {
    return error instanceof Error && error.message === STALE_AUTH_CONTEXT_ERROR;
  }

  private resetSessionScopedState(): void {
    this.facilityContext?.reset?.();
    this.analyticsStore?.reset?.();
    this.bookingStore?.reset?.();
    this.dashboardStore?.reset?.();
  }

  private logStaleAuthResponse(
    event: string,
    context?: Record<string, unknown>
  ): void {
    this.logger?.warn(
      `client.auth.${event}.stale_ignored`,
      'Ignored stale auth response after auth context changed',
      context
    );
  }
}
