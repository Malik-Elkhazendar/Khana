import { redact } from '../redaction.util';
import { RequestContextService } from '../request-context.service';
import { LogLevel, StructuredLog } from '../logging.types';
import {
  LOG_LEVEL_PRIORITY,
  NEST_FILTERED_CONTEXTS,
} from './app-logger.shared';
import { AppLoggerPrettyLayer } from './app-logger.pretty';

export abstract class AppLoggerOutputLayer extends AppLoggerPrettyLayer {
  protected abstract readonly requestContextService: RequestContextService;

  protected emit(
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

  protected shouldSkipLog(
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

  protected shouldFilterNestInfo(): boolean {
    if (this.logFormat !== 'pretty') return false;
    if (this.env === 'production') return false;

    if (this.nestInfoMode === 'on') return false;
    if (this.nestInfoMode === 'off') return true;

    return this.env !== 'production';
  }

  protected safeRedact(
    context: Record<string, unknown>
  ): Record<string, unknown> {
    try {
      return redact(context);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { redactionError: true, reason };
    }
  }

  protected normalizeError(error: unknown): {
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

  protected writeEntry(
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
}
