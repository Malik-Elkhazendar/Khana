import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { AppLoggerService } from './app-logger.service';
import { RequestContextService } from './request-context.service';
import { LOG_EVENTS } from './logging.constants';

describe('HttpLoggingInterceptor', () => {
  let interceptor: HttpLoggingInterceptor;
  let appLogger: jest.Mocked<AppLoggerService>;
  let requestContextService: jest.Mocked<RequestContextService>;

  beforeEach(() => {
    appLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    } as unknown as jest.Mocked<AppLoggerService>;

    requestContextService = {
      get: jest.fn(),
      getRequestId: jest.fn(),
      run: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<RequestContextService>;

    interceptor = new HttpLoggingInterceptor(appLogger, requestContextService);
  });

  it('should log successful completion with event, statusCode, durationMs', (done) => {
    const startTime = Date.now() - 50;
    requestContextService.get.mockReturnValue({
      requestId: 'req-123',
      method: 'GET',
      path: '/test',
      startTime,
    });

    const mockResponse = { statusCode: 200 };
    const mockContext = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;

    const mockHandler: CallHandler = { handle: () => of({ data: 'ok' }) };

    interceptor.intercept(mockContext, mockHandler).subscribe({
      complete: () => {
        expect(appLogger.info).toHaveBeenCalledWith(
          LOG_EVENTS.HTTP_REQUEST_COMPLETED,
          'Request completed',
          expect.objectContaining({
            statusCode: 200,
            durationMs: expect.any(Number),
          })
        );
        const context = appLogger.info.mock.calls[0][2] as Record<
          string,
          unknown
        >;
        expect(context['durationMs']).toBeGreaterThanOrEqual(0);
        done();
      },
    });
  });
});
