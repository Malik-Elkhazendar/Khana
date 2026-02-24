import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ErrorReporterService } from '../services/error-reporter.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly errorReporter = inject(ErrorReporterService);

  handleError(error: unknown): void {
    try {
      this.errorReporter.report(error, {
        source: 'angular.global_error_handler',
      });
    } catch {
      // Never throw from Angular global error handling.
    }
  }
}
