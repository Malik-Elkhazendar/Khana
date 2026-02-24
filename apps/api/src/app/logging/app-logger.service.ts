import { Injectable, LoggerService } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { LOG_EVENTS, LogEvent } from './logging.constants';
import { LogLevel, StructuredLog } from './logging.types';
import { redact } from './redaction.util';

type LogFormat = 'json' | 'pretty';
type LogColorMode = 'auto' | 'on' | 'off';
type NestInfoMode = 'on' | 'off' | 'auto';

interface ParsedInvocation {
  event: string;
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
}

interface SeverityInfo {
  text: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  number: 5 | 9 | 13 | 17 | 21;
}

const EVENT_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
const EVENT_NAMES = new Set<string>(Object.values(LOG_EVENTS));
const NEST_FILTERED_CONTEXTS = new Set([
  'InstanceLoader',
  'RouterExplorer',
  'RoutesResolver',
]);
const CONTEXT_PRETTY_MAX_LENGTH = 240;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

const ANSI = {
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

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly service = 'khana-api';
  private readonly env = process.env['NODE_ENV'] || 'development';
  private readonly minLevel: LogLevel;
  private readonly logFormat: LogFormat;
  private readonly colorMode: LogColorMode;
  private readonly nestInfoMode: NestInfoMode;

  constructor(private readonly requestContextService: RequestContextService) {
    this.minLevel = this.resolveLogLevel();
    this.logFormat = this.resolveLogFormat();
    this.colorMode = this.resolveColorMode();
    this.nestInfoMode = this.resolveNestInfoMode();
  }

  // --- Domain API ---

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

  // --- NestJS LoggerService API ---

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.emitFromInvocation(LogLevel.INFO, message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.emitFromInvocation(LogLevel.DEBUG, message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.emitFromInvocation(LogLevel.ERROR, message, optionalParams, true);
  }

  // --- Internal ---

  private emitFromInvocation(
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

  private parseInvocation(
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

  private parseNestInvocation(
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

  private emit(
    level: LogLevel,
    event: string,
    message: string,
    context?: Record<string, unknown>,
    error?: unknown,
    isFatal = false
  ): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) return;
    if (this.shouldSkipLog(level, event, message, context)) return;

    const severity = this.resolveSeverity(level, isFatal);
    const ts = new Date().toISOString();
    const entry: StructuredLog = {
      ts,
      timestamp: ts,
      level,
      service: this.service,
      env: this.env,
      event,
      message,
      severityText: severity.text,
      severityNumber: severity.number,
    };

    const reqCtx = this.requestContextService.get();
    if (reqCtx) {
      entry.requestId = reqCtx.requestId;
      if (reqCtx.tenantId) entry.tenantId = reqCtx.tenantId;
      if (reqCtx.userId) entry.userId = reqCtx.userId;
      if (reqCtx.sessionId) entry.sessionId = reqCtx.sessionId;
      if (reqCtx.traceId) entry.trace_id = reqCtx.traceId;
      if (reqCtx.spanId) entry.span_id = reqCtx.spanId;
      if (reqCtx.traceFlags) entry.trace_flags = reqCtx.traceFlags;
      entry.method = reqCtx.method;
      entry.path = reqCtx.path;
    }

    if (context) {
      entry.context = this.safeRedact(context);
      const statusCode = this.asNumber(context['statusCode']);
      const durationMs = this.asNumber(context['durationMs']);
      if (statusCode !== undefined) entry.statusCode = statusCode;
      if (durationMs !== undefined) entry.durationMs = durationMs;
    }

    if (error) {
      entry.error = this.normalizeError(error);
    }

    this.writeEntry(level, entry, isFatal);
  }

  private shouldSkipLog(
    level: LogLevel,
    event: string,
    message: string,
    context?: Record<string, unknown>
  ): boolean {
    if (!this.shouldFilterNestInfo()) return false;
    if (level !== LogLevel.INFO || event !== 'nest.info') return false;

    if (
      message.includes('Starting Nest application') ||
      message.includes('Nest application successfully started')
    ) {
      return false;
    }

    if (
      message.includes('dependencies initialized') ||
      message.startsWith('Mapped {')
    ) {
      return true;
    }

    const nestContext = context?.['nestContext'];
    return (
      typeof nestContext === 'string' && NEST_FILTERED_CONTEXTS.has(nestContext)
    );
  }

  private shouldFilterNestInfo(): boolean {
    if (this.logFormat !== 'pretty') return false;
    if (this.env === 'production') return false;

    if (this.nestInfoMode === 'on') return false;
    if (this.nestInfoMode === 'off') return true;

    // auto: enable in non-production
    return this.env !== 'production';
  }

  private safeRedact(
    context: Record<string, unknown>
  ): Record<string, unknown> {
    try {
      return redact(context);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { redactionError: true, reason };
    }
  }

  private normalizeError(error: unknown): {
    name: string;
    message: string;
    stack?: string;
  } {
    if (!(error instanceof Error) && this.asRecord(error)) {
      const errorRecord = this.asRecord(error) as Record<string, unknown>;
      const normalizedFromRecord: {
        name: string;
        message: string;
        stack?: string;
      } = {
        name:
          typeof errorRecord['name'] === 'string'
            ? errorRecord['name']
            : 'Error',
        message:
          typeof errorRecord['message'] === 'string'
            ? errorRecord['message']
            : 'Unknown error',
      };
      if (
        this.env !== 'production' &&
        typeof errorRecord['stack'] === 'string'
      ) {
        normalizedFromRecord.stack = errorRecord['stack'];
      }
      return normalizedFromRecord;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    const normalized: { name: string; message: string; stack?: string } = {
      name: err.name,
      message: err.message,
    };
    if (this.env !== 'production' && err.stack) {
      normalized.stack = err.stack;
    }
    return normalized;
  }

  private writeEntry(
    level: LogLevel,
    entry: StructuredLog,
    isFatal = false
  ): void {
    try {
      const stream = this.isErrorLevel(level, isFatal)
        ? process.stderr
        : process.stdout;
      const line =
        this.logFormat === 'pretty'
          ? this.formatPretty(entry)
          : this.safeStringify(entry);
      stream.write(`${line}\n`);
    } catch (error) {
      this.writeFallback(level, entry.message, [], error, isFatal);
    }
  }

  private writeFallback(
    level: LogLevel,
    first: unknown,
    optionalParams: unknown[],
    error: unknown,
    isFatal = false
  ): void {
    try {
      const stream = this.isErrorLevel(level, isFatal)
        ? process.stderr
        : process.stdout;
      const reason = error instanceof Error ? error.message : String(error);
      const fallback = {
        ts: new Date().toISOString(),
        level,
        service: this.service,
        env: this.env,
        event: isFatal ? 'logger.fatal' : 'logger.failure',
        message: 'Logger pipeline failed',
        context: {
          reason,
          originalMessage: String(first),
          optionalParams,
        },
      };
      stream.write(`${this.safeStringify(fallback)}\n`);
    } catch {
      // Final safety net: never throw from logger path.
    }
  }

  private formatPretty(entry: StructuredLog): string {
    const parts: string[] = [];

    parts.push(this.formatPrettyTimestamp(entry.ts));
    parts.push(this.colorizeLevel(entry.severityText ?? 'INFO'));

    const statusDurationToken = this.formatStatusDuration(entry);
    if (statusDurationToken) parts.push(statusDurationToken);

    if (entry.method || entry.path) {
      parts.push(`${entry.method ?? '-'} ${entry.path ?? '-'}`);
    }

    if (entry.requestId) parts.push(`req=${entry.requestId}`);
    if (entry.tenantId) parts.push(`ten=${entry.tenantId}`);
    if (entry.userId) parts.push(`usr=${entry.userId}`);

    parts.push(`evt=${this.colorizeEvent(entry.event)}`);
    parts.push(`msg=${this.quoteValue(entry.message)}`);

    if (entry.context) {
      const serializedContext = this.safeStringify(entry.context);
      if (serializedContext.length > CONTEXT_PRETTY_MAX_LENGTH) {
        const truncated = `${serializedContext.slice(
          0,
          CONTEXT_PRETTY_MAX_LENGTH
        )}...`;
        parts.push(`ctx=${truncated}`);
        parts.push('ctxTruncated=true');
      } else {
        parts.push(`ctx=${serializedContext}`);
      }
    }

    let line = parts.join(' ');

    if (entry.error) {
      line = `${line} err=${this.quoteValue(
        `${entry.error.name}:${entry.error.message}`
      )}`;
      if (entry.error.stack) {
        const stackBlock = entry.error.stack
          .split('\n')
          .map((stackLine) => `    ${stackLine}`)
          .join('\n');
        line = `${line}\n${stackBlock}`;
      }
    }

    return line;
  }

  private formatPrettyTimestamp(ts: string): string {
    const date = new Date(ts);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}.${ms}`;
  }

  private formatStatusDuration(entry: StructuredLog): string | null {
    const hasStatus = typeof entry.statusCode === 'number';
    const hasDuration = typeof entry.durationMs === 'number';

    if (!hasStatus && !hasDuration) return null;

    if (hasStatus && hasDuration) {
      return `${this.colorizeStatus(entry.statusCode)}${'/'}${Math.max(
        0,
        Math.round(entry.durationMs)
      )}ms`;
    }
    if (hasStatus) {
      return this.colorizeStatus(entry.statusCode);
    }
    return `${Math.max(0, Math.round(entry.durationMs as number))}ms`;
  }

  private colorizeLevel(levelText: string): string {
    if (!this.isColorEnabled()) return levelText;

    switch (levelText) {
      case 'DEBUG':
        return `${ANSI.gray}${levelText}${ANSI.reset}`;
      case 'INFO':
        return `${ANSI.cyan}${levelText}${ANSI.reset}`;
      case 'WARN':
        return `${ANSI.yellow}${levelText}${ANSI.reset}`;
      case 'ERROR':
        return `${ANSI.red}${levelText}${ANSI.reset}`;
      case 'FATAL':
        return `${ANSI.brightRed}${levelText}${ANSI.reset}`;
      default:
        return levelText;
    }
  }

  private colorizeStatus(statusCode: number): string {
    const text = String(statusCode);
    if (!this.isColorEnabled()) return text;

    if (statusCode >= 500) return `${ANSI.red}${text}${ANSI.reset}`;
    if (statusCode >= 400) return `${ANSI.yellow}${text}${ANSI.reset}`;
    if (statusCode >= 300) return `${ANSI.cyan}${text}${ANSI.reset}`;
    if (statusCode >= 200) return `${ANSI.green}${text}${ANSI.reset}`;

    return text;
  }

  private colorizeEvent(event: string): string {
    if (!this.isColorEnabled()) return event;

    const namespace = event.split('.')[0];
    const color = this.namespaceColor(namespace);
    if (!color) return event;

    return `${color}${event}${ANSI.reset}`;
  }

  private namespaceColor(namespace: string): string | null {
    switch (namespace) {
      case 'auth':
        return ANSI.blue;
      case 'booking':
        return ANSI.green;
      case 'email':
        return ANSI.magenta;
      case 'metrics':
        return ANSI.yellow;
      case 'system':
        return ANSI.cyan;
      case 'http':
        return ANSI.gray;
      default:
        return null;
    }
  }

  private resolveSeverity(level: LogLevel, isFatal: boolean): SeverityInfo {
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

  private isColorEnabled(): boolean {
    if (this.colorMode === 'on') return true;
    if (this.colorMode === 'off') return false;

    const forceColor = process.env['FORCE_COLOR'];
    if (forceColor && forceColor !== '0') return true;
    if (process.env['NO_COLOR'] !== undefined) return false;

    return Boolean(process.stdout.isTTY);
  }

  private resolveLogLevel(): LogLevel {
    const configured = (process.env['LOG_LEVEL'] || 'info').toLowerCase();
    if (Object.values(LogLevel).includes(configured as LogLevel)) {
      return configured as LogLevel;
    }
    return LogLevel.INFO;
  }

  private resolveLogFormat(): LogFormat {
    const configured = process.env['LOG_FORMAT'];
    if (configured === 'json' || configured === 'pretty') {
      return configured;
    }

    if (this.env === 'production') {
      return 'json';
    }

    return process.stdout.isTTY ? 'pretty' : 'json';
  }

  private resolveColorMode(): LogColorMode {
    const configured = process.env['LOG_COLOR'];
    if (configured === 'on' || configured === 'off' || configured === 'auto') {
      return configured;
    }
    return 'auto';
  }

  private resolveNestInfoMode(): NestInfoMode {
    const configured = process.env['LOG_NEST_INFO'];
    if (configured === 'on' || configured === 'off' || configured === 'auto') {
      return configured;
    }
    return 'auto';
  }

  private isErrorLevel(level: LogLevel, isFatal = false): boolean {
    return isFatal || level === LogLevel.WARN || level === LogLevel.ERROR;
  }

  private isDomainInvocation(
    first: unknown,
    optionalParams: unknown[]
  ): boolean {
    if (typeof first !== 'string') return false;
    if (typeof optionalParams[0] !== 'string') return false;

    return EVENT_NAMES.has(first) || EVENT_PATTERN.test(first);
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return undefined;
    return value as Record<string, unknown>;
  }

  private asNumber(value: unknown): number | undefined {
    if (
      typeof value !== 'number' ||
      Number.isNaN(value) ||
      !Number.isFinite(value)
    ) {
      return undefined;
    }
    return value;
  }

  private quoteValue(value: string): string {
    return JSON.stringify(value);
  }

  private safeStringify(value: unknown): string {
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
}
