export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface StructuredLog {
  ts: string;
  timestamp?: string;
  level: LogLevel;
  service: string;
  env: string;
  event: string;
  message: string;
  severityText?: string;
  severityNumber?: number;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  trace_id?: string;
  span_id?: string;
  trace_flags?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  context?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

export interface RequestContext {
  requestId: string;
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  traceFlags?: string;
  method: string;
  path: string;
  startTime: number;
}
