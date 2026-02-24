import {
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { RequestContextMiddleware } from './request-context.middleware';
import { AppLoggerService } from './app-logger.service';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { ContextHttpExceptionFilter } from './http-exception.filter';

@Global()
@Module({
  providers: [
    RequestContextService,
    AppLoggerService,
    HttpLoggingInterceptor,
    ContextHttpExceptionFilter,
  ],
  exports: [
    RequestContextService,
    AppLoggerService,
    HttpLoggingInterceptor,
    ContextHttpExceptionFilter,
  ],
})
export class LoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes(
        { path: '/', method: RequestMethod.ALL },
        { path: '*path', method: RequestMethod.ALL }
      );
  }
}
