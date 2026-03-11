import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ClientLogLevel } from '../../../environments/environment.model';

interface ClientLogEntry {
  ts: string;
  level: ClientLogLevel;
  service: 'manager-dashboard';
  env: 'development' | 'production';
  event: string;
  message: string;
  clientSessionId: string;
  requestId?: string;
  route?: string;
  context?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

const LOG_PRIORITY: Record<ClientLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACTED_FIELDS = new Set([
  'password',
  'newpassword',
  'oldpassword',
  'currentpassword',
  'token',
  'refreshtoken',
  'accesstoken',
  'authorization',
  'cookie',
  'resettoken',
  'tokenhash',
  'passwordhash',
  'secret',
  'apikey',
]);

/**
 * Browser-side structured logger for dashboard telemetry. It redacts common
 * secrets before writing JSON payloads to the console and must never throw
 * into the user-facing flow.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly clientSessionId = this.generateSessionId();

  debug(
    event: string,
    message: string,
    context?: Record<string, unknown>
  ): void {
    this.emit('debug', event, message, context);
  }

  info(
    event: string,
    message: string,
    context?: Record<string, unknown>
  ): void {
    this.emit('info', event, message, context);
  }

  warn(
    event: string,
    message: string,
    context?: Record<string, unknown>
  ): void {
    this.emit('warn', event, message, context);
  }

  error(
    event: string,
    message: string,
    context?: Record<string, unknown>,
    error?: unknown
  ): void {
    this.emit('error', event, message, context, error);
  }

  private emit(
    level: ClientLogLevel,
    event: string,
    message: string,
    context?: Record<string, unknown>,
    error?: unknown
  ): void {
    if (!this.shouldLog(level)) return;
    if (!environment.logging.console) return;

    try {
      const entry: ClientLogEntry = {
        ts: new Date().toISOString(),
        level,
        service: 'manager-dashboard',
        env: environment.production ? 'production' : 'development',
        event,
        message,
        clientSessionId: this.clientSessionId,
        route: this.resolveRoute(),
      };

      if (context) {
        const requestId = this.extractRequestId(context);
        if (requestId) {
          entry.requestId = requestId;
        }

        const contextWithoutRequestId = this.withoutRequestId(context);
        const redactedContext = this.redact(
          contextWithoutRequestId,
          new WeakSet<object>()
        );
        if (Object.keys(redactedContext).length > 0) {
          entry.context = redactedContext;
        }
      }

      if (error) {
        entry.error = this.normalizeError(error);
      }

      const payload = JSON.stringify(entry);
      this.write(level, payload);
    } catch {
      // Client logging is observability-only; swallowing failures keeps UI
      // actions safe even when console serialization breaks.
    }
  }

  private shouldLog(level: ClientLogLevel): boolean {
    return LOG_PRIORITY[level] >= LOG_PRIORITY[environment.logging.level];
  }

  private write(level: ClientLogLevel, payload: string): void {
    if (level === 'error') {
      console.error(payload);
      return;
    }

    if (level === 'warn') {
      console.warn(payload);
      return;
    }

    if (level === 'debug') {
      console.debug(payload);
      return;
    }

    console.info(payload);
  }

  private resolveRoute(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    return window.location?.pathname || '/';
  }

  private generateSessionId(): string {
    const randomUuid = globalThis.crypto?.randomUUID?.();
    if (randomUuid) {
      return randomUuid;
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private extractRequestId(
    context: Record<string, unknown>
  ): string | undefined {
    const value = context['requestId'];
    if (typeof value !== 'string') return undefined;
    const requestId = value.trim();
    return requestId.length > 0 ? requestId : undefined;
  }

  private withoutRequestId(
    context: Record<string, unknown>
  ): Record<string, unknown> {
    const rest = { ...context };
    delete rest['requestId'];
    return rest;
  }

  private normalizeError(error: unknown): {
    name: string;
    message: string;
    stack?: string;
  } {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      name: err.name || 'Error',
      message: err.message || 'Unknown error',
      stack: environment.production ? undefined : err.stack,
    };
  }

  private redact(
    value: unknown,
    seen: WeakSet<object>
  ): Record<string, unknown> {
    const redacted = this.redactValue(value, seen);
    if (!redacted || typeof redacted !== 'object' || Array.isArray(redacted)) {
      return { value: redacted };
    }
    return redacted as Record<string, unknown>;
  }

  private redactValue(value: unknown, seen: WeakSet<object>): unknown {
    if (value == null) return value;

    const valueType = typeof value;
    if (valueType === 'bigint') return value.toString();
    if (valueType === 'function') return '[Function]';
    if (valueType === 'symbol') return String(value);
    if (valueType !== 'object') return value;

    const objectValue = value as object;
    if (seen.has(objectValue)) return '[Circular]';
    seen.add(objectValue);

    if (Array.isArray(value)) {
      return value.map((item) => this.redactValue(item, seen));
    }

    if (value instanceof Error) {
      return this.normalizeError(value);
    }

    const source = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, fieldValue] of Object.entries(source)) {
      const normalizedKey = key.toLowerCase();

      if (REDACTED_FIELDS.has(normalizedKey)) {
        output[key] = '[REDACTED]';
        continue;
      }

      if (normalizedKey === 'email' && typeof fieldValue === 'string') {
        output[key] = this.maskEmail(fieldValue);
        continue;
      }

      if (normalizedKey === 'phone' && typeof fieldValue === 'string') {
        output[key] = this.maskPhone(fieldValue);
        continue;
      }

      output[key] = this.redactValue(fieldValue, seen);
    }

    return output;
  }

  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;
    return `${localPart[0]}***@${domain}`;
  }

  private maskPhone(phone: string): string {
    if (!phone) return phone;
    if (phone.length <= 7) return '***';
    if (phone.length <= 10) {
      return `${phone.slice(0, 2)}***${phone.slice(-2)}`;
    }
    return `${phone.slice(0, 4)}***${phone.slice(-4)}`;
  }
}
