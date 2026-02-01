import { Injectable, Logger } from '@nestjs/common';

interface SecurityAlertPayload {
  subject: string;
  message: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendSecurityAlert(
    recipientEmail: string,
    payload: SecurityAlertPayload
  ): Promise<void> {
    this.logger.warn(
      `email.security_alert to=${recipientEmail} subject="${payload.subject}" message="${payload.message}"`
    );
  }
}
