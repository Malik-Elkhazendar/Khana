import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditAction, AuditLog, Facility } from '@khana/data-access';
import { FacilityManagementItemDto } from '@khana/shared-dtos';
import { Repository } from 'typeorm';
import { AppLoggerService } from '../../logging';
import { CreateFacilityDto, UpdateFacilityDto } from '../dto';
import {
  Actor,
  assertManageRole,
  auditSnapshot,
  FacilityConfig,
  normalizeConfig,
  normalizeFacilityType,
  requireTenantId,
  requireUserRole,
  RESOURCE_NOT_FOUND_MESSAGE,
  toDto,
} from './facilities.internal';

/**
 * Mutation workflows for facility management. Audit logging and facility admin
 * permission checks stay colocated with the write paths.
 */
@Injectable()
export class FacilitiesMutationService {
  constructor(
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly appLogger: AppLoggerService
  ) {}

  async createFacility(
    dto: CreateFacilityDto,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<FacilityManagementItemDto> {
    const resolvedTenantId = requireTenantId(tenantId);
    const actorRole = requireUserRole(actor.role);
    assertManageRole(actorRole);

    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Facility name is required.');
    }

    const facility = this.facilityRepository.create({
      name,
      type: normalizeFacilityType(dto.type),
      config: normalizeConfig(dto.config),
      isActive: true,
      tenant: { id: resolvedTenantId } as never,
    });

    const saved = await this.facilityRepository.save(facility);

    await this.logAudit({
      tenantId: resolvedTenantId,
      userId: actor.id,
      action: AuditAction.CREATE,
      entityType: 'Facility',
      entityId: saved.id,
      description: `Facility created: ${saved.name}`,
      changes: { after: auditSnapshot(saved) },
      ipAddress,
      userAgent,
    });

    this.appLogger.info('facility.create.success', 'Facility created', {
      facilityId: saved.id,
      tenantId: resolvedTenantId,
      actorUserId: actor.id,
    });

    return toDto(saved);
  }

  async updateFacility(
    id: string,
    dto: UpdateFacilityDto,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<FacilityManagementItemDto> {
    const resolvedTenantId = requireTenantId(tenantId);
    const actorRole = requireUserRole(actor.role);
    assertManageRole(actorRole);

    const facility = await this.requireFacility(id, resolvedTenantId);
    const before = auditSnapshot(facility);

    if (typeof dto.name === 'string') {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Facility name is required.');
      }
      facility.name = name;
    }

    if (typeof dto.type === 'string') {
      facility.type = normalizeFacilityType(dto.type);
    }

    if (typeof dto.isActive === 'boolean') {
      facility.isActive = dto.isActive;
    }

    if (dto.config) {
      const merged = {
        ...((facility.config as Partial<FacilityConfig> | null) ?? {}),
        ...dto.config,
      };
      facility.config = normalizeConfig(merged);
    }

    const saved = await this.facilityRepository.save(facility);

    await this.logAudit({
      tenantId: resolvedTenantId,
      userId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'Facility',
      entityId: saved.id,
      description: `Facility updated: ${saved.name}`,
      changes: {
        before,
        after: auditSnapshot(saved),
      },
      ipAddress,
      userAgent,
    });

    this.appLogger.info('facility.update.success', 'Facility updated', {
      facilityId: saved.id,
      tenantId: resolvedTenantId,
      actorUserId: actor.id,
    });

    return toDto(saved);
  }

  async deactivateFacility(
    id: string,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<FacilityManagementItemDto> {
    const resolvedTenantId = requireTenantId(tenantId);
    const actorRole = requireUserRole(actor.role);
    assertManageRole(actorRole);

    const facility = await this.requireFacility(id, resolvedTenantId);
    if (!facility.isActive) {
      return toDto(facility);
    }

    const before = auditSnapshot(facility);
    facility.isActive = false;
    const saved = await this.facilityRepository.save(facility);

    await this.logAudit({
      tenantId: resolvedTenantId,
      userId: actor.id,
      action: AuditAction.DELETE,
      entityType: 'Facility',
      entityId: saved.id,
      description: `Facility deactivated: ${saved.name}`,
      changes: {
        before,
        after: auditSnapshot(saved),
      },
      ipAddress,
      userAgent,
    });

    this.appLogger.info('facility.deactivate.success', 'Facility deactivated', {
      facilityId: saved.id,
      tenantId: resolvedTenantId,
      actorUserId: actor.id,
    });

    return toDto(saved);
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

  private async logAudit(params: {
    tenantId: string;
    userId?: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    description?: string;
    changes?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const auditLog = this.auditLogRepository.create({
      tenantId: params.tenantId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      description: params.description,
      changes: params.changes,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    await this.auditLogRepository.save(auditLog);
  }
}
