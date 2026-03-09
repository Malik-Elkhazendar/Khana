import { EMPTY, Observable, of, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import {
  ChangePasswordDto,
  CreateUserDto,
  LoginDto,
  LoginResponseDto,
  OwnerSignupDto,
} from '@khana/shared-dtos';
import {
  ForgotPasswordResponse,
  ResetPasswordResponse,
} from './auth.service.shared';
import { AuthServiceSessionLayer } from './auth.service.session';

/**
 * Interactive auth workflows are kept separate from session and tenant helpers
 * because they own user-facing loading, error, and stale-response handling.
 */
export abstract class AuthServiceFacade extends AuthServiceSessionLayer {
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
}
