import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { finalize, map, shareReplay, tap } from 'rxjs/operators';
import {
  DEFAULT_TENANT_TIMEZONE,
  TenantResolveResponseDto,
  normalizeIanaTimeZone,
} from '@khana/shared-dtos';
import { environment } from '../../../../../environments/environment';
import { AnalyticsStore } from '../../../../state/analytics/analytics.store';
import { BookingStore } from '../../../../state/bookings/booking.store';
import { DashboardStore } from '../../../../state/dashboard/dashboard.store';
import { AuthStore } from '../../../state/auth.store';
import { FacilityContextStore } from '../../../state';
import { LoggerService } from '../../logger.service';

export type ForgotPasswordResponse = {
  message: string;
};

export type ResetPasswordResponse = {
  message: string;
};

export type TenantContextResponse = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

export type AuthContextGuard = {
  accessToken?: string | null;
  refreshToken?: string | null;
  version: number;
};

export const STALE_AUTH_CONTEXT_ERROR = 'STALE_AUTH_CONTEXT';

/**
 * Shared auth service state and tenant-resolution helpers.
 * This layer owns storage, workspace resolution, and stale-response guards.
 */
export abstract class AuthServiceSharedLayer {
  protected readonly http = inject(HttpClient);
  protected readonly authStore = inject(AuthStore);
  protected readonly router = inject(Router);
  protected readonly logger = inject(LoggerService, { optional: true });
  protected readonly facilityContext = inject(FacilityContextStore, {
    optional: true,
  });
  protected readonly analyticsStore = inject(AnalyticsStore, {
    optional: true,
  });
  protected readonly bookingStore = inject(BookingStore, { optional: true });
  protected readonly dashboardStore = inject(DashboardStore, {
    optional: true,
  });

  protected readonly API_BASE_URL = environment.apiBaseUrl.replace(/\/+$/, '');
  protected readonly API_URL = `${this.API_BASE_URL}/v1/auth`;
  protected readonly TOKEN_KEY = 'khana_access_token';
  protected readonly REFRESH_TOKEN_KEY = 'khana_refresh_token';
  protected readonly TENANT_KEY = 'khana_tenant_id';
  protected readonly TENANT_TIMEZONE_KEY = 'khana_tenant_timezone';
  protected readonly TENANT_HEADER = 'x-tenant-id';
  protected readonly WORKSPACE_QUERY_PARAM = 'workspace';
  protected readonly UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  protected readonly WORKSPACE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  protected tenantContextRequest$?: Observable<string>;
  protected authContextVersion = 0;
  protected interactiveAuthRequestId = 0;
  readonly tenantTimeZone = signal(this.readTenantTimeZoneFromStorage());

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

  isAuthenticated(): boolean {
    return this.authStore.isAuthenticated();
  }

  getAccessToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return sessionStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  protected storeTokens(accessToken: string, refreshToken: string): void {
    this.authContextVersion += 1;
    sessionStorage.setItem(this.TOKEN_KEY, accessToken);
    sessionStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  protected resolveTenantHeaders(): Observable<HttpHeaders> {
    const tenantId = this.getTenantIdFromStorage();
    if (tenantId) {
      return of(this.buildTenantHeaders(tenantId));
    }

    return this.resolveTenantId().pipe(
      map((resolvedTenantId) => this.buildTenantHeaders(resolvedTenantId))
    );
  }

  protected resolveLoginHeaders(): Observable<HttpHeaders> {
    const workspaceSlug = this.getWorkspaceSlugFromQueryParam();
    if (this.isWorkspaceSlug(workspaceSlug)) {
      return this.resolveTenantByWorkspaceSlug(workspaceSlug).pipe(
        map((resolvedTenantId) => this.buildTenantHeaders(resolvedTenantId))
      );
    }

    // Allow backend email-based tenant resolution on login when no tenant hints exist.
    return of(new HttpHeaders());
  }

  protected getTenantHeaders(): HttpHeaders {
    const tenantId = this.getTenantIdFromStorage();

    if (!tenantId) {
      return new HttpHeaders();
    }

    return this.buildTenantHeaders(tenantId);
  }

  protected resolveTenantId(): Observable<string> {
    // Resolve tenant hints from strongest to weakest source: stored session,
    // explicit workspace slug, legacy hints, then backend context.
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

  protected resolveTenantByWorkspaceSlug(
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

  protected buildTenantHeaders(tenantId: string): HttpHeaders {
    return new HttpHeaders({
      [this.TENANT_HEADER]: tenantId,
    });
  }

  protected fetchTenantContext(): Observable<string> {
    if (this.tenantContextRequest$) {
      return this.tenantContextRequest$;
    }

    // shareReplay keeps concurrent callers on one request while finalize clears
    // the cache for the next auth context.
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

  protected getTenantIdFromStorage(): string {
    const fromStorage = sessionStorage.getItem(this.TENANT_KEY)?.trim() ?? '';
    if (this.isUuid(fromStorage)) {
      return fromStorage;
    }
    return '';
  }

  protected resolveTenantIdFromLegacyHints(): string {
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

  protected getWorkspaceSlugFromQueryParam(): string {
    const workspace = new URLSearchParams(window.location.search).get(
      this.WORKSPACE_QUERY_PARAM
    );
    return workspace?.trim().toLowerCase() ?? '';
  }

  protected isWorkspaceSlug(value: string): boolean {
    return this.WORKSPACE_SLUG_PATTERN.test(value);
  }

  protected getTenantIdFromQueryParam(): string {
    const tenantId = new URLSearchParams(window.location.search).get(
      'tenantId'
    );
    return tenantId?.trim() ?? '';
  }

  protected getTenantIdFromHostname(): string {
    const [subdomain] = window.location.hostname.split('.');
    return subdomain?.trim() ?? '';
  }

  protected isUuid(value: string): boolean {
    return this.UUID_PATTERN.test(value);
  }

  protected readTenantTimeZoneFromStorage(): string {
    const raw = sessionStorage.getItem(this.TENANT_TIMEZONE_KEY)?.trim() ?? '';
    return raw ? normalizeIanaTimeZone(raw) : DEFAULT_TENANT_TIMEZONE;
  }

  protected storeTenantTimeZone(timeZone?: string | null): void {
    const normalized = normalizeIanaTimeZone(timeZone);
    sessionStorage.setItem(this.TENANT_TIMEZONE_KEY, normalized);
    if (normalized !== this.tenantTimeZone()) {
      this.tenantTimeZone.set(normalized);
    }
  }

  protected storeTenantId(tenantId?: string | null): void {
    const normalizedTenantId = tenantId?.trim() ?? '';
    if (!normalizedTenantId) {
      sessionStorage.removeItem(this.TENANT_KEY);
      return;
    }
    sessionStorage.setItem(this.TENANT_KEY, normalizedTenantId);
  }

  protected clearAuthState(): void {
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

  protected beginInteractiveAuthRequest(): number {
    const requestId = ++this.interactiveAuthRequestId;
    this.authStore.setLoading(true);
    this.authStore.setError(null);
    return requestId;
  }

  protected isLatestInteractiveAuthRequest(requestId: number): boolean {
    return requestId === this.interactiveAuthRequestId;
  }

  protected captureAuthContext(
    overrides: Partial<AuthContextGuard> = {}
  ): AuthContextGuard {
    return {
      accessToken: overrides.accessToken,
      refreshToken: overrides.refreshToken,
      version: this.authContextVersion,
    };
  }

  protected isAuthContextCurrent(expected: AuthContextGuard): boolean {
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

  protected isStaleAuthContextError(error: unknown): boolean {
    return error instanceof Error && error.message === STALE_AUTH_CONTEXT_ERROR;
  }

  protected resetSessionScopedState(): void {
    this.facilityContext?.reset?.();
    this.analyticsStore?.reset?.();
    this.bookingStore?.reset?.();
    this.dashboardStore?.reset?.();
  }

  protected logStaleAuthResponse(
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
