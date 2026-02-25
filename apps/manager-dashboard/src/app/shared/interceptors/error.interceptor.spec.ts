import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { errorInterceptor } from './error.interceptor';
import { LoggerService } from '../services/logger.service';

describe('errorInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let logger: jest.Mocked<LoggerService>;
  let translateService: { instant: jest.Mock };

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;
    translateService = {
      instant: jest.fn((key: string) => key),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: LoggerService, useValue: logger },
        { provide: TranslateService, useValue: translateService },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    jest.clearAllMocks();
  });

  it('captures x-request-id for server errors', (done) => {
    httpClient.get('/api/v1/bookings').subscribe({
      next: () => fail('Expected request to fail'),
      error: (error: HttpErrorResponse) => {
        expect(error.status).toBe(500);
        expect(logger.error).toHaveBeenCalledWith(
          'client.http.response.failed',
          'HTTP request failed with server error',
          {
            method: 'GET',
            url: '/api/v1/bookings',
            statusCode: 500,
            requestId: 'req-err-123',
          },
          expect.any(HttpErrorResponse)
        );
        done();
      },
    });

    const req = httpMock.expectOne('/api/v1/bookings');
    req.flush(
      { message: 'Server error' },
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'x-request-id': 'req-err-123' },
      }
    );
  });

  it('logs safely when x-request-id header is missing', (done) => {
    httpClient.get('/api/v1/missing').subscribe({
      next: () => fail('Expected request to fail'),
      error: (error: HttpErrorResponse) => {
        expect(error.status).toBe(404);
        expect(logger.warn).toHaveBeenCalledWith(
          'client.http.response.failed',
          'HTTP request failed',
          {
            method: 'GET',
            url: '/api/v1/missing',
            statusCode: 404,
          }
        );
        done();
      },
    });

    const req = httpMock.expectOne('/api/v1/missing');
    req.flush(
      { message: 'Not Found' },
      {
        status: 404,
        statusText: 'Not Found',
      }
    );
  });
});
