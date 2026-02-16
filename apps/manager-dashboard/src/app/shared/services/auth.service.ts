import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import {
  LoginDto,
  LoginResponseDto,
  CreateUserDto,
  UserDto,
  ChangePasswordDto,
} from '@khana/shared-dtos';
import { AuthStore } from '../state/auth.store';

type ForgotPasswordResponse = {
  message: string;
};

type ResetPasswordResponse = {
  message: string;
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

  private readonly API_URL = '/api/v1/auth';
  private readonly TOKEN_KEY = 'khana_access_token';
  private readonly REFRESH_TOKEN_KEY = 'khana_refresh_token';

  /**
   * Login with email and password
   */
  login(email: string, password: string): Observable<LoginResponseDto> {
    const dto: LoginDto = { email, password };

    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.http.post<LoginResponseDto>(`${this.API_URL}/login`, dto).pipe(
      tap((response) => {
        this.storeTokens(response.accessToken, response.refreshToken);
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

    return this.http
      .post<LoginResponseDto>(`${this.API_URL}/register`, dto)
      .pipe(
        tap((response) => {
          this.storeTokens(response.accessToken, response.refreshToken);
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
    this.http.post(`${this.API_URL}/logout`, {}).subscribe({
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
      .post<LoginResponseDto>(`${this.API_URL}/refresh`, { refreshToken })
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
    return this.http.get<UserDto>(`${this.API_URL}/me`).pipe(
      tap((user) => {
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

    return this.http.post<void>(`${this.API_URL}/change-password`, dto).pipe(
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

    return this.http
      .post<ForgotPasswordResponse>(`${this.API_URL}/forgot-password`, {
        email: email.trim(),
      })
      .pipe(
        tap(() => {
          this.authStore.setLoading(false);
        }),
        catchError((error) => {
          const message =
            error.error?.message || 'Password reset request failed';
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

    return this.http
      .post<ResetPasswordResponse>(`${this.API_URL}/reset-password`, {
        token: token.trim(),
        newPassword,
      })
      .pipe(
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

  /**
   * Clear all auth state and storage
   */
  private clearAuthState(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
    this.authStore.clearAuth();
  }
}
