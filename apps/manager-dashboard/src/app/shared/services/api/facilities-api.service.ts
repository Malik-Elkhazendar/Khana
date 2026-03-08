import { Injectable, inject } from '@angular/core';
import {
  CreateFacilityRequestDto,
  FacilityManagementItemDto,
  UpdateFacilityRequestDto,
} from '@khana/shared-dtos';
import { Observable } from 'rxjs';
import { ApiRequestService } from './api-request.service';

@Injectable({ providedIn: 'root' })
export class FacilitiesApiService {
  private readonly api = inject(ApiRequestService);

  getManagedFacilities(
    includeInactive = true
  ): Observable<FacilityManagementItemDto[]> {
    return this.api.get('/v1/facilities', 'load managed facilities', {
      params: includeInactive ? { includeInactive: 'true' } : {},
    });
  }

  getManagedFacilityById(id: string): Observable<FacilityManagementItemDto> {
    return this.api.get(`/v1/facilities/${id}`, 'load managed facility');
  }

  createFacility(
    request: CreateFacilityRequestDto
  ): Observable<FacilityManagementItemDto> {
    return this.api.post('/v1/facilities', request, 'create facility');
  }

  updateFacility(
    id: string,
    request: UpdateFacilityRequestDto
  ): Observable<FacilityManagementItemDto> {
    return this.api.patch(`/v1/facilities/${id}`, request, 'update facility');
  }

  deactivateFacility(id: string): Observable<FacilityManagementItemDto> {
    return this.api.delete(`/v1/facilities/${id}`, 'deactivate facility');
  }
}
