import { Injectable, LoggerService } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { LogEvent } from './logging.constants';
import { LogLevel } from './logging.types';
import {
  LogColorMode,
  LogFormat,
  NestInfoMode,
} from './internal/app-logger.shared';
import { AppLoggerOutputLayer } from './internal/app-logger.output';

@Injectable()
export class AppLoggerService
  extends AppLoggerOutputLayer
  implements LoggerService
{
  protected readonly service = 'khana-api';
  protected readonly env = process.env['NODE_ENV'] || 'development';
  protected readonly minLevel: LogLevel;
  protected readonly logFormat: LogFormat;
  protected readonly colorMode: LogColorMode;
  protected readonly nestInfoMode: NestInfoMode;

  constructor(protected readonly requestContextService: RequestContextService) {
    super();
    this.minLevel = this.resolveLogLevel();
    this.logFormat = this.resolveLogFormat();
    this.colorMode = this.resolveColorMode();
    this.nestInfoMode = this.resolveNestInfoMode();
  }

  info(
    event: LogEvent | string,
    message: string,
    context?: Record<string, unknown>
  ): void;
  info(message: unknown, ...optionalParams: unknown[]): void;
  info(first: unknown, ...optionalParams: unknown[]): void {
    this.emitFromInvocation(LogLevel.INFO, first, optionalParams);
  }

  warn(
    event: LogEvent | string,
    message: string,
    context?: Record<string, unknown>
  ): void;
  warn(message: unknown, ...optionalParams: unknown[]): void;
  warn(first: unknown, ...optionalParams: unknown[]): void {
    this.emitFromInvocation(LogLevel.WARN, first, optionalParams);
  }

  error(
    event: LogEvent | string,
    message: string,
    context?: Record<string, unknown>,
    error?: Error | unknown
  ): void;
  error(message: unknown, ...optionalParams: unknown[]): void;
  error(first: unknown, ...optionalParams: unknown[]): void {
    this.emitFromInvocation(LogLevel.ERROR, first, optionalParams);
  }

  debug(
    event: LogEvent | string,
    message: string,
    context?: Record<string, unknown>
  ): void;
  debug(message: unknown, ...optionalParams: unknown[]): void;
  debug(first: unknown, ...optionalParams: unknown[]): void {
    this.emitFromInvocation(LogLevel.DEBUG, first, optionalParams);
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.emitFromInvocation(LogLevel.INFO, message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.emitFromInvocation(LogLevel.DEBUG, message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.emitFromInvocation(LogLevel.ERROR, message, optionalParams, true);
  }
}
