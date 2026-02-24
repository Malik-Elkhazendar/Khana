import { Injectable } from '@nestjs/common';
import { AppLoggerService, LOG_EVENTS } from '../../logging';

@Injectable()
export class MetricsService {
  constructor(private readonly appLogger: AppLoggerService) {}

  trackReuseDetection(userId: string, sessionId: string): void {
    this.appLogger.warn(
      LOG_EVENTS.METRICS_REUSE_DETECTED,
      'Refresh token reuse detected',
      { userId, sessionId }
    );
  }

  trackFailedRefresh(reason: string): void {
    this.appLogger.warn(
      LOG_EVENTS.METRICS_REFRESH_FAILED,
      'Refresh token failed',
      { reason }
    );
  }

  trackTokenRotation(userId: string, latencyMs: number): void {
    this.appLogger.info(
      LOG_EVENTS.METRICS_ROTATION_LATENCY,
      'Refresh token rotated',
      { userId, latencyMs }
    );
  }

  trackActiveSessions(userId: string, count: number): void {
    this.appLogger.info(
      LOG_EVENTS.METRICS_ACTIVE_SESSIONS,
      'Active sessions count',
      { userId, count }
    );
  }

  trackSecurityEscalation(userId: string, incidentCount: number): void {
    this.appLogger.warn(
      LOG_EVENTS.METRICS_SECURITY_ESCALATION,
      'Security escalation threshold exceeded',
      { userId, incidentCount }
    );
  }
}
