import {
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

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
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: Parameters<ExceptionFilter['catch']>[1]) {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Log full internal details (including stack trace) server-side.
    if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error('Non-Error thrown', JSON.stringify(exception));
    }

    const rawMessage = isHttpException
      ? toMessage(exception.getResponse())
      : 'Internal server error';

    // Hide internal details for 5xx errors.
    const message =
      statusCode >= 500 ? 'Internal server error' : rawMessage || 'Error';

    const body: ErrorResponseBody = {
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(request as never),
    };

    httpAdapter.reply(response as never, body, statusCode);
  }
}
