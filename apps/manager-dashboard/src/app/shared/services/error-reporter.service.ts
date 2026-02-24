import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';

@Injectable({ providedIn: 'root' })
export class ErrorReporterService {
  private readonly logger = inject(LoggerService);

  report(error: unknown, context?: Record<string, unknown>): void {
    this.logger.error(
      'client.error.unhandled',
      'Unhandled client error',
      context,
      error
    );

    // Placeholder for external providers (Sentry/etc.) when integrated.
    if (environment.logging.sentry && environment.logging.sentryDsn) {
      this.logger.debug(
        'client.error.reporter.provider_pending',
        'External error provider configured but integration is not enabled in this phase.',
        {
          provider: 'sentry',
        }
      );
    }
  }
}
