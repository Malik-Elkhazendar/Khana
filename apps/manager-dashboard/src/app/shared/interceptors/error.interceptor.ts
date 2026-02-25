import {
  HttpInterceptorFn,
  HttpErrorResponse,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, catchError, throwError } from 'rxjs';
import { LoggerService } from '../services/logger.service';

/**
 * Error Interceptor
 *
 * Catches HTTP Error Responses from the API and intelligently attempts
 * to translate the error code into a localized string before it hits the application store.
 */
export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const translateService = inject(TranslateService);
  const logger = inject(LoggerService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const requestId = error.headers?.get('x-request-id') ?? undefined;
        if (error.error) {
          // Assume API sends specific error codes in `error.errorCode` or uses generic fallback
          const backEndErrorCode = error.error?.code || error.error?.errorCode;

          if (backEndErrorCode) {
            // Attempt to translate the explicit error code
            const translationKey = `API_ERRORS.${backEndErrorCode}`;
            const translatedMessage = translateService.instant(translationKey);

            // If translation found (it did not just return the key itself)
            if (translatedMessage !== translationKey) {
              // Mutate the error object string payload for the consuming service
              error.error.message = translatedMessage;
            }
          } else if (error.status === 401) {
            error.error.message = translateService.instant(
              'API_ERRORS.UNAUTHORIZED'
            );
          } else if (error.status >= 500) {
            error.error.message = translateService.instant(
              'API_ERRORS.SERVER_ERROR'
            );
          } else if (error.status === 404) {
            error.error.message = translateService.instant(
              'API_ERRORS.NOT_FOUND'
            );
          }
        }

        if (error.status >= 500) {
          const context: Record<string, unknown> = {
            method: req.method,
            url: req.url,
            statusCode: error.status,
          };
          if (requestId) {
            context['requestId'] = requestId;
          }

          logger.error(
            'client.http.response.failed',
            'HTTP request failed with server error',
            context,
            error
          );
        } else {
          const context: Record<string, unknown> = {
            method: req.method,
            url: req.url,
            statusCode: error.status,
          };
          if (requestId) {
            context['requestId'] = requestId;
          }

          logger.warn('client.http.response.failed', 'HTTP request failed', {
            ...context,
          });
        }
      }

      return throwError(() => error);
    })
  );
};
