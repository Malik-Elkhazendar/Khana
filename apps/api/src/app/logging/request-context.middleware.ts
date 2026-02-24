import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { RequestContextService } from './request-context.service';
import { RequestContext } from './logging.types';

const SAFE_REQUEST_ID_RE = /^[A-Za-z0-9._:/-]+$/;
const MAX_REQUEST_ID_LENGTH = 128;
const TRACEPARENT_RE = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContextService: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const incomingId = this.getHeaderValue(req.headers['x-request-id']);
    const requestId = this.isSafeRequestId(incomingId)
      ? incomingId
      : randomUUID();

    res.setHeader('x-request-id', requestId);

    const tenantId = this.getHeaderValue(req.headers['x-tenant-id']);
    const traceparent = this.getHeaderValue(req.headers['traceparent']);
    const traceContext = this.parseTraceparent(traceparent);

    const context: RequestContext = {
      requestId,
      tenantId,
      method: req.method,
      path: req.originalUrl || req.url,
      startTime: Date.now(),
      ...(traceContext ?? {}),
    };

    this.requestContextService.run(context, () => next());
  }

  private getHeaderValue(
    headerValue: string | string[] | undefined
  ): string | undefined {
    if (Array.isArray(headerValue)) {
      const first = headerValue[0];
      return first?.trim() || undefined;
    }
    return headerValue?.trim() || undefined;
  }

  private isSafeRequestId(value: string | undefined): value is string {
    if (!value) return false;
    if (value.length > MAX_REQUEST_ID_LENGTH) return false;
    return SAFE_REQUEST_ID_RE.test(value);
  }

  private parseTraceparent(
    traceparent: string | undefined
  ): Pick<RequestContext, 'traceId' | 'spanId' | 'traceFlags'> | undefined {
    if (!traceparent) return undefined;

    const match = traceparent.match(TRACEPARENT_RE);
    if (!match) return undefined;

    const traceId = match[1].toLowerCase();
    const spanId = match[2].toLowerCase();
    const traceFlags = match[3].toLowerCase();

    // W3C trace-context invalidates all-zero IDs.
    if (traceId === '00000000000000000000000000000000') return undefined;
    if (spanId === '0000000000000000') return undefined;

    return { traceId, spanId, traceFlags };
  }
}
