import {
  BadRequestException,
  InternalServerErrorException,
  ArgumentsHost,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ContextHttpExceptionFilter } from './http-exception.filter';
import { AppLoggerService } from './app-logger.service';
import { RequestContextService } from './request-context.service';
import { LOG_EVENTS } from './logging.constants';

describe('ContextHttpExceptionFilter', () => {
  let filter: ContextHttpExceptionFilter;
  let appLogger: jest.Mocked<AppLoggerService>;
  let requestContextService: jest.Mocked<RequestContextService>;
  let httpAdapterHost: HttpAdapterHost;
  let mockReply: jest.Mock;
  let mockSetHeader: jest.Mock;
  let mockGetRequestUrl: jest.Mock;

  beforeEach(() => {
    appLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    } as unknown as jest.Mocked<AppLoggerService>;

    requestContextService = {
      get: jest.fn().mockReturnValue({
        requestId: 'req-123',
        method: 'GET',
        path: '/test',
        startTime: Date.now() - 50,
      }),
      getRequestId: jest.fn().mockReturnValue('req-123'),
      run: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<RequestContextService>;

    mockReply = jest.fn();
    mockSetHeader = jest.fn();
    mockGetRequestUrl = jest.fn().mockReturnValue('/test');

    httpAdapterHost = {
      httpAdapter: {
        reply: mockReply,
        setHeader: mockSetHeader,
        getRequestUrl: mockGetRequestUrl,
      },
    } as unknown as HttpAdapterHost;

    filter = new ContextHttpExceptionFilter(
      httpAdapterHost,
      appLogger,
      requestContextService
    );
  });

  const createHost = (): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({}),
      }),
    } as unknown as ArgumentsHost);

  it('should preserve 4xx response body shape', () => {
    const exception = new BadRequestException('Invalid input');

    filter.catch(exception, createHost());

    const body = mockReply.mock.calls[0][1];
    expect(body).toMatchObject({
      statusCode: 400,
      message: 'Invalid input',
      path: '/test',
    });
    expect(body.timestamp).toBeDefined();
  });

  it('should sanitize 5xx message to "Internal server error"', () => {
    const exception = new InternalServerErrorException('DB connection failed');

    filter.catch(exception, createHost());

    const body = mockReply.mock.calls[0][1];
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
  });

  it('should set x-request-id header from context', () => {
    const exception = new BadRequestException('test');

    filter.catch(exception, createHost());

    expect(mockSetHeader).toHaveBeenCalledWith(
      expect.anything(),
      'x-request-id',
      'req-123'
    );
  });

  it('should log 5xx at error level', () => {
    const exception = new Error('unexpected');

    filter.catch(exception, createHost());

    expect(appLogger.error).toHaveBeenCalledWith(
      LOG_EVENTS.HTTP_REQUEST_FAILED,
      'unexpected',
      expect.objectContaining({ statusCode: 500 }),
      exception
    );
  });

  it('should log 4xx at warn level', () => {
    const exception = new BadRequestException('bad input');

    filter.catch(exception, createHost());

    expect(appLogger.warn).toHaveBeenCalledWith(
      LOG_EVENTS.HTTP_REQUEST_FAILED,
      'bad input',
      expect.objectContaining({ statusCode: 400 })
    );
  });
});
