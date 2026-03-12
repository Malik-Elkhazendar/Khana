import { Injectable, inject } from '@angular/core';
import {
  CreateFacilityRequestDto,
  FacilityManagementItemDto,
  UpdateFacilityRequestDto,
} from '@khana/shared-dtos';
import { Observable } from 'rxjs';
import type { CreateFacilityDto, UpdateFacilityDto } from './generated/model';
import { FacilitiesService as GeneratedFacilitiesService } from './generated/facilities/facilities.service';

@Injectable({ providedIn: 'root' })
export class FacilitiesApiService {
  private readonly generatedApi = inject(GeneratedFacilitiesService);

  getManagedFacilities(
    includeInactive = true
  ): Observable<FacilityManagementItemDto[]> {
    return this.generatedApi.facilitiesFindAll<FacilityManagementItemDto[]>(
      includeInactive ? { includeInactive: 'true' } : undefined
    );
  }

  getManagedFacilityById(id: string): Observable<FacilityManagementItemDto> {
    return this.generatedApi.facilitiesFindOne<FacilityManagementItemDto>(id);
  }

  createFacility(
    request: CreateFacilityRequestDto
  ): Observable<FacilityManagementItemDto> {
    return this.generatedApi.facilitiesCreate<FacilityManagementItemDto>(
      request as CreateFacilityDto
    );
  }

  updateFacility(
    id: string,
    request: UpdateFacilityRequestDto
  ): Observable<FacilityManagementItemDto> {
    return this.generatedApi.facilitiesUpdate<FacilityManagementItemDto>(
      id,
      request as UpdateFacilityDto
    );
  }

  deactivateFacility(id: string): Observable<FacilityManagementItemDto> {
    return this.generatedApi.facilitiesDeactivate<FacilityManagementItemDto>(
      id
    );
  }
}
