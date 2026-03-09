import { Injectable } from '@nestjs/common';
import { FacilityManagementItemDto } from '@khana/shared-dtos';
import { CreateFacilityDto, UpdateFacilityDto } from './dto';
import { Actor } from './internal/facilities.internal';
import { FacilitiesMutationService } from './internal/facilities.mutation.service';
import { FacilitiesQueryService } from './internal/facilities.query.service';

/**
 * Public facilities facade. Query and mutation workflows live in focused
 * internal providers so the exported service stays small and stable.
 */
@Injectable()
export class FacilitiesService {
  constructor(
    private readonly queryService: FacilitiesQueryService,
    private readonly mutationService: FacilitiesMutationService
  ) {}

  listFacilities(
    tenantId: string,
    actor: Actor,
    includeInactive = false
  ): Promise<FacilityManagementItemDto[]> {
    return this.queryService.listFacilities(tenantId, actor, includeInactive);
  }

  getFacilityById(
    id: string,
    tenantId: string,
    actor: Actor
  ): Promise<FacilityManagementItemDto> {
    return this.queryService.getFacilityById(id, tenantId, actor);
  }

  createFacility(
    dto: CreateFacilityDto,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<FacilityManagementItemDto> {
    return this.mutationService.createFacility(
      dto,
      tenantId,
      actor,
      ipAddress,
      userAgent
    );
  }

  updateFacility(
    id: string,
    dto: UpdateFacilityDto,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<FacilityManagementItemDto> {
    return this.mutationService.updateFacility(
      id,
      dto,
      tenantId,
      actor,
      ipAddress,
      userAgent
    );
  }

  deactivateFacility(
    id: string,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<FacilityManagementItemDto> {
    return this.mutationService.deactivateFacility(
      id,
      tenantId,
      actor,
      ipAddress,
      userAgent
    );
  }
}
