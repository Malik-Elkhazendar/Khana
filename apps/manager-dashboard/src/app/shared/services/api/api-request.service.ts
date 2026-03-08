import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LoggerService } from '../logger.service';

type ApiRequestOptions = {
  params?: Record<string, string>;
};

@Injectable({ providedIn: 'root' })
export class ApiRequestService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/+$/, '');

  get<T>(
    path: string,
    operation: string,
    options?: ApiRequestOptions
  ): Observable<T> {
    return this.http
      .get<T>(`${this.baseUrl}${path}`, options)
      .pipe(catchError(this.handleError(operation)));
  }

  post<T>(
    path: string,
    body: unknown,
    operation: string,
    options?: ApiRequestOptions
  ): Observable<T> {
    return this.http
      .post<T>(`${this.baseUrl}${path}`, body, options)
      .pipe(catchError(this.handleError(operation)));
  }

  patch<T>(
    path: string,
    body: unknown,
    operation: string,
    options?: ApiRequestOptions
  ): Observable<T> {
    return this.http
      .patch<T>(`${this.baseUrl}${path}`, body, options)
      .pipe(catchError(this.handleError(operation)));
  }

  delete<T>(
    path: string,
    operation: string,
    options?: ApiRequestOptions
  ): Observable<T> {
    return this.http
      .delete<T>(`${this.baseUrl}${path}`, options)
      .pipe(catchError(this.handleError(operation)));
  }

  private handleError(operation: string) {
    return (err: unknown) => {
      const requestId =
        err instanceof HttpErrorResponse
          ? err.headers?.get('x-request-id') ?? undefined
          : undefined;
      const context: Record<string, unknown> = { operation };
      if (requestId) {
        context['requestId'] = requestId;
      }

      this.logger.error(
        'client.api.request_failed',
        `Failed to ${operation}`,
        context,
        err
      );
      return throwError(() => err);
    };
  }
}
