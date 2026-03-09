import { LOG_EVENTS, LogEvent } from '../logging.constants';
import { LogLevel, StructuredLog } from '../logging.types';

export type LogFormat = 'json' | 'pretty';
export type LogColorMode = 'auto' | 'on' | 'off';
export type NestInfoMode = 'on' | 'off' | 'auto';

export interface ParsedInvocation {
  event: string;
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
}

export interface SeverityInfo {
  text: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  number: 5 | 9 | 13 | 17 | 21;
}

export const EVENT_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
export const EVENT_NAMES = new Set<string>(Object.values(LOG_EVENTS));
export const NEST_FILTERED_CONTEXTS = new Set([
  'InstanceLoader',
  'RouterExplorer',
  'RoutesResolver',
]);
export const CONTEXT_PRETTY_MAX_LENGTH = 240;

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

export const ANSI = {
  reset: '\u001b[0m',
  blue: '\u001b[34m',
  green: '\u001b[32m',
  magenta: '\u001b[35m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
  gray: '\u001b[90m',
  red: '\u001b[31m',
  brightRed: '\u001b[91m',
};

export abstract class AppLoggerSharedLayer {
  protected abstract readonly service: string;
  protected abstract readonly env: string;
  protected abstract readonly minLevel: LogLevel;
  protected abstract readonly logFormat: LogFormat;
  protected abstract readonly colorMode: LogColorMode;
  protected abstract readonly nestInfoMode: NestInfoMode;

  protected emitFromInvocation(
    level: LogLevel,
    first: unknown,
    optionalParams: unknown[],
    isFatal = false
  ): void {
    try {
      const parsed = this.parseInvocation(
        level,
        first,
        optionalParams,
        isFatal
      );
      this.emit(
        level,
        parsed.event,
        parsed.message,
        parsed.context,
        parsed.error,
        isFatal
      );
    } catch (error) {
      this.writeFallback(level, first, optionalParams, error, isFatal);
    }
  }

  protected parseInvocation(
    level: LogLevel,
    first: unknown,
    optionalParams: unknown[],
    isFatal: boolean
  ): ParsedInvocation {
    if (this.isDomainInvocation(first, optionalParams)) {
      const event = String(first);
      const message = String(optionalParams[0]);
      const domainContext = optionalParams[1];
      const domainError = optionalParams[2];

      if (
        level === LogLevel.ERROR &&
        domainContext instanceof Error &&
        domainError == null
      ) {
        return { event, message, error: domainContext };
      }

      return {
        event,
        message,
        context: this.asRecord(domainContext),
        error: domainError,
      };
    }

    return this.parseNestInvocation(level, first, optionalParams, isFatal);
  }

  protected parseNestInvocation(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
    isFatal: boolean
  ): ParsedInvocation {
    const context: Record<string, unknown> = {};
    const event = isFatal ? 'nest.fatal' : `nest.${level}`;
    let error: unknown;

    if (level === LogLevel.ERROR) {
      const first = optionalParams[0];
      const second = optionalParams[1];

      if (first instanceof Error) {
        error = first;
      } else if (typeof first === 'string' && typeof second === 'string') {
        error = {
          name: 'Error',
          message: String(message),
          stack: first,
        };
        context['nestContext'] = second;
      } else if (typeof first === 'string' && second === undefined) {
        error = {
          name: 'Error',
          message: String(message),
          stack: first,
        };
      } else if (typeof first === 'string' && this.asRecord(second)) {
        error = {
          name: 'Error',
          message: String(message),
          stack: first,
        };
        Object.assign(context, this.asRecord(second));
      } else if (this.asRecord(first)) {
        Object.assign(context, this.asRecord(first));
      }
    }

    const lastParam = optionalParams[optionalParams.length - 1];
    if (
      typeof lastParam === 'string' &&
      !(level === LogLevel.ERROR && optionalParams.length === 1)
    ) {
      context['nestContext'] = lastParam;
    }

    const objectParams = optionalParams.filter((param) => this.asRecord(param));
    for (const objectParam of objectParams) {
      Object.assign(context, this.asRecord(objectParam));
    }

    return {
      event,
      message: String(message),
      context: Object.keys(context).length ? context : undefined,
      error,
    };
  }

