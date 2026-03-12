import {
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

function normalizeBasePath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '');
  if (!normalized || normalized === '/') {
    return '';
  }

  return normalized.endsWith('/api') ? normalized.slice(0, -4) : normalized;
}

export function deriveGeneratedApiOrigin(apiBaseUrl: string): string {
  const parsed = new URL(apiBaseUrl);
  const basePath = normalizeBasePath(parsed.pathname);
  return `${parsed.origin}${basePath}`;
}

/**
 * Prefixes generated OpenAPI client requests with the API origin while leaving
 * handwritten absolute URLs and non-API requests untouched.
 */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }

  return next(
    req.clone({
      url: `${deriveGeneratedApiOrigin(environment.apiBaseUrl)}${req.url}`,
    })
  );
};
