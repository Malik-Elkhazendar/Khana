import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { setupStorageMock } from '../testing/mocks/storage.mock';
import {
  createMockRefreshResponse,
  createMockLoginResponse,
} from '../testing/fixtures/auth-response.fixture';
import { of, Subject, throwError } from 'rxjs';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authService: jest.Mocked<AuthService>;
  let storageMock: ReturnType<typeof setupStorageMock>;

  beforeEach(() => {
    storageMock = setupStorageMock();

    // Create mock AuthService
    authService = {
      getAccessToken: jest.fn(),
      refreshToken: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    storageMock.clear();
    jest.clearAllMocks();
  });

  describe('request interceptor', () => {
    it('should add Authorization header when token exists', () => {
      const token = 'test-access-token';
      authService.getAccessToken.mockReturnValue(token);

      httpClient.get('/api/v1/bookings').subscribe();

      const req = httpMock.expectOne('/api/v1/bookings');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);

      req.flush({});
    });

    it('should not add Authorization header when token does not exist', () => {
      authService.getAccessToken.mockReturnValue(null);

      httpClient.get('/api/v1/bookings').subscribe();

      const req = httpMock.expectOne('/api/v1/bookings');
      expect(req.request.headers.has('Authorization')).toBe(false);

      req.flush({});
    });

    it('should skip adding token to login endpoint', () => {
      const token = 'test-access-token';
      authService.getAccessToken.mockReturnValue(token);

      httpClient.post('/api/v1/auth/login', {}).subscribe();

      const req = httpMock.expectOne('/api/v1/auth/login');
      expect(req.request.headers.has('Authorization')).toBe(false);

      req.flush({});
    });

    it('should skip adding token to register endpoint', () => {
      const token = 'test-access-token';
      authService.getAccessToken.mockReturnValue(token);

      httpClient.post('/api/v1/auth/register', {}).subscribe();

      const req = httpMock.expectOne('/api/v1/auth/register');
      expect(req.request.headers.has('Authorization')).toBe(false);

      req.flush({});
    });

    it('should skip adding token to refresh endpoint', () => {
      const token = 'test-access-token';
      authService.getAccessToken.mockReturnValue(token);

      httpClient.post('/api/v1/auth/refresh', {}).subscribe();

      const req = httpMock.expectOne('/api/v1/auth/refresh');
      expect(req.request.headers.has('Authorization')).toBe(false);

      req.flush({});
    });

    it('should skip adding token to forgot-password endpoint', () => {
      const token = 'test-access-token';
      authService.getAccessToken.mockReturnValue(token);

      httpClient.post('/api/v1/auth/forgot-password', {}).subscribe();

      const req = httpMock.expectOne('/api/v1/auth/forgot-password');
      expect(req.request.headers.has('Authorization')).toBe(false);

      req.flush({});
    });

    it('should skip adding token to reset-password endpoint', () => {
      const token = 'test-access-token';
      authService.getAccessToken.mockReturnValue(token);

      httpClient.post('/api/v1/auth/reset-password', {}).subscribe();

      const req = httpMock.expectOne('/api/v1/auth/reset-password');
      expect(req.request.headers.has('Authorization')).toBe(false);

      req.flush({});
    });
  });

  describe('401 error handling', () => {
    it('should attempt token refresh on 401 error', (done) => {
      const oldToken = 'old-token';
      const newToken = 'new-token';
      const refreshResponse = createMockRefreshResponse();
      refreshResponse.accessToken = newToken;

      authService.getAccessToken.mockReturnValue(oldToken);
      authService.refreshToken.mockReturnValue(of(refreshResponse));

      httpClient.get('/api/v1/bookings').subscribe({
        next: (response) => {
          expect(response).toEqual({ data: 'success' });
          expect(authService.refreshToken).toHaveBeenCalled();
          done();
        },
      });

      // First request fails with 401
      const req1 = httpMock.expectOne('/api/v1/bookings');
      expect(req1.request.headers.get('Authorization')).toBe(
        `Bearer ${oldToken}`
      );
      req1.flush(
        { message: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' }
      );

      // Retry with new token
      const req2 = httpMock.expectOne('/api/v1/bookings');
      expect(req2.request.headers.get('Authorization')).toBe(
        `Bearer ${newToken}`
      );
      req2.flush({ data: 'success' });
    });

    it('should handle refresh token failure', (done) => {
      const token = 'expired-token';

      authService.getAccessToken.mockReturnValue(token);
      authService.refreshToken.mockReturnValue(
        throwError(() => new Error('Refresh failed'))
      );

      httpClient.get('/api/v1/bookings').subscribe({
        error: (error) => {
          expect(error.message).toBe('Refresh failed');
          expect(authService.refreshToken).toHaveBeenCalled();
          done();
        },
      });

      const req = httpMock.expectOne('/api/v1/bookings');
      req.flush(
        { message: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' }
      );
    });

    it('should queue requests during token refresh', (done) => {
      const oldToken = 'old-token';
      const newToken = 'new-token';
      const refreshResponse = createMockRefreshResponse();
      refreshResponse.accessToken = newToken;
      const refreshSubject = new Subject<typeof refreshResponse>();

      authService.getAccessToken.mockReturnValue(oldToken);
      authService.refreshToken.mockReturnValue(refreshSubject.asObservable());

      let completedRequests = 0;
      const expectedRequests = 2;

      // Make two parallel requests
      httpClient.get('/api/v1/bookings').subscribe({
        next: () => {
          completedRequests++;
          if (completedRequests === expectedRequests) {
            expect(authService.refreshToken).toHaveBeenCalledTimes(1);
            done();
          }
        },
      });

      httpClient.get('/api/v1/facilities').subscribe({
        next: () => {
          completedRequests++;
          if (completedRequests === expectedRequests) {
            expect(authService.refreshToken).toHaveBeenCalledTimes(1);
            done();
          }
        },
      });

      // First request fails
      const req1 = httpMock.expectOne('/api/v1/bookings');
      req1.flush(
        { message: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' }
      );

      // Second request fails
      const req2 = httpMock.expectOne('/api/v1/facilities');
      req2.flush(
        { message: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' }
      );

      expect(authService.refreshToken).toHaveBeenCalledTimes(1);
      refreshSubject.next(refreshResponse);
      refreshSubject.complete();

      // Retry first request
      const req3 = httpMock.expectOne('/api/v1/bookings');
      expect(req3.request.headers.get('Authorization')).toBe(
        `Bearer ${newToken}`
      );
      req3.flush({});

      // Retry second request
      const req4 = httpMock.expectOne('/api/v1/facilities');
      expect(req4.request.headers.get('Authorization')).toBe(
        `Bearer ${newToken}`
      );
      req4.flush({});
    });
  });

  describe('non-401 errors', () => {
    it('should pass through 400 errors without refresh', (done) => {
      const token = 'valid-token';
      authService.getAccessToken.mockReturnValue(token);

      httpClient.get('/api/v1/bookings').subscribe({
        error: (error) => {
          expect(error.status).toBe(400);
          expect(authService.refreshToken).not.toHaveBeenCalled();
          done();
        },
      });

      const req = httpMock.expectOne('/api/v1/bookings');
      req.flush(
        { message: 'Bad Request' },
        { status: 400, statusText: 'Bad Request' }
      );
    });

    it('should pass through 403 errors without refresh', (done) => {
      const token = 'valid-token';
      authService.getAccessToken.mockReturnValue(token);

      httpClient.get('/api/v1/bookings').subscribe({
        error: (error) => {
          expect(error.status).toBe(403);
          expect(authService.refreshToken).not.toHaveBeenCalled();
          done();
        },
      });

      const req = httpMock.expectOne('/api/v1/bookings');
      req.flush(
        { message: 'Forbidden' },
        { status: 403, statusText: 'Forbidden' }
      );
    });

    it('should pass through 404 errors without refresh', (done) => {
      const token = 'valid-token';
      authService.getAccessToken.mockReturnValue(token);

      httpClient.get('/api/v1/bookings/999').subscribe({
        error: (error) => {
          expect(error.status).toBe(404);
          expect(authService.refreshToken).not.toHaveBeenCalled();
          done();
        },
      });

      const req = httpMock.expectOne('/api/v1/bookings/999');
      req.flush(
        { message: 'Not Found' },
        { status: 404, statusText: 'Not Found' }
      );
    });

    it('should pass through 500 errors without refresh', (done) => {
      const token = 'valid-token';
      authService.getAccessToken.mockReturnValue(token);

      httpClient.get('/api/v1/bookings').subscribe({
        error: (error) => {
          expect(error.status).toBe(500);
          expect(authService.refreshToken).not.toHaveBeenCalled();
          done();
        },
      });

      const req = httpMock.expectOne('/api/v1/bookings');
      req.flush(
        { message: 'Internal Server Error' },
        { status: 500, statusText: 'Internal Server Error' }
      );
    });
  });

  describe('successful requests', () => {
    it('should pass through successful requests', (done) => {
      const token = 'valid-token';
      const mockData = { id: '123', name: 'Test' };

      authService.getAccessToken.mockReturnValue(token);

      httpClient.get('/api/v1/bookings').subscribe({
        next: (response) => {
          expect(response).toEqual(mockData);
          expect(authService.refreshToken).not.toHaveBeenCalled();
          done();
        },
      });

      const req = httpMock.expectOne('/api/v1/bookings');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
      req.flush(mockData);
    });

    it('should handle POST requests with body', (done) => {
      const token = 'valid-token';
      const postData = { name: 'New Booking' };
      const responseData = { id: '456', ...postData };

      authService.getAccessToken.mockReturnValue(token);

      httpClient.post('/api/v1/bookings', postData).subscribe({
        next: (response) => {
          expect(response).toEqual(responseData);
          done();
        },
      });

      const req = httpMock.expectOne('/api/v1/bookings');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(postData);
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
      req.flush(responseData);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple 401 errors sequentially', (done) => {
      const token = 'valid-token';
      const newToken = 'new-token';
      const refreshResponse = createMockRefreshResponse();
      refreshResponse.accessToken = newToken;

      authService.getAccessToken.mockReturnValue(token);
      authService.refreshToken.mockReturnValue(of(refreshResponse));

      httpClient.get('/api/v1/bookings').subscribe({
        next: () => {
          // First request succeeds after refresh
          // Make another request that also gets 401
          httpClient.get('/api/v1/facilities').subscribe({
            next: () => {
              done();
            },
          });

          const req3 = httpMock.expectOne('/api/v1/facilities');
          req3.flush(
            { message: 'Unauthorized' },
            { status: 401, statusText: 'Unauthorized' }
          );

          const req4 = httpMock.expectOne('/api/v1/facilities');
          req4.flush({});
        },
      });

      const req1 = httpMock.expectOne('/api/v1/bookings');
      req1.flush(
        { message: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' }
      );

      const req2 = httpMock.expectOne('/api/v1/bookings');
      req2.flush({});
    });
  });
});
