import { LogLevel, StructuredLog } from '../logging.types';
import {
  ANSI,
  AppLoggerSharedLayer,
  CONTEXT_PRETTY_MAX_LENGTH,
} from './app-logger.shared';

export abstract class AppLoggerPrettyLayer extends AppLoggerSharedLayer {
  protected formatPretty(entry: StructuredLog): string {
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

  protected formatPrettyTimestamp(ts: string): string {
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

  protected formatStatusDuration(entry: StructuredLog): string | null {
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

  protected colorizeLevel(levelText: string): string {
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

  protected colorizeStatus(statusCode: number): string {
    const text = String(statusCode);
    if (!this.isColorEnabled()) return text;

    if (statusCode >= 500) return `${ANSI.red}${text}${ANSI.reset}`;
    if (statusCode >= 400) return `${ANSI.yellow}${text}${ANSI.reset}`;
    if (statusCode >= 300) return `${ANSI.cyan}${text}${ANSI.reset}`;
    if (statusCode >= 200) return `${ANSI.green}${text}${ANSI.reset}`;

    return text;
  }

  protected colorizeEvent(event: string): string {
    if (!this.isColorEnabled()) return event;

    const namespace = event.split('.')[0];
    const color = this.namespaceColor(namespace);
    if (!color) return event;

    return `${color}${event}${ANSI.reset}`;
  }

  protected namespaceColor(namespace: string): string | null {
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

  protected writeFallback(
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
}
