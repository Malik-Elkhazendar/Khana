import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AppLoggerService } from './app-logger.service';
import { RequestContextService } from './request-context.service';
import { LOG_EVENTS } from './logging.constants';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly appLogger: AppLoggerService,
    private readonly requestContextService: RequestContextService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap(() => {
        const statusCode: number = response.statusCode;
        const reqCtx = this.requestContextService.get();
        const durationMs = reqCtx ? Date.now() - reqCtx.startTime : undefined;

        this.appLogger.info(
          LOG_EVENTS.HTTP_REQUEST_COMPLETED,
          'Request completed',
          {
            statusCode,
            durationMs,
          }
        );
      })
    );
  }
}
