import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  trackReuseDetection(userId: string, sessionId: string): void {
    this.logger.warn(
      `metrics.refresh_token.reuse_detected userId=${userId} sessionId=${sessionId}`
    );
  }

  trackFailedRefresh(reason: string): void {
    this.logger.warn(`metrics.refresh_token.failed reason=${reason}`);
  }

  trackTokenRotation(userId: string, latencyMs: number): void {
    this.logger.log(
      `metrics.refresh_token.rotation_latency_ms userId=${userId} latencyMs=${latencyMs}`
    );
  }

  trackActiveSessions(userId: string, count: number): void {
    this.logger.log(
      `metrics.refresh_token.active_sessions userId=${userId} count=${count}`
    );
  }

  trackSecurityEscalation(userId: string, incidentCount: number): void {
    this.logger.warn(
      `metrics.refresh_token.security_escalation userId=${userId} incidents=${incidentCount}`
    );
  }
}
