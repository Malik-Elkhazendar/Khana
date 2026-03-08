import { Injectable, inject } from '@angular/core';
import {
  GoalSettingsResponseDto,
  TenantSettingsResponseDto,
  UpdateGoalsRequestDto,
  UpdateTenantSettingsRequestDto,
} from '@khana/shared-dtos';
import { Observable } from 'rxjs';
import { ApiRequestService } from './api-request.service';

@Injectable({ providedIn: 'root' })
export class SettingsApiService {
  private readonly api = inject(ApiRequestService);

  getTenantSettings(): Observable<TenantSettingsResponseDto> {
    return this.api.get('/v1/settings', 'load tenant settings');
  }

  updateTenantSettings(
    request: UpdateTenantSettingsRequestDto
  ): Observable<TenantSettingsResponseDto> {
    return this.api.patch('/v1/settings', request, 'update tenant settings');
  }

  getGoalSettings(): Observable<GoalSettingsResponseDto> {
    return this.api.get('/v1/settings/goals', 'load goal settings');
  }

  updateGoalSettings(
    request: UpdateGoalsRequestDto
  ): Observable<GoalSettingsResponseDto> {
    return this.api.patch(
      '/v1/settings/goals',
      request,
      'update goal settings'
    );
  }
}
