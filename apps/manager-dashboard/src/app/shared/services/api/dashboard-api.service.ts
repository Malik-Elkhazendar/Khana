import { Injectable, inject } from '@angular/core';
import { TodaySnapshotDto } from '@khana/shared-dtos';
import { Observable } from 'rxjs';
import { DashboardService as GeneratedDashboardService } from './generated/dashboard/dashboard.service';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly generatedApi = inject(GeneratedDashboardService);

  getTodaySnapshot(facilityId?: string): Observable<TodaySnapshotDto> {
    return this.generatedApi.dashboardGetTodaySnapshot<TodaySnapshotDto>(
      facilityId ? { facilityId } : undefined
    );
  }
}
