import { RequestContextService } from './request-context.service';
import { RequestContext } from './logging.types';

describe('RequestContextService', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  it('should return undefined outside context', () => {
    expect(service.get()).toBeUndefined();
    expect(service.getRequestId()).toBeUndefined();
  });

  it('should return context within run()', () => {
    const ctx: RequestContext = {
      requestId: 'test-id',
      method: 'GET',
      path: '/test',
      startTime: Date.now(),
    };

    service.run(ctx, () => {
      expect(service.get()).toBe(ctx);
      expect(service.getRequestId()).toBe('test-id');
    });
  });

  it('should isolate concurrent contexts', async () => {
    const results: string[] = [];

    const p1 = new Promise<void>((resolve) => {
      const ctx: RequestContext = {
        requestId: 'req-1',
        method: 'GET',
        path: '/a',
        startTime: Date.now(),
      };
      service.run(ctx, () => {
        const requestId = service.getRequestId();
        if (!requestId) {
          throw new Error('Missing request id in context');
        }
        results.push(requestId);
        resolve();
      });
    });

    const p2 = new Promise<void>((resolve) => {
      const ctx: RequestContext = {
        requestId: 'req-2',
        method: 'POST',
        path: '/b',
        startTime: Date.now(),
      };
      service.run(ctx, () => {
        const requestId = service.getRequestId();
        if (!requestId) {
          throw new Error('Missing request id in context');
        }
        results.push(requestId);
        resolve();
      });
    });

    await Promise.all([p1, p2]);
    expect(results).toContain('req-1');
    expect(results).toContain('req-2');
  });

  it('should update context in-place', () => {
    const ctx: RequestContext = {
      requestId: 'test-id',
      method: 'GET',
      path: '/test',
      startTime: Date.now(),
    };

    service.run(ctx, () => {
      service.update({ userId: 'user-1', tenantId: 'tenant-1' });
      expect(service.get()?.userId).toBe('user-1');
      expect(service.get()?.tenantId).toBe('tenant-1');
    });
  });

  it('should no-op update outside context', () => {
    expect(() => service.update({ userId: 'user-1' })).not.toThrow();
  });
});
