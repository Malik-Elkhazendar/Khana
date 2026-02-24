import {
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AppLoggerService } from './app-logger.service';
import { RequestContextService } from './request-context.service';
import { LOG_EVENTS } from './logging.constants';

interface ErrorResponseBody {
  statusCode: number;
  message: string;
  timestamp: string;
  path: string;
}

function toMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(toMessage).join(', ');
  if (value && typeof value === 'object' && 'message' in value) {
    return toMessage((value as { message?: unknown }).message);
  }
  return 'An unexpected error occurred.';
}

@Catch()
@Injectable()
export class ContextHttpExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly appLogger: AppLoggerService,
    private readonly requestContextService: RequestContextService
  ) {}

  catch(exception: unknown, host: Parameters<ExceptionFilter['catch']>[1]) {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Set x-request-id header on error responses
    const requestId = this.requestContextService.getRequestId();
    if (requestId) {
      httpAdapter.setHeader(response as never, 'x-request-id', requestId);
    }

    const rawMessage = isHttpException
      ? toMessage(exception.getResponse())
      : 'Internal server error';

    // Hide internal details for 5xx errors.
    const message =
      statusCode >= 500 ? 'Internal server error' : rawMessage || 'Error';

    const logContext: Record<string, unknown> = { statusCode };
    const reqCtx = this.requestContextService.get();
    if (reqCtx) {
      logContext['durationMs'] = Date.now() - reqCtx.startTime;
    }

    if (statusCode >= 500) {
      const err = exception instanceof Error ? exception : undefined;
      this.appLogger.error(
        LOG_EVENTS.HTTP_REQUEST_FAILED,
        err?.message || 'Internal server error',
        logContext,
        err
      );
    } else {
      this.appLogger.warn(LOG_EVENTS.HTTP_REQUEST_FAILED, message, logContext);
    }

    const body: ErrorResponseBody = {
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(request as never),
    };

    httpAdapter.reply(response as never, body, statusCode);
  }
}
