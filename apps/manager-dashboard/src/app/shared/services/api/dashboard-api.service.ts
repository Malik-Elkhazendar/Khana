import { Injectable, inject } from '@angular/core';
import { TodaySnapshotDto } from '@khana/shared-dtos';
import { Observable } from 'rxjs';
import { ApiRequestService } from './api-request.service';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly api = inject(ApiRequestService);

  getTodaySnapshot(facilityId?: string): Observable<TodaySnapshotDto> {
    const params: Record<string, string> = {};
    if (facilityId) {
      params['facilityId'] = facilityId;
    }

    return this.api.get(
      '/v1/dashboard/today-snapshot',
      'load dashboard today snapshot',
      { params }
    );
  }
}