  protected resolveSeverity(level: LogLevel, isFatal: boolean): SeverityInfo {
    if (isFatal) {
      return { text: 'FATAL', number: 21 };
    }

    switch (level) {
      case LogLevel.DEBUG:
        return { text: 'DEBUG', number: 5 };
      case LogLevel.INFO:
        return { text: 'INFO', number: 9 };
      case LogLevel.WARN:
        return { text: 'WARN', number: 13 };
      case LogLevel.ERROR:
      default:
        return { text: 'ERROR', number: 17 };
    }
  }

  protected isColorEnabled(): boolean {
    if (this.colorMode === 'on') return true;
    if (this.colorMode === 'off') return false;

    const forceColor = process.env['FORCE_COLOR'];
    if (forceColor && forceColor !== '0') return true;
    if (process.env['NO_COLOR'] !== undefined) return false;

    return Boolean(process.stdout.isTTY);
  }

  protected resolveLogLevel(): LogLevel {
    const configured = (process.env['LOG_LEVEL'] || 'info').toLowerCase();
    if (Object.values(LogLevel).includes(configured as LogLevel)) {
      return configured as LogLevel;
    }
    return LogLevel.INFO;
  }

  protected resolveLogFormat(): LogFormat {
    const configured = process.env['LOG_FORMAT'];
    if (configured === 'json' || configured === 'pretty') {
      return configured;
    }

    if (this.env === 'production') {
      return 'json';
    }

    return process.stdout.isTTY ? 'pretty' : 'json';
  }

  protected resolveColorMode(): LogColorMode {
    const configured = process.env['LOG_COLOR'];
    if (configured === 'on' || configured === 'off' || configured === 'auto') {
      return configured;
    }
    return 'auto';
  }

  protected resolveNestInfoMode(): NestInfoMode {
    const configured = process.env['LOG_NEST_INFO'];
    if (configured === 'on' || configured === 'off' || configured === 'auto') {
      return configured;
    }
    return 'auto';
  }

  protected isErrorLevel(level: LogLevel, isFatal = false): boolean {
    return isFatal || level === LogLevel.WARN || level === LogLevel.ERROR;
  }

  protected isDomainInvocation(
    first: unknown,
    optionalParams: unknown[]
  ): boolean {
    if (typeof first !== 'string') return false;
    if (typeof optionalParams[0] !== 'string') return false;

    return EVENT_NAMES.has(first) || EVENT_PATTERN.test(first);
  }

  protected asRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    return value as Record<string, unknown>;
  }

  protected asNumber(value: unknown): number | undefined {
    if (
      typeof value !== 'number' ||
      Number.isNaN(value) ||
      !Number.isFinite(value)
    ) {
      return undefined;
    }
    return value;
  }

  protected quoteValue(value: string): string {
    return JSON.stringify(value);
  }

  protected safeStringify(value: unknown): string {
    try {
      const seen = new WeakSet<object>();
      return JSON.stringify(value, (_key, currentValue: unknown) => {
        if (typeof currentValue === 'bigint') {
          return currentValue.toString();
        }
        if (typeof currentValue === 'function') {
          return '[Function]';
        }
        if (typeof currentValue === 'symbol') {
          return String(currentValue);
        }
        if (currentValue instanceof Error) {
          return {
            name: currentValue.name,
            message: currentValue.message,
            stack: currentValue.stack,
          };
        }
        if (currentValue instanceof Map) {
          return {
            type: 'Map',
            entries: Array.from(currentValue.entries()),
          };
        }
        if (currentValue instanceof Set) {
          return {
            type: 'Set',
            values: Array.from(currentValue.values()),
          };
        }
        if (currentValue && typeof currentValue === 'object') {
          if (seen.has(currentValue as object)) {
            return '[Circular]';
          }
          seen.add(currentValue as object);
        }
        return currentValue;
      }) as string;
    } catch {
      return '{"message":"Failed to serialize log entry"}';
    }
  }

  protected abstract emit(
    level: LogLevel,
    event: string,
    message: string,
    context?: Record<string, unknown>,
    error?: unknown,
    isFatal?: boolean
  ): void;

  protected abstract writeFallback(
    level: LogLevel,
    first: unknown,
    optionalParams: unknown[],
    error: unknown,
    isFatal?: boolean
  ): void;
}
