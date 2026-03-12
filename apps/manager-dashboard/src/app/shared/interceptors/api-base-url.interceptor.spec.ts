import { HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import {
  apiBaseUrlInterceptor,
  deriveGeneratedApiOrigin,
} from './api-base-url.interceptor';

describe('apiBaseUrlInterceptor', () => {
  it('derives the API origin from a dev apiBaseUrl with /api suffix', () => {
    expect(deriveGeneratedApiOrigin('http://localhost:3000/api')).toBe(
      'http://localhost:3000'
    );
  });

  it('keeps a host-only production apiBaseUrl unchanged', () => {
    expect(deriveGeneratedApiOrigin('https://api.khana.app')).toBe(
      'https://api.khana.app'
    );
  });

  it('prefixes generated /api requests with the derived origin', (done) => {
    const request = new HttpRequest('GET', '/api/v1/dashboard/today-snapshot');
    const next: HttpHandlerFn = (updatedRequest) => {
      expect(updatedRequest.url).toBe(
        'http://localhost:3000/api/v1/dashboard/today-snapshot'
      );
      return of(new HttpResponse({ status: 200 }));
    };

    apiBaseUrlInterceptor(request, next).subscribe({
      complete: () => done(),
    });
  });

  it('does not rewrite absolute or non-api requests', (done) => {
    const request = new HttpRequest(
      'GET',
      'http://localhost:3000/api/v1/dashboard/today-snapshot'
    );
    const next: HttpHandlerFn = (updatedRequest) => {
      expect(updatedRequest.url).toBe(
        'http://localhost:3000/api/v1/dashboard/today-snapshot'
      );
      return of(new HttpResponse({ status: 200 }));
    };

    apiBaseUrlInterceptor(request, next).subscribe({
      complete: () => done(),
    });
  });
});
