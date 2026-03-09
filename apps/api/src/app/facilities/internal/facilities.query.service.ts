import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Facility } from '@khana/data-access';
import { FacilityManagementItemDto } from '@khana/shared-dtos';
import { Repository } from 'typeorm';
import {
  Actor,
  canManageRole,
  requireTenantId,
  requireUserRole,
  RESOURCE_NOT_FOUND_MESSAGE,
  toDto,
} from './facilities.internal';

/**
 * Query workflows for tenant-scoped facilities. View-only actors never learn
 * that inactive facilities exist outside manager flows.
 */
@Injectable()
export class FacilitiesQueryService {
  constructor(
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>
  ) {}

  async listFacilities(
    tenantId: string,
    actor: Actor,
    includeInactive = false
  ): Promise<FacilityManagementItemDto[]> {
    const resolvedTenantId = requireTenantId(tenantId);
    const actorRole = requireUserRole(actor.role);

    const where =
      includeInactive && canManageRole(actorRole)
        ? { tenant: { id: resolvedTenantId } }
        : { tenant: { id: resolvedTenantId }, isActive: true };

    const facilities = await this.facilityRepository.find({
      where,
      relations: { tenant: true },
      order: { name: 'ASC' },
    });

    return facilities.map((facility) => toDto(facility));
  }

  async getFacilityById(
    id: string,
    tenantId: string,
    actor: Actor
  ): Promise<FacilityManagementItemDto> {
    const resolvedTenantId = requireTenantId(tenantId);
    const actorRole = requireUserRole(actor.role);
    const facility = await this.requireFacility(id, resolvedTenantId);

    if (!facility.isActive && !canManageRole(actorRole)) {
      throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
    }

    return toDto(facility);
  }

  private async requireFacility(
    id: string,
    tenantId: string
  ): Promise<Facility> {
    const facility = await this.facilityRepository.findOne({
      where: { id, tenant: { id: tenantId } },
      relations: { tenant: true },
    });

    if (!facility) {
      throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
    }

    return facility;
  }
}
