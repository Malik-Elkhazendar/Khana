import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthStore } from '../state/auth.store';
import { setupStorageMock } from '../testing/mocks/storage.mock';
import {
  createMockLoginResponse,
  createMockRefreshResponse,
} from '../testing/fixtures/auth-response.fixture';
import { createMockUser } from '../testing/fixtures/user.fixture';
import { CreateUserDto } from '@khana/shared-dtos';
import { provideHttpClient } from '@angular/common/http';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let authStore: InstanceType<typeof AuthStore>;
  let router: Router;
  let storageMock: ReturnType<typeof setupStorageMock>;

  const API_URL = '/api/v1/auth';

  beforeEach(() => {
    storageMock = setupStorageMock();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
        AuthStore,
        {
          provide: Router,
          useValue: {
            navigate: jest.fn(),
            navigateByUrl: jest.fn(),
            createUrlTree: jest.fn(),
          },
        },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    authStore = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    storageMock.clear();
  });

  describe('login', () => {
    it('should successfully login and store tokens', (done) => {
      const mockResponse = createMockLoginResponse();
      const email = 'test@example.com';
      const password = 'password123';

      service.login(email, password).subscribe({
        next: (response) => {
          expect(response).toEqual(mockResponse);
          expect(storageMock.getItem('khana_access_token')).toBe(
            mockResponse.accessToken
          );
          expect(storageMock.getItem('khana_refresh_token')).toBe(
            mockResponse.refreshToken
          );
          expect(authStore.user()).toEqual(mockResponse.user);
          expect(authStore.isAuthenticated()).toBe(true);
          expect(authStore.isLoading()).toBe(false);
          done();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email, password });

      req.flush(mockResponse);
    });

    it('should handle 401 unauthorized error', (done) => {
      const email = 'test@example.com';
      const password = 'wrong-password';
      const errorMessage = 'Invalid credentials';

      service.login(email, password).subscribe({
        error: (error) => {
          expect(error.status).toBe(401);
          expect(authStore.error()).toBe(errorMessage);
          expect(authStore.isLoading()).toBe(false);
          expect(authStore.isAuthenticated()).toBe(false);
          done();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/login`);
      req.flush(
        { message: errorMessage },
        { status: 401, statusText: 'Unauthorized' }
      );
    });

    it('should handle network error', (done) => {
      const email = 'test@example.com';
      const password = 'password123';

      service.login(email, password).subscribe({
        error: (error) => {
          expect(error.error).toBeTruthy();
          expect(authStore.error()).toBe('Login failed');
          expect(authStore.isLoading()).toBe(false);
          done();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/login`);
      req.error(new ProgressEvent('Network error'));
    });

    it('should set loading state during login', () => {
      const email = 'test@example.com';
      const password = 'password123';

      service.login(email, password).subscribe();

      expect(authStore.isLoading()).toBe(true);

      const req = httpMock.expectOne(`${API_URL}/login`);
      req.flush(createMockLoginResponse());

      expect(authStore.isLoading()).toBe(false);
    });
  });

  describe('register', () => {
    it('should successfully register and store tokens', (done) => {
      const mockResponse = createMockLoginResponse();
      const dto: CreateUserDto = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        phone: '+1234567890',
      };

      service.register(dto).subscribe({
        next: (response) => {
          expect(response).toEqual(mockResponse);
          expect(storageMock.getItem('khana_access_token')).toBe(
            mockResponse.accessToken
          );
          expect(storageMock.getItem('khana_refresh_token')).toBe(
            mockResponse.refreshToken
          );
          expect(authStore.user()).toEqual(mockResponse.user);
          expect(authStore.isAuthenticated()).toBe(true);
          done();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);

      req.flush(mockResponse);
    });

    it('should handle validation error', (done) => {
      const dto: CreateUserDto = {
        email: 'invalid-email',
        password: '123',
        name: '',
      };
      const errorMessage = 'Validation failed';

      service.register(dto).subscribe({
        error: (error) => {
          expect(error.status).toBe(400);
          expect(authStore.error()).toBe(errorMessage);
          expect(authStore.isLoading()).toBe(false);
          done();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/register`);
      req.flush(
        { message: errorMessage },
        { status: 400, statusText: 'Bad Request' }
      );
    });

    it('should handle email already exists error', (done) => {
      const dto: CreateUserDto = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
      };
      const errorMessage = 'Email already exists';

      service.register(dto).subscribe({
        error: (error) => {
          expect(error.status).toBe(409);
          expect(authStore.error()).toBe(errorMessage);
          done();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/register`);
      req.flush(
        { message: errorMessage },
        { status: 409, statusText: 'Conflict' }
      );
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      storageMock.setItem('khana_access_token', 'test-token');
      storageMock.setItem('khana_refresh_token', 'test-refresh');
      authStore.setUser(createMockUser());
      authStore.setAuthenticated(true);
    });

    it('should clear tokens and redirect to login', () => {
      service.logout();

      const req = httpMock.expectOne(`${API_URL}/logout`);
      expect(req.request.method).toBe('POST');

      req.flush({});

      expect(storageMock.getItem('khana_access_token')).toBeNull();
      expect(storageMock.getItem('khana_refresh_token')).toBeNull();
      expect(authStore.user()).toBeNull();
      expect(authStore.isAuthenticated()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should clear state even if API call fails', () => {
      service.logout();

      const req = httpMock.expectOne(`${API_URL}/logout`);
      req.error(new ProgressEvent('Network error'));

      expect(storageMock.getItem('khana_access_token')).toBeNull();
      expect(storageMock.getItem('khana_refresh_token')).toBeNull();
      expect(authStore.user()).toBeNull();
      expect(authStore.isAuthenticated()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', (done) => {
      const oldRefreshToken = 'old-refresh-token';
      storageMock.setItem('khana_refresh_token', oldRefreshToken);

      const mockResponse = createMockRefreshResponse();
      const existingUser = createMockUser();
      authStore.setUser(existingUser);

      service.refreshToken().subscribe({
        next: (response) => {
          expect(response).toEqual(mockResponse);
          expect(storageMock.getItem('khana_access_token')).toBe(
            mockResponse.accessToken
          );
          expect(storageMock.getItem('khana_refresh_token')).toBe(
            mockResponse.refreshToken
          );
          expect(authStore.user()).toEqual(existingUser);
          expect(authStore.isAuthenticated()).toBe(true);
          done();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refreshToken: oldRefreshToken });

      req.flush(mockResponse);
    });

    it('should handle missing refresh token', (done) => {
      service.refreshToken().subscribe({
        error: (error) => {
          expect(error.message).toBe('No refresh token available');
          expect(authStore.user()).toBeNull();
          expect(authStore.isAuthenticated()).toBe(false);
          done();
        },
      });

      httpMock.expectNone(`${API_URL}/refresh`);
    });

    it('should clear auth and redirect on refresh failure', (done) => {
      storageMock.setItem('khana_refresh_token', 'expired-refresh-token');
      authStore.setUser(createMockUser());
      authStore.setAuthenticated(true);

      service.refreshToken().subscribe({
        error: () => {
          expect(storageMock.getItem('khana_access_token')).toBeNull();
          expect(storageMock.getItem('khana_refresh_token')).toBeNull();
          expect(authStore.user()).toBeNull();
          expect(authStore.isAuthenticated()).toBe(false);
          expect(router.navigate).toHaveBeenCalledWith(['/login']);
          done();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/refresh`);
      req.flush(
        { message: 'Refresh token expired' },
        { status: 401, statusText: 'Unauthorized' }
      );
    });
  });

  describe('getCurrentUser', () => {
    it('should fetch and store current user', (done) => {
      const mockUser = createMockUser();

      service.getCurrentUser().subscribe({
        next: (user) => {
          expect(user).toEqual(mockUser);
          expect(authStore.user()).toEqual(mockUser);
          expect(authStore.isAuthenticated()).toBe(true);
          done();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/me`);
      expect(req.request.method).toBe('GET');

      req.flush(mockUser);
    });

    it('should clear auth on error', (done) => {
      authStore.setUser(createMockUser());
      authStore.setAuthenticated(true);

      service.getCurrentUser().subscribe({
        error: () => {
          expect(authStore.user()).toBeNull();
          expect(authStore.isAuthenticated()).toBe(false);
          done();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/me`);
      req.flush(
        { message: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' }
      );
    });
  });

  describe('changePassword', () => {
    it('should change password without clearing current session', (done) => {
      storageMock.setItem('khana_access_token', 'test-token');
      authStore.setUser(createMockUser());
      authStore.setAuthenticated(true);

      const dto = {
        currentPassword: 'old-password',
        newPassword: 'new-password',
      };

      service.changePassword(dto).subscribe({
        next: () => {
          expect(storageMock.getItem('khana_access_token')).toBe('test-token');
          expect(authStore.user()).toBeTruthy();
          expect(authStore.isAuthenticated()).toBe(true);
          done();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/change-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);

      req.flush({});
    });
  });

  describe('forgotPassword', () => {
    it('should request password reset token successfully', (done) => {
      service.forgotPassword('user@example.com').subscribe({
        next: (response) => {
          expect(response.message).toBe(
            'If that email exists, a reset link has been sent'
          );
          expect(authStore.isLoading()).toBe(false);
          done();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/forgot-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'user@example.com' });
      req.flush({
        message: 'If that email exists, a reset link has been sent',
      });
    });

    it('should set store error when forgot password fails', (done) => {
      service.forgotPassword('user@example.com').subscribe({
        error: (error) => {
          expect(error.status).toBe(400);
          expect(authStore.error()).toBe('Invalid email');
          expect(authStore.isLoading()).toBe(false);
          done();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/forgot-password`);
      req.flush(
        { message: 'Invalid email' },
        { status: 400, statusText: 'Bad Request' }
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', (done) => {
      service.resetPassword('token-123', 'NewPassword123').subscribe({
        next: (response) => {
          expect(response.message).toBe('Password has been reset successfully');
          expect(authStore.isLoading()).toBe(false);
          done();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/reset-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        token: 'token-123',
        newPassword: 'NewPassword123',
      });
      req.flush({ message: 'Password has been reset successfully' });
    });

    it('should set store error when reset password fails', (done) => {
      service.resetPassword('bad-token', 'NewPassword123').subscribe({
        error: (error) => {
          expect(error.status).toBe(400);
          expect(authStore.error()).toBe(
            'Invalid or expired password reset token'
          );
          expect(authStore.isLoading()).toBe(false);
          done();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/reset-password`);
      req.flush(
        { message: 'Invalid or expired password reset token' },
        { status: 400, statusText: 'Bad Request' }
      );
    });
  });

  describe('restoreSession', () => {
    it('should restore session with valid token', () => {
      const mockUser = createMockUser();
      storageMock.setItem('khana_access_token', 'valid-token');

      service.restoreSession();

      expect(authStore.isAuthenticated()).toBe(true);

      const req = httpMock.expectOne(`${API_URL}/me`);
      req.flush(mockUser);

      expect(authStore.user()).toEqual(mockUser);
    });

    it('should not restore session without token', () => {
      service.restoreSession();

      expect(authStore.isAuthenticated()).toBe(false);
      httpMock.expectNone(`${API_URL}/me`);
    });

    it('should clear auth if token is invalid', () => {
      storageMock.setItem('khana_access_token', 'invalid-token');

      service.restoreSession();

      const req = httpMock.expectOne(`${API_URL}/me`);
      req.flush(
        { message: 'Invalid token' },
        { status: 401, statusText: 'Unauthorized' }
      );

      expect(storageMock.getItem('khana_access_token')).toBeNull();
      expect(authStore.user()).toBeNull();
      expect(authStore.isAuthenticated()).toBe(false);
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when authenticated', () => {
      authStore.setAuthenticated(true);

      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return false when not authenticated', () => {
      authStore.setAuthenticated(false);

      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('getAccessToken', () => {
    it('should return access token from storage', () => {
      const token = 'test-access-token';
      storageMock.setItem('khana_access_token', token);

      expect(service.getAccessToken()).toBe(token);
    });

    it('should return null when no token exists', () => {
      expect(service.getAccessToken()).toBeNull();
    });
  });

  describe('getRefreshToken', () => {
    it('should return refresh token from storage', () => {
      const token = 'test-refresh-token';
      storageMock.setItem('khana_refresh_token', token);

      expect(service.getRefreshToken()).toBe(token);
    });

    it('should return null when no token exists', () => {
      expect(service.getRefreshToken()).toBeNull();
    });
  });
});
