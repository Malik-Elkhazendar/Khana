import { NextFunction, Request, Response } from 'express';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('RequestContextMiddleware', () => {
  let service: jest.Mocked<RequestContextService>;
  let middleware: RequestContextMiddleware;

  beforeEach(() => {
    service = {
      run: jest.fn((_ctx, callback) => callback()),
      get: jest.fn(),
      getRequestId: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<RequestContextService>;

    middleware = new RequestContextMiddleware(service);
  });

  it('accepts safe non-UUID x-request-id values', () => {
    const req = {
      headers: {
        'x-request-id': 'trace-id/1.2-abc',
        'x-tenant-id': [' tenant-1 '],
      },
      method: 'GET',
      originalUrl: '/api/v1/bookings',
      url: '/api/v1/bookings',
    } as unknown as Request;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    const next = jest.fn() as NextFunction;

    middleware.use(req, res, next);

    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'trace-id/1.2-abc');
    expect(service.run).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'trace-id/1.2-abc',
        tenantId: 'tenant-1',
        method: 'GET',
        path: '/api/v1/bookings',
      }),
      expect.any(Function)
    );
    expect(next).toHaveBeenCalled();
  });

  it('rejects unsafe request ids and generates a UUID', () => {
    const req = {
      headers: {
        'x-request-id': 'unsafe id with spaces',
      },
      method: 'POST',
      originalUrl: '/api/v1/auth/login',
      url: '/api/v1/auth/login',
    } as unknown as Request;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    const next = jest.fn() as NextFunction;

    middleware.use(req, res, next);

    const generatedId = setHeader.mock.calls[0][1] as string;
    expect(generatedId).toMatch(UUID_RE);
    expect(service.run).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: generatedId,
      }),
      expect.any(Function)
    );
  });

  it('rejects over-length request ids', () => {
    const req = {
      headers: {
        'x-request-id': 'a'.repeat(129),
      },
      method: 'GET',
      originalUrl: '/api',
      url: '/api',
    } as unknown as Request;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;

    middleware.use(req, res, jest.fn());

    const generatedId = setHeader.mock.calls[0][1] as string;
    expect(generatedId).toMatch(UUID_RE);
  });

  it('parses valid traceparent values into request context', () => {
    const req = {
      headers: {
        'x-request-id': 'trace-id/with-parent',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
      method: 'GET',
      originalUrl: '/api',
      url: '/api',
    } as unknown as Request;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;

    middleware.use(req, res, jest.fn());

    expect(setHeader).toHaveBeenCalledWith(
      'x-request-id',
      'trace-id/with-parent'
    );
    expect(service.run).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'trace-id/with-parent',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        traceFlags: '01',
      }),
      expect.any(Function)
    );
  });

  it('ignores invalid traceparent values', () => {
    const req = {
      headers: {
        'x-request-id': 'trace-id/invalid-parent',
        traceparent: '00-00000000000000000000000000000000-0000000000000000-01',
      },
      method: 'GET',
      originalUrl: '/api',
      url: '/api',
    } as unknown as Request;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;

    middleware.use(req, res, jest.fn());

    expect(setHeader).toHaveBeenCalledWith(
      'x-request-id',
      'trace-id/invalid-parent'
    );
    expect(service.run).toHaveBeenCalledWith(
      expect.not.objectContaining({
        traceId: expect.any(String),
      }),
      expect.any(Function)
    );
  });
});
